// Fechas del Dashboard: calendario LOCAL; los DATE y TIMESTAMP de Supabase son ISO.
// No convertir YYYY-MM-DD a UTC: al hacerlo puede desplazarse al día anterior.
export function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dateKey(value) {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : localDateKey(value);
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}(?:$|[T\s])/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : localDateKey(date);
}
export function dashboardDate(project) {
  return project?.fecha_pedido || project?.created_at || '';
}
export function dashboardPeriodBounds(period, { year, month, quarter, from = '', to = '', now = new Date() } = {}) {
  const selectedYear = Number.isInteger(+year) && +year >= 1900 && +year <= 2200 ? +year : now.getFullYear();
  const selectedMonth = +month >= 1 && +month <= 12 ? +month : now.getMonth() + 1;
  const selectedQuarter = +quarter >= 1 && +quarter <= 4 ? +quarter : Math.floor(now.getMonth() / 3) + 1;
  if (period === 'month') return {
    desde: localDateKey(new Date(selectedYear, selectedMonth - 1, 1)),
    hasta: localDateKey(new Date(selectedYear, selectedMonth, 0))
  };
  if (period === 'quarter') return {
    desde: localDateKey(new Date(selectedYear, (selectedQuarter - 1) * 3, 1)),
    hasta: localDateKey(new Date(selectedYear, selectedQuarter * 3, 0))
  };
  if (period === 'year') return { desde: `${selectedYear}-01-01`, hasta: `${selectedYear}-12-31` };
  if (period === 'custom') return { desde: from || '', hasta: to || '' };
  return { desde: '', hasta: '' }; // all
}
export function isInDashboardRange(value, { desde = '', hasta = '' }) {
  if (!desde && !hasta) return true;
  const day = dateKey(value);
  return Boolean(day) && (!desde || day >= desde) && (!hasta || day <= hasta);
}
