-- V11: flujo Proyecto obligatorio + creación automática al aprobar
alter table public.cotizaciones
  add column if not exists proyecto_nombre text;

-- Para datos existentes, conserva el nombre del proyecto relacionado si existe.
update public.cotizaciones c
set proyecto_nombre = p.nombre
from public.proyectos p
where c.project_id = p.id
  and coalesce(trim(c.proyecto_nombre), '') = '';

-- Nuevas cotizaciones deben llevar nombre de proyecto.
alter table public.cotizaciones
  drop constraint if exists cotizaciones_proyecto_nombre_check;
alter table public.cotizaciones
  add constraint cotizaciones_proyecto_nombre_check
  check (proyecto_nombre is not null and length(trim(proyecto_nombre)) > 0);

notify pgrst, 'reload schema';
