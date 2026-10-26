const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ override: false });

const C = {
  dryRun: String(process.env.DRY_RUN ?? 'true').toLowerCase() === 'true',
  bucket: process.env.SUPABASE_BUCKET || 'compras-adjuntos',
  table: process.env.SUPABASE_TABLE || 'compras',
  docCol: process.env.DB_DOC_COLUMN || 'numero_documento',
  attachmentCol: process.env.DB_ATTACHMENT_COLUMN || 'pdf_factura_path',
  providerCol: process.env.DB_PROVIDER_COLUMN || 'proveedor_nombre',
  dateCol: process.env.DB_DATE_COLUMN || 'fecha_compra',
  updateDatabase: String(process.env.UPDATE_DATABASE ?? 'true').toLowerCase() === 'true',
  verifyAfterUpload: String(process.env.VERIFY_AFTER_UPLOAD ?? 'true').toLowerCase() === 'true',
  overwriteExisting: String(process.env.OVERWRITE_EXISTING_DB ?? 'false').toLowerCase() === 'true',
  manifestPath: process.env.MANIFEST_PATH || './manifiesto_carga.csv',
  zipsDir: process.env.ZIPS_DIR || './zips',
};

function removeAccents(v='') { return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function clean(v='') { return removeAccents(v).replace(/\s+/g,' ').trim().toUpperCase(); }
function compact(v='') { return clean(v).replace(/[^A-Z0-9]/g,''); }
function safe(v='') {
  return removeAccents(v).replace(/[^A-Za-z0-9._-]+/g,'_').replace(/_+/g,'_').replace(/^[_\-.]+|[_\-.]+$/g,'').toUpperCase();
}
function docKeys(v='') {
  const s=clean(v).replace(/^\.+|\.+$/g,'');
  const keys=new Set();
  const raw=compact(s); if(raw) keys.add('RAW:'+raw);
  const m=s.match(/^([A-Z]{1,6}\d{0,4})\s*[-_ ]+\s*0*(\d+)$/);
  if(m) keys.add(`PAIR:${m[1]}#${Number(m[2])}`);
  const m2=s.match(/([A-Z]{1,6}\d{0,4})\s*[-_ ]\s*0*(\d{1,14})/);
  if(m2) keys.add(`PAIR:${m2[1]}#${Number(m2[2])}`);
  return [...keys];
}
function providerTokens(v='') {
  const stop=new Set(['SAC','SA','EIRL','SOCIEDAD','ANONIMA','CERRADA','DEL','DE','LA','Y','PERU']);
  return clean(v).match(/[A-Z0-9]+/g)?.filter(t=>t.length>1 && !stop.has(t)) || [];
}
function providerScore(a,b) {
  const A=new Set(providerTokens(a)), B=new Set(providerTokens(b));
  if(!A.size || !B.size) return 0;
  const inter=[...A].filter(x=>B.has(x)).length;
  return inter / Math.min(A.size,B.size);
}
function dateISOtoDMY(v='') {
  const s=String(v||'').slice(0,10);
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if(m) return `${m[3]}/${m[2]}/${m[1]}`;
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(m) return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}`;
  return String(v||'').trim();
}
function yyyymm(dmy='') {
  const m=String(dmy).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}${m[2].padStart(2,'0')}` : '';
}
function csvEscape(v) { const s=String(v??''); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
function writeReport(rows) {
  const h=['original','status','documento','proveedor','fecha','compra_id','storage_path','db_path_anterior','source_zip','source_entry','error'];
  fs.writeFileSync('resultado_carga_masiva.csv',[h.join(','),...rows.map(r=>h.map(k=>csvEscape(r[k])).join(','))].join('\n'),'utf8');
}
function loadManifest() {
  const raw=fs.readFileSync(C.manifestPath,'utf8').replace(/^\uFEFF/,'');
  return parse(raw,{columns:true,skip_empty_lines:true,relax_quotes:true});
}
async function fetchPurchases(supabase) {
  const rows=[]; const page=1000;
  const select=`id,${C.docCol},${C.attachmentCol},${C.providerCol},${C.dateCol}`;
  for(let from=0;;from+=page){
    const {data,error}=await supabase.from(C.table).select(select).range(from,from+page-1);
    if(error) throw new Error(`No se pudo leer ${C.table}: ${error.message}`);
    rows.push(...(data||[])); if(!data || data.length<page) break;
  }
  return rows;
}
function findPurchase(rows, m) {
  const mk=new Set(docKeys(m.documento));
  let cands=rows.filter(r=>docKeys(r[C.docCol]).some(k=>mk.has(k)));
  if(cands.length<=1) return {row:cands[0]||null, count:cands.length};
  const sameDate=cands.filter(r=>dateISOtoDMY(r[C.dateCol])===m.fecha);
  if(sameDate.length===1) return {row:sameDate[0],count:1};
  if(sameDate.length>0) cands=sameDate;
  const scored=cands.map(r=>({r,s:providerScore(m.proveedor,r[C.providerCol])})).sort((a,b)=>b.s-a.s);
  if(scored.length && scored[0].s>=0.75 && (scored.length===1 || scored[0].s-scored[1].s>=0.25)) return {row:scored[0].r,count:1};
  return {row:null,count:cands.length};
}
async function exists(supabase, storagePath) {
  const parts=storagePath.split('/'); const file=parts.pop(); const folder=parts.join('/');
  const {data,error}=await supabase.storage.from(C.bucket).list(folder,{limit:100,search:file});
  if(error) return false; return (data||[]).some(x=>x.name===file);
}

async function main(){
  if(!fs.existsSync(C.manifestPath)) throw new Error(`No existe manifiesto: ${C.manifestPath}`);
  if(!fs.existsSync(C.zipsDir)) throw new Error(`No existe carpeta zips: ${C.zipsDir}`);
  if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Faltan credenciales Supabase en .env');
  const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:bucket,error:be}=await supabase.storage.getBucket(C.bucket);
  if(be || !bucket) throw new Error(`No se pudo abrir bucket ${C.bucket}: ${be?.message||'no existe'}`);
  const manifest=loadManifest();
  const ready=manifest.filter(r=>String(r.status).toUpperCase()==='OK');
  const review=manifest.filter(r=>String(r.status).toUpperCase()!=='OK');
  const purchases=await fetchPurchases(supabase);
  const zipCache=new Map(); const results=[];
  console.log('\n============================================================');
  console.log(' FESTOS - CARGA MASIVA 183 PDF UNICOS');
  console.log('============================================================');
  console.log(`Modo: ${C.dryRun?'PRUEBA (NO MODIFICA)':'REAL'}`);
  console.log(`Listos: ${ready.length} | En revisión: ${review.length} | Compras BD: ${purchases.length}\n`);

  for(let i=0;i<ready.length;i++){
    const m=ready[i], prefix=`[${i+1}/${ready.length}]`;
    try{
      const fp=findPurchase(purchases,m);
      if(!fp.row) throw new Error(`Compra no única en BD para ${m.documento} (candidatos: ${fp.count})`);
      const purchase=fp.row;
      const ym=yyyymm(m.fecha); if(!ym) throw new Error(`Fecha inválida: ${m.fecha}`);
      const filename=`${ym}_${safe(m.proveedor)}_${safe(m.documento)}.pdf`;
      const storagePath=`${purchase.id}/pdf/${filename}`;
      const old=purchase[C.attachmentCol]||'';
      if(old && old!==storagePath && !C.overwriteExisting){
        console.log(`${prefix} YA TENIA ADJUNTO: ${m.documento}`);
        results.push({original:m.original,status:'YA TENIA ADJUNTO',documento:m.documento,proveedor:m.proveedor,fecha:m.fecha,compra_id:purchase.id,storage_path:old,db_path_anterior:old,source_zip:m.zip,source_entry:m.entry,error:''});
        continue;
      }
      if(C.dryRun){
        console.log(`${prefix} OK ${m.documento} -> ${storagePath}`);
        results.push({original:m.original,status:'LISTO',documento:m.documento,proveedor:m.proveedor,fecha:m.fecha,compra_id:purchase.id,storage_path:storagePath,db_path_anterior:old,source_zip:m.zip,source_entry:m.entry,error:''});
        continue;
      }
      const zipPath=path.join(C.zipsDir,m.zip);
      if(!fs.existsSync(zipPath)) throw new Error(`No existe ZIP: ${zipPath}`);
      let zip=zipCache.get(zipPath); if(!zip){zip=new AdmZip(zipPath);zipCache.set(zipPath,zip);}
      const entry=zip.getEntry(m.entry); if(!entry) throw new Error(`No existe entrada: ${m.entry}`);
      const buf=entry.getData();
      const hash=crypto.createHash('sha256').update(buf).digest('hex');
      if(m.sha256 && hash!==m.sha256) throw new Error('El PDF no coincide con el hash del manifiesto');
      const {error:up}=await supabase.storage.from(C.bucket).upload(storagePath,buf,{contentType:'application/pdf',upsert:false,cacheControl:'3600'});
      let st='SUBIDO';
      if(up){ const msg=String(up.message||up).toLowerCase(); if(msg.includes('already exists')||msg.includes('duplicate')||msg.includes('resource already exists')) st='YA EXISTIA'; else throw new Error(`Storage: ${up.message}`); }
      if(C.verifyAfterUpload && !(await exists(supabase,storagePath))) throw new Error('No se pudo verificar el PDF en Storage');
      if(C.updateDatabase){
        const {error:db}=await supabase.from(C.table).update({[C.attachmentCol]:storagePath}).eq('id',purchase.id);
        if(db) throw new Error(`BD: ${db.message}`);
      }
      console.log(`${prefix} ${st}${C.updateDatabase?' + VINCULADO':''}: ${m.documento}`);
      results.push({original:m.original,status:`${st}${C.updateDatabase?' + VINCULADO':''}`,documento:m.documento,proveedor:m.proveedor,fecha:m.fecha,compra_id:purchase.id,storage_path:storagePath,db_path_anterior:old,source_zip:m.zip,source_entry:m.entry,error:''});
    }catch(e){
      console.log(`${prefix} ERROR ${m.original}: ${e.message}`);
      results.push({original:m.original,status:'ERROR',documento:m.documento,proveedor:m.proveedor,fecha:m.fecha,compra_id:'',storage_path:'',db_path_anterior:'',source_zip:m.zip,source_entry:m.entry,error:e.message});
    }
  }
  for(const m of review){
    results.push({original:m.original,status:'REVISAR - NO CARGADO',documento:m.documento,proveedor:m.proveedor,fecha:m.fecha,compra_id:'',storage_path:'',db_path_anterior:'',source_zip:m.zip,source_entry:m.entry,error:'No existe coincidencia segura en el CSV'});
  }
  writeReport(results);
  const ok=results.filter(r=>['LISTO','SUBIDO + VINCULADO','YA EXISTIA + VINCULADO','YA TENIA ADJUNTO'].includes(r.status)).length;
  const fail=results.length-ok;
  console.log('\n============================================================');
  console.log(` TERMINADO: ${ok} procesables/correctos | ${fail} revisar | ${results.length} únicos`);
  console.log(' Reporte: resultado_carga_masiva.csv');
  console.log('============================================================\n');
}
main().catch(e=>{console.error('\nERROR GENERAL:',e.message);process.exit(1);});
