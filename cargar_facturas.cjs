const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const AdmZip = require('adm-zip');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ override: false });

const CONFIG = {
  csvPath: process.env.CSV_PATH || './Data para COMPRAS Y PROVEEDORES(REG(1).csv',
  zipPath: process.env.ZIP_PATH || './FACTURAS.zip',
  dryRun: String(process.env.DRY_RUN ?? 'true').toLowerCase() === 'true',
  bucket: process.env.SUPABASE_BUCKET || 'compras-adjuntos',
  table: process.env.SUPABASE_TABLE || 'compras',
  dbDocColumn: process.env.DB_DOC_COLUMN || 'numero_documento',
  dbAttachmentColumn: process.env.DB_ATTACHMENT_COLUMN || 'pdf_factura_path',
  updateDatabase: String(process.env.UPDATE_DATABASE ?? 'true').toLowerCase() === 'true',
  verifyAfterUpload: String(process.env.VERIFY_AFTER_UPLOAD ?? 'true').toLowerCase() === 'true',
};

function removeAccents(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function cleanText(value = '') {
  return removeAccents(value).replace(/\s+/g, ' ').trim().toUpperCase();
}

function safeFilePart(value = '') {
  return removeAccents(value)
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\-.]+|[_\-.]+$/g, '')
    .toUpperCase();
}

function normalizeDoc(value = '') {
  const raw = cleanText(value).replace(/\s/g, '');
  const m = raw.match(/^([A-Z0-9]+)-0*([0-9]+)$/);
  if (!m) return raw;
  return `${m[1]}-${Number(m[2])}`;
}

function splitPdfName(filename) {
  const base = path.basename(filename, path.extname(filename)).replace(/\s*\(\d+\)\s*$/, '');
  const idx = base.lastIndexOf('_');
  if (idx === -1) return { provider: base, doc: '' };
  return { provider: base.slice(0, idx).trim(), doc: base.slice(idx + 1).trim() };
}

function parseDateDDMMYYYY(value) {
  const m = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return { day: m[1].padStart(2, '0'), month: m[2].padStart(2, '0'), year: m[3] };
}

function decodeCsv(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.toString('utf8').replace(/^\uFEFF/, '');
  }
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  return buf.toString('latin1');
}

function loadCsv(csvPath) {
  const text = decodeCsv(fs.readFileSync(csvPath));
  const rows = parse(text, { relax_column_count: true, skip_empty_lines: false });
  const headerIndex = rows.findIndex(r => cleanText(r[0]) === 'F.EMISION' && cleanText(r[3]) === 'PROVEEDOR');
  if (headerIndex < 0) throw new Error('No se encontró la cabecera F.EMISION / PROVEEDOR en el CSV.');

  const headers = rows[headerIndex].map(h => cleanText(h));
  const pos = {
    fecha: headers.indexOf('F.EMISION'),
    proveedor: headers.indexOf('PROVEEDOR'),
    tipo: headers.indexOf('T.DOC'),
    doc: headers.indexOf('N°DOC'),
  };
  if (Object.values(pos).some(i => i < 0)) throw new Error('Faltan columnas requeridas en el CSV.');

  return rows.slice(headerIndex + 1)
    .filter(r => r[pos.fecha] && r[pos.proveedor] && r[pos.doc])
    .map((r, i) => ({
      csvRow: headerIndex + 2 + i,
      fecha: String(r[pos.fecha]).trim(),
      proveedor: String(r[pos.proveedor]).trim(),
      tipo: String(r[pos.tipo] || '').trim(),
      doc: String(r[pos.doc]).trim(),
      providerKey: cleanText(r[pos.proveedor]),
      docKey: normalizeDoc(r[pos.doc]),
    }));
}

function findCsvMatch(records, pdfName) {
  const parsed = splitPdfName(pdfName);
  const providerKey = cleanText(parsed.provider);
  const docKey = normalizeDoc(parsed.doc);

  const byDoc = records.filter(r => r.docKey === docKey);
  if (byDoc.length === 1) return { match: byDoc[0], parsed, method: 'documento-normalizado' };

  const byDocProvider = byDoc.filter(r => r.providerKey === providerKey);
  if (byDocProvider.length === 1) return { match: byDocProvider[0], parsed, method: 'documento+proveedor' };

  return { match: null, parsed, method: byDoc.length > 1 ? 'documento-ambiguo' : 'sin-coincidencia' };
}

