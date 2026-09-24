-- FESTOS V29.31 · Calendario global colaborativo
-- Ejecutar en Supabase SQL Editor antes de desplegar la versión.

create extension if not exists pgcrypto;

create table if not exists public.calendario_actividades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  tipo text not null default 'ACTIVIDAD' check (tipo in ('ACTIVIDAD','ENTREGA','REUNIÓN','RECORDATORIO','NOTA')),
  color text not null default 'petrol' check (color in ('petrol','blue','green','purple','amber','rose')),
  proyecto_id uuid references public.proyectos(id) on update cascade on delete set null,
  asignado_a text,
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendario_actividades_inicio on public.calendario_actividades(fecha_inicio);
create index if not exists idx_calendario_actividades_proyecto on public.calendario_actividades(proyecto_id);
create index if not exists idx_calendario_actividades_asignado on public.calendario_actividades(asignado_a);

alter table public.calendario_actividades enable row level security;

drop policy if exists calendario_actividades_select_auth on public.calendario_actividades;
create policy calendario_actividades_select_auth on public.calendario_actividades
for select to authenticated using (true);

drop policy if exists calendario_actividades_insert_auth on public.calendario_actividades;
create policy calendario_actividades_insert_auth on public.calendario_actividades
for insert to authenticated with check (true);

drop policy if exists calendario_actividades_update_auth on public.calendario_actividades;
create policy calendario_actividades_update_auth on public.calendario_actividades
for update to authenticated using (true) with check (true);

drop policy if exists calendario_actividades_delete_auth on public.calendario_actividades;
create policy calendario_actividades_delete_auth on public.calendario_actividades
for delete to authenticated using (true);

-- Realtime para que todos vean los cambios sin recargar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calendario_actividades'
  ) then
    alter publication supabase_realtime add table public.calendario_actividades;
  end if;
exception when duplicate_object then null;
end $$;
