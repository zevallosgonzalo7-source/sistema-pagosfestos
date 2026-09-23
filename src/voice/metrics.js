import { CATEGORIAS_FESTOS } from '../categories.js';
import { supabase } from '../supabaseClient';
import { classifyDashboardQuestion, dashboardPeriod, dateLocal } from './dashboardIntents';
export { classifyDashboardQuestion, dashboardPeriod } from './dashboardIntents';
import { cleanSpeech } from './commands';

const pen = n => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(n);
const num = n => Number.isFinite(Number(n)) ? Number(n) : 0;
const norm = value => cleanSpeech(value || '');
const projectValue = (p, related) => num(p.valor_base) > 0 ? num(p.valor_base) : num(p.valor_venta) > 0 ? num(p.valor_venta) : num(related?.subtotal);
const projectCost = (p, related) => num(p.costo_estimado) > 0 ? num(p.costo_estimado) : num(related?.costo_estimado);
const projectProfit = (p, related) => num(p.utilidad_proyectada) !== 0 ? num(p.utilidad_proyectada) : num(related?.ganancia_estimada) !== 0 ? num(related?.ganancia_estimada) : projectValue(p, related) - projectCost(p, related);
const count = n => new Intl.NumberFormat('es-PE').format(n);

async function loadAll(table, columns) {
  const rows = [];
  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).order('id', { ascending: true }).range(from, from + 999);
    if (error) throw new Error(`No puedo consultar ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
  throw new Error(`La consulta de ${table} superó el límite de registros. Ajusta el período antes de mostrar un total.`);
}

const date = value => String(value || '').slice(0, 10);
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const businessDate = row => date(row?.fecha_pedido || row?.created_at);
const inPeriod = (row, period) => (!period.start || businessDate(row) >= period.start) && (!period.end || businessDate(row) <= period.end);
const fmtScope = ({ period, exec, lob, status }) => `${period.label}${exec ? `, de ${exec}` : ''}${lob ? `, de ${lob}` : ''}${status ? `, ${status.toLowerCase()}` : ''}`;

export async function answerDashboardQuestion(utterance, permissions = {}) {
  const kind = classifyDashboardQuestion(utterance);
  if (!kind) return null;
  if (kind === 'unconnected') return 'El Dashboard ventas todavía es un diseño sin datos conectados. Puedo consultar el Dashboard proyectos.';
  const t = cleanSpeech(utterance);
  const exec = /\bmar\b/.test(t) ? 'MAR' : /\bgonzalo\b/.test(t) ? 'GONZALO' : null;
  const lob = CATEGORIAS_FESTOS.find(category => t.includes(norm(category))) || null;
  const status = /\bfacturad[oa]s?\b/.test(t) && kind !== 'quotes' ? 'FACTURADO' : /\bfinalizad[oa]s?\b/.test(t) ? 'FINALIZADO' : /\ben proceso\b/.test(t) ? 'EN PROCESO' : null;
  const period = dashboardPeriod(utterance);
  const scope = fmtScope({ period, exec, lob, status });
  const allow = p => !!permissions[p];
  const projectRequired = !['providers', 'providerCategories', 'quotes'].includes(kind);
  if (projectRequired && !allow('ver_proyectos')) return 'Tu usuario no tiene permiso para consultar los datos de proyectos.';
  if (['quotes', 'summary'].includes(kind) && !allow('ver_cotizaciones') && kind === 'quotes') return 'Tu usuario no tiene permiso para consultar cotizaciones.';
  if (['providers', 'providerCategories'].includes(kind) && !allow('ver_proveedores')) return 'Tu usuario no tiene permiso para consultar proveedores.';

  const projectsAll = projectRequired ? await loadAll('proyectos', '*') : [];
  const quotesAll = (allow('ver_cotizaciones') && (['quotes', 'summary'].includes(kind) || kind === 'topProject' || kind === 'topClients' || kind === 'sales' || kind === 'profit' || kind === 'margin' || kind === 'cost' || kind === 'monthly' || kind === 'lob' || kind === 'executives')) ? await loadAll('cotizaciones', '*') : [];
  const customersAll = allow('ver_clientes') && ['clients', 'topClients', 'summary'].includes(kind) ? await loadAll('clientes', 'id,nombre') : [];
  const providersAll = allow('ver_proveedores') && ['providers','providerCategories','summary'].includes(kind) ? await loadAll('proveedores', 'id,estado,categoria') : [];

  const projects = projectsAll.filter(p => inPeriod(p, period) && (!exec || norm(p.ejecutivo || p.created_by) === norm(exec)) && (!lob || norm(p.lob) === norm(lob)) && (!status || norm(p.estado) === norm(status)));
  const quotes = quotesAll.filter(q => inPeriod(q, period) && (!exec || norm(q.created_by) === norm(exec)) && (!lob || norm(q.lob) === norm(lob)));
  const quoteFor = p => quotesAll.find(q => q.project_id === p.id || (norm(q.proyecto_nombre) && norm(q.proyecto_nombre) === norm(p.nombre)));
  const value = p => projectValue(p, quoteFor(p));
  const cost = p => projectCost(p, quoteFor(p));
  const profit = p => projectProfit(p, quoteFor(p));
  const total = f => projects.reduce((s, p) => s + f(p), 0);
  const totalValue = total(value), totalCost = total(cost), totalProfit = total(profit);
  const filterInfo = ` ${scope}`;
  const periodNote = ' Estas cifras se calculan sobre el año actual por defecto, como el Dashboard proyectos. Puedes pedir «todo el historial» o «este mes».';

  if (kind === 'projects') return `Hay ${count(projects.length)} proyectos${filterInfo}.`;
  if (kind === 'sales') return `El valor de los proyectos sin IGV${filterInfo} es ${pen(totalValue)}.${periodNote}`;
  if (kind === 'profit') return `La utilidad proyectada${filterInfo} es ${pen(totalProfit)}.${periodNote}`;
  if (kind === 'cost') return `El costo estimado${filterInfo} es ${pen(totalCost)}.`;
  if (kind === 'margin') return projects.length && totalValue > 0 ? `El margen proyectado${filterInfo} es ${(totalProfit / totalValue * 100).toFixed(1)} por ciento.` : `No hay valor de venta suficiente para calcular el margen${filterInfo}.`;
  if (kind === 'status') {
    const counts = { proceso: 0, finalizado: 0, facturado: 0 };
    projects.forEach(p => { if (norm(p.estado) === 'finalizado') counts.finalizado++; else if (norm(p.estado) === 'facturado') counts.facturado++; else counts.proceso++; });
    return `Estado de proyectos${filterInfo}: ${count(counts.proceso)} en proceso, ${count(counts.finalizado)} finalizados y ${count(counts.facturado)} facturados.`;
  }
  if (kind === 'quotes') {
    const counts = { approved: 0, review: 0, draft: 0 };
    quotes.forEach(q => { const state = norm(q.estado); if (state === 'aprobado' || state === 'aprobada') counts.approved++; else if (state.includes('revisi')) counts.review++; else if (state === 'borrador') counts.draft++; });
    const requested = /\baprobadas?\b/.test(t) ? `Hay ${counts.approved} cotizaciones aprobadas` : /\brevision\b/.test(t) ? `Hay ${counts.review} cotizaciones en revisión` : /\bborrador\b/.test(t) ? `Hay ${counts.draft} cotizaciones en borrador` : `Hay ${count(quotes.length)} cotizaciones: ${counts.approved} aprobadas, ${counts.review} en revisión y ${counts.draft} en borrador`;
    return `${requested}, ${scope}.`;
  }
  if (kind === 'clients') {
    if (!allow('ver_clientes')) return 'No tienes permiso para consultar clientes.';
    const ids = new Set(projects.map(p => p.client_id).filter(Boolean));
    return `Hay ${count(ids.size)} clientes vinculados a proyectos ${scope}. El directorio contiene ${count(customersAll.length)} clientes accesibles para tu cuenta.`;
  }
  if (kind === 'providers') return `Hay ${count(providersAll.filter(p => p.estado !== false).length)} proveedores activos y ${count(providersAll.length)} registrados en el directorio.`;
  if (kind === 'providerCategories') {
    const categories = new Map();
    providersAll.forEach(p => { const category = p.categoria || 'Sin categoría'; categories.set(category, (categories.get(category) || 0) + 1); });
    return categories.size ? `Proveedores por categoría: ${[...categories].sort((a,b) => b[1] - a[1]).slice(0,6).map(([name,n]) => `${name}, ${n}`).join('; ')}.` : 'No hay proveedores para mostrar por categoría.';
  }
  if (kind === 'lob') {
    const group = new Map();
    projects.forEach(p => { const label = p.lob || 'Sin categoría'; group.set(label, (group.get(label) || 0) + value(p)); });
    return group.size ? `Valor sin IGV por categoría ${scope}: ${[...group].sort((a,b) => b[1] - a[1]).map(([name,n]) => `${name}, ${pen(n)}`).join('; ')}.` : `No hay proyectos con esos filtros ${scope}.`;
  }
  if (kind === 'executives') {
    const group = new Map();
    projects.forEach(p => { const name = (p.ejecutivo || p.created_by || 'Sin ejecutivo').toUpperCase(); group.set(name, (group.get(name) || 0) + value(p)); });
    return group.size ? `Participación por ejecutivo comercial ${scope}: ${[...group].sort((a,b) => b[1] - a[1]).map(([name,n]) => `${name}, ${pen(n)}`).join('; ')}.` : `No hay proyectos con esos filtros ${scope}.`;
  }
  if (kind === 'monthly') {
    const group = new Map();
    projects.forEach(p => { const month = businessDate(p).slice(0,7); if (month) group.set(month, (group.get(month) || 0) + value(p)); });
    return group.size ? `Valor sin IGV por mes ${scope}: ${[...group].sort((a,b) => a[0].localeCompare(b[0])).map(([month,n]) => `${new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric'}).format(new Date(`${month}-02T12:00:00`))}, ${pen(n)}`).join('; ')}.` : `No hay proyectos por mes ${scope}.`;
  }
  if (kind === 'topProject') {
    const requestedCost = /\b(?:costo|gasto|costoso)\b/.test(t);
    const sorted = [...projects].sort((a,b) => (requestedCost ? cost(b) - cost(a) : value(b) - value(a)));
    return sorted.length ? `El proyecto con mayor ${requestedCost ? 'costo estimado' : 'valor sin IGV'} ${scope} es ${sorted[0].nombre || sorted[0].codigo || 'sin nombre'}, código ${sorted[0].codigo || 'no registrado'}, con ${pen(requestedCost ? cost(sorted[0]) : value(sorted[0]))}.` : `No hay proyectos con esos filtros ${scope}.`;
  }
  if (kind === 'topClients') {
    if (!allow('ver_clientes')) return 'No tienes permiso para consultar clientes.';
    const group = new Map();
    projects.forEach(p => { const name = customersAll.find(c => c.id === p.client_id)?.nombre || 'Cliente sin nombre'; group.set(name, (group.get(name) || 0) + value(p)); });
    return group.size ? `Clientes por valor de proyectos sin IGV ${scope}: ${[...group].sort((a,b) => b[1] - a[1]).slice(0,5).map(([name,n]) => `${name}, ${pen(n)}`).join('; ')}.` : `No hay clientes vinculados a proyectos ${scope}.`;
  }
  if (kind === 'overdue' || kind === 'due') {
    const available = projectsAll.some(p => Object.prototype.hasOwnProperty.call(p, 'fecha_entrega'));
    if (!available) return 'El Dashboard no tiene fechas de entrega configuradas; no puedo informar vencimientos todavía.';
    const today = todayKey(), deadline = dateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()+7));
    const open = projects.filter(p => !['FINALIZADO','FACTURADO'].includes(String(p.estado || '').toUpperCase()) && p.fecha_entrega);
    const found = open.filter(p => kind === 'overdue' ? date(p.fecha_entrega) < today : date(p.fecha_entrega) >= today && date(p.fecha_entrega) <= deadline);
    return `Hay ${found.length} proyectos ${kind === 'overdue' ? 'con fecha de entrega vencida' : 'con entrega en los próximos siete días'} ${scope}.`;
  }
  if (kind === 'summary') {
    const projectCounts = ['EN PROCESO', 'FINALIZADO', 'FACTURADO'].map(s => projects.filter(p => norm(p.estado) === norm(s)).length);
    const clientCount = new Set(projects.map(p => p.client_id).filter(Boolean)).size;
    const quotesText = allow('ver_cotizaciones') ? `; ${quotes.filter(q => norm(q.estado) === 'aprobado' || norm(q.estado) === 'aprobada').length} cotizaciones aprobadas` : '';
    const providerText = allow('ver_proveedores') ? `; ${providersAll.filter(p => p.estado !== false).length} proveedores activos` : '';
    return `Resumen de Dashboard proyectos ${scope}: ${count(projects.length)} proyectos, ${pen(totalValue)} de valor sin IGV, ${pen(totalProfit)} de utilidad proyectada, ${pen(totalCost)} de costo estimado, ${clientCount} clientes vinculados, ${projectCounts[0]} en proceso, ${projectCounts[1]} finalizados y ${projectCounts[2]} facturados${quotesText}${providerText}.`;
  }
  return null;
}

// Compatibilidad con las integraciones anteriores.
export async function answerProjectMetrics(utterance, permissions) {
  return answerDashboardQuestion(utterance, permissions);
}
