import { CATEGORIAS_FESTOS } from '../categories.js';
// Comandos locales de FESTOS: no se envian datos a un modelo de IA.
// Los resultados son borradores; nunca ejecutan escritura ni aprobacion.
export const cleanSpeech = (value = '') => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

const numericWords = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, treinta: 30, cuarenta: 40,
  cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400,
  quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900
};
export function speechNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  let text = cleanSpeech(value).replace(/\b(soles|sol|pen|s\/|unidades|unidad)\b/g, '').trim();
  const digits = text.match(/\d[\d.,\s]*/);
  if (digits) {
    let raw = digits[0].trim().replace(/\s+/g, '');
    if (raw.includes(',') && raw.includes('.')) raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
    else if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) raw = raw.replace(/[.,]/g, '');
    else if (raw.includes(',')) raw = raw.replace(',', '.');
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return /\bmil\b/.test(text) ? parsed * 1000 : parsed;
  }
  text = text.replace(/veintiuno/g, 'veinte y uno').replace(/veintidos/g, 'veinte y dos').replace(/veintitres/g, 'veinte y tres').replace(/veinticuatro/g, 'veinte y cuatro').replace(/veinticinco/g, 'veinte y cinco').replace(/veintiseis/g, 'veinte y seis').replace(/veintisiete/g, 'veinte y siete').replace(/veintiocho/g, 'veinte y ocho').replace(/veintinueve/g, 'veinte y nueve');
  let total = 0; let block = 0; let found = false;
  for (const word of text.split(/\s+|-/).filter(Boolean)) {
    if (word === 'y') continue;
    if (word === 'mil') { total += (block || 1) * 1000; block = 0; found = true; continue; }
    if (word === 'millon' || word === 'millones') { total += (block || 1) * 1000000; block = 0; found = true; continue; }
    if (!(word in numericWords)) return null;
    block += numericWords[word]; found = true;
  }
  return found ? total + block : null;
}

