-- CONTROL FESTOS V14
-- Apartado de Roles y Permisos (gestión de los 4 usuarios del equipo)
-- Ejecutar en Supabase SQL Editor. No modifica pagos, clientes, proyectos
-- ni cotizaciones existentes; solo agrega la tabla de permisos.

create extension if not exists pgcrypto;

create table if not exists public.roles_permisos (
  usuario text primary key,                 -- 'gonzalo' | 'jesus' | 'rodrigo' | 'mar'
  rol_label text not null,                  -- Etiqueta visible, ej. 'HEAD ADMIN'
  permisos jsonb not null default '{}'::jsonb,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_festos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_roles_permisos_updated_at on public.roles_permisos;
create trigger trg_roles_permisos_updated_at
before update on public.roles_permisos
for each row execute function public.set_festos_updated_at();

-- Datos iniciales: coinciden con lo definido en src/permissions.js
insert into public.roles_permisos (usuario, rol_label, permisos) values
('gonzalo', 'HEAD ADMIN', jsonb_build_object(
  'ver_clientes', true, 'gestionar_clientes', true,
  'ver_proyectos', true, 'gestionar_proyectos', true,
  'ver_cotizaciones', true, 'gestionar_cotizaciones', true,
  'aprobar_cotizaciones', true, 'gestionar_roles', true
)),
('jesus', 'ADMIN', jsonb_build_object(
  'ver_clientes', true, 'gestionar_clientes', true,
  'ver_proyectos', true, 'gestionar_proyectos', true,
  'ver_cotizaciones', true, 'gestionar_cotizaciones', true,
  'aprobar_cotizaciones', true, 'gestionar_roles', false
)),
('rodrigo', 'Desarrollador Software', jsonb_build_object(
  'ver_clientes', true, 'gestionar_clientes', true,
  'ver_proyectos', true, 'gestionar_proyectos', true,
  'ver_cotizaciones', true, 'gestionar_cotizaciones', true,
  'aprobar_cotizaciones', true, 'gestionar_roles', false
)),
('mar', 'COMERCIAL', jsonb_build_object(
  'ver_clientes', true, 'gestionar_clientes', false,
  'ver_proyectos', true, 'gestionar_proyectos', false,
  'ver_cotizaciones', true, 'gestionar_cotizaciones', true,
  'aprobar_cotizaciones', false, 'gestionar_roles', false
))
on conflict (usuario) do nothing;

alter table public.roles_permisos enable row level security;

-- Igual que el resto de tablas de este proyecto: la app controla el acceso
-- por rol en el frontend (no hay Supabase Auth), así que el acceso de
-- lectura/escritura a nivel de base de datos se deja abierto a anon.
drop policy if exists "festos roles_permisos anon access" on public.roles_permisos;
create policy "festos roles_permisos anon access" on public.roles_permisos
for all to anon, authenticated using (true) with check (true);

NOTIFY pgrst, 'reload schema';
