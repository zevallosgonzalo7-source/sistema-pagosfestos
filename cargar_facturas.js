const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const AdmZip = require('adm-zip');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const CONFIG = {
  csvPath: process.env.CSV_PATH || './Data para COMPRAS Y PROVEEDORES(REG(1).csv',
  zipPath: process.env.ZIP_PATH || './FACTURAS.zip',
  dryRun: String(process.env.DRY_RUN ?? 'true').toLowerCase() === 'true',
  bucket: process.env.SUPABASE_BUCKET || 'compras-adjuntos',
  storageFolder: process.env.STORAGE_FOLDER || 'compras',
  updateDatabase: String(process.env.UPDATE_DATABASE ?? 'false').toLowerCase() === 'true',
  table: process.env.SUPABASE_TABLE || 'compras',
  dbDocColumn: process.env.DB_DOC_COLUMN || 'numero_documento',
  dbAttachmentColumn: process.env.DB_ATTACHMENT_COLUMN || 'archivo_path',
};

function cleanText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// Nombre seguro para Supabase Storage: sin tildes ni caracteres inválidos.
function safeFilePart(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*#%{}\[\]`]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim();
}

function normalizeDoc(value = '') {
  const raw = cleanText(value).replace(/\s/g, '');
  const match = raw.match(/^([A-Z0-9]+)-0*([0-9]+)$/);
  if (!match) return raw;
  return `${match[1]}-${Number(match[2])}`;
}

function splitPdfName(filename) {
  const base = path.basename(filename, path.extname(filename)).replace(/\s*\(\d+\)\s*$/, '');
  const idx = base.lastIndexOf('_');
  if (idx === -1) return { provider: base, doc: '' };
  return {
    provider: base.slice(0, idx).trim(),
    doc: base.slice(idx + 1).trim(),
  };
}

function parseDateDDMMYYYY(value) {
  const m = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return { day: m[1].padStart(2, '0'), month: m[2].padStart(2, '0'), year: m[3] };
}