const LABELS = [
  ['project_name', '(?:nombre del proyecto|proyecto(?: llamado| denominado)?|llamado|llamada)'],
  ['client_name', '(?:para el cliente|para la empresa|cliente|para cliente)'],
  ['executive', '(?:ejecutivo|ejecutiva|asignado a|asignada a)'],
  ['lob', '(?:categoria del item|categoria del articulo|categoria de item)'],
  ['lob', '(?:categoria general|categoria del proyecto|categoria de la cotizacion|categoria|linea de negocio|lob)'],
  ['status', '(?:estado)'],
  ['description', '(?:descripcion(?: del proyecto)?|alcance|detalle general)'],
  ['item_description', '(?:agrega(?:r)? (?:un )?item|anade(?:r)? (?:un )?item|item|concepto|producto|servicio)'],
  ['quantity', '(?:cantidad)'],
  ['unit_price', '(?:valor unitario|precio unitario)'],
  ['unit_cost', '(?:costo unitario)'],
  ['sale_value', '(?:valor de venta total|valor venta total|valor de venta|valor venta|precio total|importe total|subtotal)'],
  ['mode', '(?:modo)'],
];
const LABEL_RE = new RegExp(`\\b(${LABELS.map(x => x[1]).join('|')})\\b\\s*(?::|es|de|por|igual a)?\\s*`, 'gi');
function fieldFor(label) { return LABELS.find(([, re]) => new RegExp(`^(?:${re})$`, 'i').test(label))?.[0]; }
function valueText(text) { return text.replace(/^[\s,:;.-]+|[\s,:;.-]+$/g, '').replace(/\s+(?:y|con|por|para|en)\s*$/i, '').trim(); }
export function extractVoiceFields(utterance, kind) {
  const normalized = cleanSpeech(utterance);
  const found = [...normalized.matchAll(LABEL_RE)].map(m => ({ key: fieldFor(m[1]), start: m.index, end: m.index + m[0].length }));
  const fields = {};
  for (let i = 0; i < found.length; i += 1) {
    const entry = found[i];
    let value = valueText(utterance.slice(entry.end, found[i + 1]?.start ?? utterance.length));
    if (!value) continue;
    if (entry.key === 'project_name') value = value.replace(/^(?:de|para|es)\s+/i, '');
    if (entry.key === 'client_name') value = value.replace(/^(?:de|la empresa|la compania)\s+/i, '');
    if (['quantity', 'unit_price', 'unit_cost', 'sale_value'].includes(entry.key)) {
      const amount = speechNumber(value);
      if (amount !== null) fields[entry.key] = amount;
    } else if (entry.key === 'executive') {
      const executive = cleanSpeech(value);
      if (/\bmar\b/.test(executive)) fields.executive = 'MAR';
      else if (/\bgonzalo\b/.test(executive)) fields.executive = 'GONZALO';
    } else if (entry.key === 'lob' || entry.key === 'item_category') {
      const category = CATEGORIAS_FESTOS.find(c => cleanSpeech(c) === cleanSpeech(value))
        || CATEGORIAS_FESTOS.find(c => cleanSpeech(c).includes(cleanSpeech(value)) && cleanSpeech(value).length >= 5);
      if (category) fields[entry.key] = category;
    } else if (entry.key === 'status' && kind === 'project') {
      const state = cleanSpeech(value);
      if (/facturad/.test(state)) fields.status = 'FACTURADO';
      else if (/finalizad/.test(state)) fields.status = 'FINALIZADO';
      else if (/proceso/.test(state)) fields.status = 'EN PROCESO';
    } else if (entry.key === 'mode' && kind === 'quote') {
      const mode = cleanSpeech(value);
      if (/directo/.test(mode)) fields.mode = 'directo';
      else if (/detallado/.test(mode)) fields.mode = 'detallado';
    } else if (entry.key === 'item_description' && kind === 'quote') fields.item_description = value;
    else if (!['item_description', 'status', 'mode'].includes(entry.key)) fields[entry.key] = value;
  }
  return fields;
}
export function matchVoiceClient(clients, requested) {
  const term = cleanSpeech(requested).replace(/^(?:de|la|el)\s+/, '');
  if (!term) return { status: 'missing' };
  const available = clients.filter(c => c.estado !== false);
  const exact = available.filter(c => cleanSpeech(c.nombre) === term);
  const matches = exact.length ? exact : available.filter(c => cleanSpeech(c.nombre).includes(term));
  return matches.length === 1 ? { status: 'matched', id: matches[0].id, name: matches[0].nombre } : { status: matches.length ? 'ambiguous' : 'missing' };
}
export function interpretVoiceCommand(utterance, activeKind = '') {
  const text = cleanSpeech(utterance).replace(/^[.,;!\s]+|[.,;!\s]+$/g, '');
  if (!text) return { action: 'unknown' };
  if (/^(?:guarda|guardar|elimina|eliminar|borra|borrar|aprueba|aprobar|envia|enviar|publica|publicar|factura|facturar)\b/.test(text)) return { action: 'confirm-required' };
  const nav = [
    ['analisis_ventas', /\b(?:dashboard de ventas|dashboard ventas)\b/],
    ['analisis', /\b(?:dashboard general|dashboard proyectos|dashboard de proyectos|analisis ejecutivo|estadisticas|tablero)\b/],
    ['operaciones', /\b(?:centro de trabajo|calendario|kanban)\b/],
    ['clientes', /\bclientes\b/], ['proveedores', /\bproveedores\b/],
    ['cotizaciones', /\b(?:cotizaciones|cotizacion|presupuesto|propuesta comercial|coti)\b/],
    ['proyectos', /\bproyectos?\b/], ['roles', /\b(?:roles|permisos)\b/],
    ['perfil', /\b(?:perfil|mi cuenta)\b/], ['notificaciones', /\bnotificaciones\b/],
    ['dashboard', /\b(?:inicio|principal|dashboard)\b/],
  ];
  const isNew = /\b(?:crea|crear|creame|nuev[oa]|registrar|registra|prepara|preparar|haz|hacer|generar|genera)\b/.test(text);
  const wantsQuote = /\b(?:cotizaci[oó]n|cotizaciones|coti|presupuesto|propuesta comercial)\b/.test(text);
  const wantsProject = /\bproyectos?\b/.test(text);
  if (isNew && wantsQuote) return { action: 'draft', kind: 'quote', startNew: true, fields: extractVoiceFields(utterance, 'quote') };
  if (isNew && wantsProject) return { action: 'draft', kind: 'project', startNew: true, fields: extractVoiceFields(utterance, 'project') };
  if (/\b(?:abre|abrir|muestra|mostrar|ir a|ve a|entra a|cambia a|navega a|llevame a)\b/.test(text) || /^(?:inicio|dashboard|clientes|proveedores|proyectos|cotizaciones|centro de trabajo|dashboard general|roles|perfil|notificaciones)$/.test(text)) {
    const target = nav.find(([, re]) => re.test(text));
    if (target) return { action: 'navigate', target: target[0] };
  }
  const kind = activeKind === 'quote' || activeKind === 'project' ? activeKind : null;
  if (kind) {
    const fields = extractVoiceFields(utterance, kind);
    if (kind === 'quote' && /\b(?:agrega|agregar|anade|anadir)\s+(?:un\s+)?item\b/.test(text)) fields.append_item = true;
    if (Object.keys(fields).length) return { action: 'draft', kind, startNew: false, fields };
  }
  return { action: 'unknown' };
}
