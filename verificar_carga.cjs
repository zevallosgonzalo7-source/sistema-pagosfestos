const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ override: false });

const bucket = process.env.SUPABASE_BUCKET || 'compras-adjuntos';

function decode(buf) {
  const s = buf.toString('utf8');
  return s.includes('\uFFFD') ? buf.toString('latin1') : s;
}

async function exists(supabase, p) {
  const parts = p.split('/');
  const name = parts.pop();
  const folder = parts.join('/');
  const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 100, search: name });
  return { ok: !error && (data || []).some(x => x.name === name), error: error?.message || '' };
}

async function main() {
  if (!fs.existsSync('resultado_carga.csv')) throw new Error('No existe resultado_carga.csv. Ejecuta primero la carga.');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Faltan credenciales en .env');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const rows = parse(decode(fs.readFileSync('resultado_carga.csv')), { columns: true, skip_empty_lines: true });
  const targets = rows.filter(r => r.storage_path && r.compra_id);
  let ok = 0, fail = 0;
  console.log(`\nVerificando ${targets.length} rutas...\n`);
  for (let i = 0; i < targets.length; i++) {
    const r = targets[i];
    const check = await exists(supabase, r.storage_path);
    const { data, error } = await supabase.from(process.env.SUPABASE_TABLE || 'compras')
      .select(`id,${process.env.DB_ATTACHMENT_COLUMN || 'pdf_factura_path'}`)
      .eq('id', r.compra_id).maybeSingle();
    const dbPath = data?.[process.env.DB_ATTACHMENT_COLUMN || 'pdf_factura_path'] || '';
    const dbOk = !error && dbPath === r.storage_path;
    if (check.ok && dbOk) {
      ok++;
      console.log(`[${i+1}/${targets.length}] OK ${r.documento}`);
    } else {
      fail++;
      console.log(`[${i+1}/${targets.length}] REVISAR ${r.documento} | Storage=${check.ok ? 'OK' : 'NO'} | BD=${dbOk ? 'OK' : 'NO'}`);
    }
  }
  console.log(`\nVERIFICACION: ${ok} OK | ${fail} por revisar\n`);
  if (fail) process.exitCode = 2;
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