function loadCsv(csvPath) {
  const buf = fs.readFileSync(csvPath);
  // El CSV exportado desde Excel suele venir en Windows-1252/Latin-1.
  const text = buf.toString('latin1');
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

function findMatch(records, pdfName) {
  const parsed = splitPdfName(pdfName);
  const providerKey = cleanText(parsed.provider);
  const docKey = normalizeDoc(parsed.doc);

  let candidates = records.filter(r => r.docKey === docKey);
  if (candidates.length === 1) return { match: candidates[0], parsed, method: 'documento-normalizado' };

  const exactProvider = candidates.find(r => r.providerKey === providerKey);
  if (exactProvider) return { match: exactProvider, parsed, method: 'documento+proveedor' };

  candidates = records.filter(r => r.providerKey === providerKey && r.docKey === docKey);
  if (candidates.length) return { match: candidates[0], parsed, method: 'proveedor+documento-normalizado' };

  return { match: null, parsed, method: 'sin-coincidencia' };
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const records = loadCsv(CONFIG.csvPath);
  const zip = new AdmZip(CONFIG.zipPath);
  const pdfEntries = zip.getEntries().filter(e => !e.isDirectory && e.entryName.toLowerCase().endsWith('.pdf'));

  console.log('\nFESTOS - CARGA MASIVA DE ADJUNTOS');
  console.log(`Modo: ${CONFIG.dryRun ? 'PRUEBA (NO SUBE NADA)' : 'REAL'}`);
  console.log(`PDF encontrados: ${pdfEntries.length}\n`);

  let supabase = null;
  if (!CONFIG.dryRun) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env');
    }
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }

  const results = [];

  for (const entry of pdfEntries) {
    const fileName = path.basename(entry.entryName);

    try {
      const { match, parsed, method } = findMatch(records, fileName);

      if (!match) {
        console.log(`X SIN COINCIDENCIA: ${fileName}`);
        results.push({ original: fileName, estado: 'SIN COINCIDENCIA', proveedor: parsed.provider, documento: parsed.doc, nuevo_nombre: '', storage_path: '' });
        continue;
      }

      const date = parseDateDDMMYYYY(match.fecha);
      if (!date) {
        console.log(`! FECHA INVALIDA: ${fileName} -> ${match.fecha}`);
        results.push({ original: fileName, estado: 'FECHA INVALIDA', proveedor: match.proveedor, documento: match.doc, nuevo_nombre: '', storage_path: '' });
        continue;
      }

      const yyyymm = `${date.year}${date.month}`;
      const newName = `${yyyymm}_${safeFilePart(match.proveedor)}_${safeFilePart(match.doc)}.pdf`;
      const storagePath = `${CONFIG.storageFolder}/${date.year}/${date.month}/${newName}`;

      if (CONFIG.dryRun) {
        console.log(`OK ${fileName}`);
        console.log(`   CSV: ${match.fecha} | ${match.proveedor} | ${match.tipo} | ${match.doc}`);
        console.log(`   -> ${newName}`);
        results.push({
          original: fileName, estado: 'LISTO PARA SUBIR', fecha: match.fecha, proveedor: match.proveedor,
          tipo: match.tipo, documento: match.doc, metodo: method, nuevo_nombre: newName, storage_path: storagePath,
        });
        continue;
      }

      const data = entry.getData();
      const { error: uploadError } = await supabase.storage
        .from(CONFIG.bucket)
        .upload(storagePath, data, { contentType: 'application/pdf', upsert: false });

      let estado = 'SUBIDO';
      if (uploadError) {
        const msg = String(uploadError.message || uploadError).toLowerCase();
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          estado = 'YA EXISTIA';
          console.log(`= YA EXISTIA: ${storagePath}`);
        } else {
          console.log(`X ERROR SUBIENDO: ${fileName}`);
          console.log(`   ${uploadError.message}`);
          results.push({
            original: fileName, estado: 'ERROR SUBIENDO', fecha: match.fecha, proveedor: match.proveedor,
            tipo: match.tipo, documento: match.doc, metodo: method, nuevo_nombre: newName,
            storage_path: storagePath, error: uploadError.message,
          });
          continue;
        }
      } else {
        console.log(`SUBIDO: ${storagePath}`);
      }

      if (CONFIG.updateDatabase) {
        const { error: dbError } = await supabase
          .from(CONFIG.table)
          .update({ [CONFIG.dbAttachmentColumn]: storagePath })
          .eq(CONFIG.dbDocColumn, match.doc);

        if (dbError) {
          console.log(`! SUBIDO PERO ERROR ACTUALIZANDO BD: ${match.doc}`);
          console.log(`   ${dbError.message}`);
          results.push({
            original: fileName, estado: 'SUBIDO / ERROR BD', fecha: match.fecha, proveedor: match.proveedor,
            tipo: match.tipo, documento: match.doc, metodo: method, nuevo_nombre: newName,
            storage_path: storagePath, error: dbError.message,
          });
          continue;
        }
      }

      results.push({
        original: fileName, estado, fecha: match.fecha, proveedor: match.proveedor,
        tipo: match.tipo, documento: match.doc, metodo: method, nuevo_nombre: newName, storage_path: storagePath,
      });
    } catch (error) {
      console.log(`X ERROR EN ARCHIVO: ${fileName}`);
      console.log(`   ${error.message}`);
      results.push({ original: fileName, estado: 'ERROR', error: error.message });
      // MUY IMPORTANTE: continúa con el siguiente PDF.
    }
  }

  const headers = ['original','estado','fecha','proveedor','tipo','documento','metodo','nuevo_nombre','storage_path','error'];
  const out = [headers.join(',')]
    .concat(results.map(r => headers.map(h => csvEscape(r[h])).join(',')))
    .join('\n');
  fs.writeFileSync('resultado_carga.csv', out, 'utf8');

  const ok = results.filter(r => ['LISTO PARA SUBIR','SUBIDO','YA EXISTIA'].includes(r.estado)).length;
  const fail = results.length - ok;
  console.log(`\nRESUMEN: ${ok} correctos | ${fail} por revisar | total ${results.length}`);
  console.log('Reporte: resultado_carga.csv\n');
}

main().catch(err => {
  console.error('\nERROR GENERAL:', err.message);
  process.exit(1);
});
