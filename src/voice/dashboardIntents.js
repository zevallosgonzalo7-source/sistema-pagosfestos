import { cleanSpeech } from './commands.js';

// Clasificador determinístico: no transmite información empresarial a una IA externa.
export function classifyDashboardQuestion(utterance) {
  const t = cleanSpeech(utterance);
  if (!t) return null;
  if (/\b(?:dashboard ventas|tablero de ventas)\b/.test(t)) return 'unconnected';
  if (/\b(?:resumen|reporte|panorama|todo|todos|todas|como vamos|como va|como estamos)\b/.test(t) && /\b(?:dashboard|proyectos|empresa|negocio|general|ventas)\b/.test(t)) return 'summary';
  if (/\b(?:vencid|atrasad|fuera de plazo|entregas? atrasad)/.test(t)) return 'overdue';
  if (/\b(?:proxim[oa]s?|siguientes?)\b/.test(t) && /\b(?:entrega|vencimient|dias)/.test(t)) return 'due';
  if (/\b(?:categoria|categorias)\b/.test(t) && /\b(?:proveedor|distribucion)/.test(t)) return 'providerCategories';
  if (/\b(?:cuantos|cantidad|numero|total|hay)\b/.test(t) && /\bproveedores?\b/.test(t)) return 'providers';
  if (/\b(?:cuantos|cantidad|numero|total|hay)\b/.test(t) && /\bclientes?\b/.test(t)) return 'clients';
  if (/\b(?:clientes?|empresas?)\b/.test(t) && /\b(?:top|principales|mayor|mas valor|mas proyectos|mejores)\b/.test(t)) return 'topClients';
  if (/\b(?:cotizaciones?|propuestas|presupuestos?)\b/.test(t) && /\b(?:cuantas|cantidad|numero|total|estado|aprobadas?|revision|borrador|hay)\b/.test(t)) return 'quotes';
  if (/\b(?:categoria|categorias|linea de negocio|lineas de negocio|lob|produccion grafica|produccion 360|espacio de estructuras)\b/.test(t)) return 'lob';
  if (/\b(?:por mes|cada mes|mensual|evolucion|tendencia|mapa de proyectos)\b/.test(t) && /\b(?:venta|valor|proyectos|dashboard|facturad|cuanto|dime)\b/.test(t)) return 'monthly';
  if (/\b(?:ejecutivos?|participacion)\b/.test(t) && /\b(?:participacion|distribucion|comparar|cada|todos|resumen|por ejecutivo)\b/.test(t)) return 'executives';
  if (/\b(?:proyecto|proyectos)\b/.test(t) && /\b(?:mayor|mas alto|mas costoso|principal|principales|top|ranking)\b/.test(t)) return 'topProject';
  if (/\b(?:estado|situacion)\b/.test(t) && /\bproyectos?\b/.test(t)) return 'status';
  if (/\b(?:margen|rentabilidad|porcentaje de utilidad)\b/.test(t)) return 'margin';
  if (/\b(?:costo|gasto|inversion)\b/.test(t) && /\b(?:total|estimado|proyectado|proyecto|cuanto|cual|tenemos|hay)\b/.test(t)) return 'cost';
  if (/\b(?:utilidad|ganancia|beneficio|margen bruto)\b/.test(t)) return 'profit';
  if (/\b(?:cuantos|cantidad|numero|total de proyectos|hay proyectos)\b/.test(t) && /\bproyectos?\b/.test(t) && !/\b(?:venta|valor|soles)\b/.test(t)) return 'projects';
  if (/\b(?:venta|ventas|valor de venta|valor de proyectos|facturacion proyectada|ingresos? proyectados?)\b/.test(t) && /\b(?:cuanto|cual|total|proyectad|tenemos|hay|mar|gonzalo|dashboard|ejecutivo|proyectos|este mes|este ano|produccion|espacio)\b/.test(t)) return 'sales';
  return null;
}

export function dashboardPeriod(utterance, now = new Date()) {
  const t = cleanSpeech(utterance);
  const y = now.getFullYear(), m = now.getMonth();
  if (/\b(?:todos los anos|historico|historica|de todos los tiempos|sin filtro|en total historico)\b/.test(t)) return { start: '', end: '', label: 'en todo el historial' };
  if (/\b(?:mes pasado|mes anterior)\b/.test(t)) {
    const start = new Date(y, m - 1, 1), end = new Date(y, m, 0);
    return { start: dateLocal(start), end: dateLocal(end), label: 'del mes pasado' };
  }
  if (/\b(?:este mes|mes actual)\b/.test(t)) return { start: dateLocal(new Date(y, m, 1)), end: dateLocal(now), label: 'de este mes' };
  if (/\b(?:trimestre|este trimestre)\b/.test(t)) return { start: dateLocal(new Date(y, Math.floor(m / 3) * 3, 1)), end: dateLocal(now), label: 'de este trimestre' };
  return { start: `${y}-01-01`, end: dateLocal(now), label: `del año ${y}` };
}
export function dateLocal(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
