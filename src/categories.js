// Catálogo empresarial solicitado para proyectos, cotizaciones y sus ítems.
// El nombre físico `lob` se mantiene para compatibilidad con Supabase y las RPC.
export const CATEGORIAS_FESTOS = [
  "Gran formato y ambientación",
  "Merchandising promocional",
  "Kits, packs & especiales",
  "Producción 360°",
  "Impresos comerciales",
  "Proyecto integral",
  "Espacios y estructuras",
  "Material POP",
  "Desarrollos especiales"
];
export const categoriaAnterior = value => !!value && !CATEGORIAS_FESTOS.includes(value);

// Los campos históricos siguen llamándose `lob` en Supabase. Nunca se
// reemplaza un valor antiguo por una de las categorías nuevas automáticamente.
export const CATEGORIA_PENDIENTE = 'Pendiente de clasificar';
export const normalizarTextoCategoria = value => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es').replace(/\bambietacion\b/g, 'ambientacion');
export function categoriaActual(value) {
  const key = normalizarTextoCategoria(value);
  return CATEGORIAS_FESTOS.find(label => normalizarTextoCategoria(label) === key) || null;
}
export function categoriaDelProyecto(project) {
  return categoriaActual(project?.categoria) || categoriaActual(project?.lob) || CATEGORIA_PENDIENTE;
}
