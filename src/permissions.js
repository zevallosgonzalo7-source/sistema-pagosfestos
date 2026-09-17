/* ============================================================
   ROLES Y PERMISOS — Control Festos
   ------------------------------------------------------------
   Aquí se define, para cada uno de los 4 usuarios autorizados,
   su rol visible y sus permisos por defecto. Gonzalo (HEAD ADMIN)
   puede editar estos permisos en caliente desde el apartado
   "Roles y Permisos" de la app; lo que se guarde ahí se combina
   con esta base para que la app nunca se quede sin valores.
   ============================================================ */

// Catálogo de permisos disponibles en el sistema.
// key   -> nombre interno usado en el código
// label -> texto mostrado en el panel de Roles y Permisos
// grupo -> para agrupar visualmente en el panel
export const CAMPOS_PERMISOS = [
  { key: 'ver_clientes', label: 'Ver el apartado de Clientes', grupo: 'Clientes' },
  { key: 'gestionar_clientes', label: 'Crear, editar y activar/desactivar clientes', grupo: 'Clientes' },
  { key: 'ver_proyectos', label: 'Ver el apartado de Proyectos', grupo: 'Proyectos' },
  { key: 'gestionar_proyectos', label: 'Crear y editar proyectos', grupo: 'Proyectos' },
  { key: 'ver_cotizaciones', label: 'Ver el apartado de Cotizaciones', grupo: 'Cotizaciones' },
  { key: 'gestionar_cotizaciones', label: 'Crear y editar cotizaciones (borrador / en revisión)', grupo: 'Cotizaciones' },
  { key: 'aprobar_cotizaciones', label: 'Aprobar cotizaciones', grupo: 'Cotizaciones' },
  { key: 'gestionar_roles', label: 'Gestionar roles y permisos del equipo', grupo: 'Administración' },
];

// Rol visible (etiqueta) de cada usuario. Solo informativo; los
// permisos reales están en PERMISOS_DEFECTO y son lo que se evalúa.
export const ROLES_LABEL = {
  gonzalo: 'HEAD ADMIN',
  jesus: 'ADMIN',
  rodrigo: 'Desarrollador Software',
  mar: 'COMERCIAL',
};

// Permisos por defecto (usados si aún no hay nada guardado en Supabase
// ni en el almacenamiento local del navegador).
export const PERMISOS_DEFECTO = {
  gonzalo: {
    rol_label: 'HEAD ADMIN',
    ver_clientes: true,
    gestionar_clientes: true,
    ver_proyectos: true,
    gestionar_proyectos: true,
    ver_cotizaciones: true,
    gestionar_cotizaciones: true,
    aprobar_cotizaciones: true,
    gestionar_roles: true,
  },
  jesus: {
    rol_label: 'ADMIN',
    ver_clientes: true,
    gestionar_clientes: true,
    ver_proyectos: true,
    gestionar_proyectos: true,
    ver_cotizaciones: true,
    gestionar_cotizaciones: true,
    aprobar_cotizaciones: true,
    gestionar_roles: false,
  },
  // Nota: no se especificaron permisos concretos para Rodrigo, así que
  // por defecto se le da el mismo alcance operativo que a Jesus (todo
  // menos gestionar roles). Esto se puede ajustar en cualquier momento
  // desde el panel "Roles y Permisos" (solo accesible para Gonzalo).
  rodrigo: {
    rol_label: 'Desarrollador Software',
    ver_clientes: true,
    gestionar_clientes: true,
    ver_proyectos: true,
    gestionar_proyectos: true,
    ver_cotizaciones: true,
    gestionar_cotizaciones: true,
    aprobar_cotizaciones: true,
    gestionar_roles: false,
  },
  mar: {
    rol_label: 'COMERCIAL',
    ver_clientes: true,
    gestionar_clientes: false,
    ver_proyectos: true,
    gestionar_proyectos: false,
    ver_cotizaciones: true,
    gestionar_cotizaciones: true, // puede crear/editar, pero no aprobar
    aprobar_cotizaciones: false,
    gestionar_roles: false,
  },
};

// Permiso "vacío" de respaldo por si algún usuario no está en el mapa.
export const PERMISOS_VACIOS = {
  rol_label: 'Sin rol asignado',
  ver_clientes: false,
  gestionar_clientes: false,
  ver_proyectos: false,
  gestionar_proyectos: false,
  ver_cotizaciones: false,
  gestionar_cotizaciones: false,
  aprobar_cotizaciones: false,
  gestionar_roles: false,
};

export function obtenerPermisos(mapaPermisos, usuario) {
  const clave = (usuario || '').trim().toLowerCase();
  return (mapaPermisos && mapaPermisos[clave]) || PERMISOS_DEFECTO[clave] || PERMISOS_VACIOS;
}