async function fetchAllPurchases(supabase) {
  const all = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(CONFIG.table)
      .select(`id,${CONFIG.dbDocColumn},${CONFIG.dbAttachmentColumn}`)
      .range(from, to);
    if (error) throw new Error(`No se pudo leer ${CONFIG.table}: ${error.message}`);
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

function buildDbIndex(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = normalizeDoc(row[CONFIG.dbDocColumn]);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

async function pathExists(supabase, storagePath) {
  const folder = storagePath.split('/').slice(0, -1).join('/');
  const file = storagePath.split('/').pop();
  const { data, error } = await supabase.storage.from(CONFIG.bucket).list(folder, {
    limit: 100,
    search: file,
  });
  if (error) return { exists: false, error: error.message };
  return { exists: (data || []).some(x => x.name === file), error: '' };
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeReport(results) {
  const headers = [
    'original','estado','fecha','proveedor','tipo','documento','compra_id','metodo',
    'nuevo_nombre','storage_path','db_path_anterior','error'
  ];
  const output = [headers.join(',')]
    .concat(results.map(r => headers.map(h => csvEscape(r[h])).join(',')))
    .join('\n');
  fs.writeFileSync('resultado_carga.csv', output, 'utf8');
}

async function main() {
  if (!fs.existsSync(CONFIG.csvPath)) throw new Error(`No existe el CSV: ${CONFIG.csvPath}`);
  if (!fs.existsSync(CONFIG.zipPath)) throw new Error(`No existe el ZIP: ${CONFIG.zipPath}`);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env');
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: bucketInfo, error: bucketError } = await supabase.storage.getBucket(CONFIG.bucket);
  if (bucketError || !bucketInfo) throw new Error(`No se pudo abrir el bucket ${CONFIG.bucket}: ${bucketError?.message || 'no existe'}`);

  const csvRecords = loadCsv(CONFIG.csvPath);
  const purchases = await fetchAllPurchases(supabase);
  const dbIndex = buildDbIndex(purchases);

  const zip = new AdmZip(CONFIG.zipPath);
  const pdfEntries = zip.getEntries().filter(e => !e.isDirectory && e.entryName.toLowerCase().endsWith('.pdf'));

  console.log('\n============================================================');
  console.log(' FESTOS - CARGA MASIVA DEFINITIVA DE FACTURAS');
  console.log('============================================================');
  console.log(`Modo: ${CONFIG.dryRun ? 'PRUEBA / NO MODIFICA STORAGE NI BD' : 'REAL'}`);
  console.log(`Bucket: ${CONFIG.bucket}`);
  console.log(`Tabla: ${CONFIG.table}`);
  console.log(`PDF encontrados: ${pdfEntries.length}`);
  console.log(`Compras leídas de BD: ${purchases.length}\n`);

  const results = [];

  for (let i = 0; i < pdfEntries.length; i++) {
    const entry = pdfEntries[i];
    const original = path.basename(entry.entryName);
    const prefix = `[${i + 1}/${pdfEntries.length}]`;

    try {
      const { match, parsed, method } = findCsvMatch(csvRecords, original);
      if (!match) {
        console.log(`${prefix} REVISAR CSV: ${original}`);
        results.push({ original, estado: 'SIN COINCIDENCIA CSV', proveedor: parsed.provider, documento: parsed.doc, metodo: method });
        continue;
      }

      const date = parseDateDDMMYYYY(match.fecha);
      if (!date) {
        console.log(`${prefix} FECHA INVALIDA: ${original} -> ${match.fecha}`);
        results.push({ original, estado: 'FECHA INVALIDA', fecha: match.fecha, proveedor: match.proveedor, documento: match.doc });
        continue;
      }

      const dbCandidates = dbIndex.get(normalizeDoc(match.doc)) || [];
      if (dbCandidates.length === 0) {
        console.log(`${prefix} NO EXISTE EN COMPRAS: ${match.doc}`);
        results.push({ original, estado: 'NO EXISTE EN BD', fecha: match.fecha, proveedor: match.proveedor, tipo: match.tipo, documento: match.doc });
        continue;
      }
      if (dbCandidates.length > 1) {
        console.log(`${prefix} DOCUMENTO DUPLICADO EN BD (${dbCandidates.length}): ${match.doc}`);
        results.push({ original, estado: 'DOCUMENTO DUPLICADO EN BD', fecha: match.fecha, proveedor: match.proveedor, tipo: match.tipo, documento: match.doc, error: `${dbCandidates.length} compras coinciden` });
        continue;
      }

      const purchase = dbCandidates[0];
      const yyyymm = `${date.year}${date.month}`;
      const newName = `${yyyymm}_${safeFilePart(match.proveedor)}_${safeFilePart(match.doc)}.pdf`;
      const storagePath = `${purchase.id}/pdf/${newName}`;
      const dbPathBefore = purchase[CONFIG.dbAttachmentColumn] || '';

      if (CONFIG.dryRun) {
        console.log(`${prefix} OK ${match.doc}`);
        console.log(`    Compra ID : ${purchase.id}`);
        console.log(`    Storage   : ${storagePath}`);
        console.log(`    BD        : ${CONFIG.dbAttachmentColumn} = ${storagePath}`);
        results.push({
          original, estado: 'LISTO', fecha: match.fecha, proveedor: match.proveedor, tipo: match.tipo,
          documento: match.doc, compra_id: purchase.id, metodo: method, nuevo_nombre: newName,
          storage_path: storagePath, db_path_anterior: dbPathBefore,
        });
        continue;
      }

      const buffer = entry.getData();
      const { error: uploadError } = await supabase.storage
        .from(CONFIG.bucket)
        .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false, cacheControl: '3600' });

      let storageState = 'SUBIDO';
      if (uploadError) {
        const msg = String(uploadError.message || uploadError).toLowerCase();
        if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('resource already exists')) {
          storageState = 'YA EXISTIA';
        } else {
          throw new Error(`Storage: ${uploadError.message}`);
        }
      }

      if (CONFIG.verifyAfterUpload) {
        const check = await pathExists(supabase, storagePath);
        if (!check.exists) throw new Error(`Verificación Storage falló${check.error ? `: ${check.error}` : ''}`);
      }

      if (CONFIG.updateDatabase) {
        const { error: dbError } = await supabase
          .from(CONFIG.table)
          .update({ [CONFIG.dbAttachmentColumn]: storagePath })
          .eq('id', purchase.id);
        if (dbError) throw new Error(`BD: ${dbError.message}`);
      }

      const estado = CONFIG.updateDatabase ? `${storageState} + VINCULADO` : storageState;
      console.log(`${prefix} ${estado}: ${match.doc}`);
      console.log(`    ${storagePath}`);
      results.push({
        original, estado, fecha: match.fecha, proveedor: match.proveedor, tipo: match.tipo,
        documento: match.doc, compra_id: purchase.id, metodo: method, nuevo_nombre: newName,
        storage_path: storagePath, db_path_anterior: dbPathBefore,
      });
    } catch (error) {
      console.log(`${prefix} ERROR: ${original}`);
      console.log(`    ${error.message}`);
      results.push({ original, estado: 'ERROR', error: error.message });
    }
  }

  writeReport(results);
  const okStates = ['LISTO','SUBIDO','YA EXISTIA','SUBIDO + VINCULADO','YA EXISTIA + VINCULADO'];
  const ok = results.filter(r => okStates.includes(r.estado)).length;
  const fail = results.length - ok;

  console.log('\n============================================================');
  console.log(` TERMINADO: ${ok} correctos | ${fail} por revisar | ${results.length} total`);
  console.log(' Reporte: resultado_carga.csv');
  console.log('============================================================\n');

  if (fail > 0) process.exitCode = 2;
}

main().catch(err => {
  console.error('\nERROR GENERAL:', err.message);
  process.exit(1);
});
