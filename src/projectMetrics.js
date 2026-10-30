// Fuente única para la valoración y selección determinista de cotizaciones vinculadas.
export const numeroProyecto = value => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
export const cotizacionDeProyecto = (project, quotes = []) => {
  const vinculadas = quotes.filter(q => String(q.project_id || '') === String(project.id || '') && project.id != null);
  const nombre = String(project.nombre || '').trim().toLowerCase();
  const candidatas = vinculadas.length ? vinculadas : quotes.filter(q => nombre && String(q.proyecto_nombre || '').trim().toLowerCase() === nombre);
  return candidatas.slice().sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || String(b.id || '').localeCompare(String(a.id || '')))[0] || null;
};
export const valorDeProyecto = (p, cotizaciones = []) => {
  const q = cotizacionDeProyecto(p, cotizaciones);
  if (numeroProyecto(p?.valor_base) > 0) return numeroProyecto(p.valor_base);
  if (numeroProyecto(p?.valor_venta) > 0) return numeroProyecto(p.valor_venta);
  return numeroProyecto(q?.subtotal);
};
export const costoDeProyecto = (p, cotizaciones = []) => {
  const directo = numeroProyecto(p?.costo_estimado);
  return directo > 0 ? directo : numeroProyecto(cotizacionDeProyecto(p, cotizaciones)?.costo_estimado);
};
export const utilidadDeProyecto = (p, cotizaciones = []) => {
  const directo = numeroProyecto(p?.utilidad_proyectada);
  if (directo !== 0) return directo;
  const estimada = numeroProyecto(cotizacionDeProyecto(p, cotizaciones)?.ganancia_estimada);
  return estimada !== 0 ? estimada : valorDeProyecto(p, cotizaciones) - costoDeProyecto(p, cotizaciones);
};
