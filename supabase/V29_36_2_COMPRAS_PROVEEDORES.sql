-- FESTOS V29.36.2 — Compras + Proveedores
-- Ejecutar en Supabase SQL Editor antes de probar esta versión.

begin;

-- 1) Proveedores: nombre comercial y documento disponibles en ambos formularios.
alter table public.proveedores
  add column if not exists nombre_comercial text;

alter table public.proveedores
  add column if not exists ruc_documento text;

-- Categoría deja de ser obligatoria y ya no se usa en la UI de Proveedores.
alter table public.proveedores
  alter column categoria drop not null;

-- Contactos múltiples (compatible con instalaciones donde la tabla ya existe).
create table if not exists public.proveedor_contactos (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  telefono text,
  nombre text,
  created_at timestamptz not null default now()
);

alter table public.proveedor_contactos add column if not exists nombre text;
alter table public.proveedor_contactos add column if not exists telefono text;
create index if not exists idx_proveedor_contactos_proveedor on public.proveedor_contactos(proveedor_id);
create index if not exists idx_proveedor_contactos_nombre on public.proveedor_contactos(nombre);

-- 2) Catálogo de proyectos generales usados desde Registro de Compras.
create table if not exists public.compras_proyectos_generales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists compras_proyectos_generales_nombre_uq
  on public.compras_proyectos_generales (lower(trim(nombre)));
create index if not exists idx_compras_proyectos_generales_activo
  on public.compras_proyectos_generales(activo);

-- Recupera proyectos manuales que ya pudieran existir en compras anteriores.
insert into public.compras_proyectos_generales (nombre)
select distinct trim(c.proyecto_texto)
from public.compras c
where c.project_id is null
  and nullif(trim(coalesce(c.proyecto_texto, '')), '') is not null
on conflict do nothing;

-- RLS / permisos del nuevo catálogo.
alter table public.compras_proyectos_generales enable row level security;
grant select, insert, update, delete on public.compras_proyectos_generales to authenticated;

drop policy if exists "festos compras proyectos generales select" on public.compras_proyectos_generales;
create policy "festos compras proyectos generales select"
on public.compras_proyectos_generales
for select to authenticated
using (true);

drop policy if exists "festos compras proyectos generales write" on public.compras_proyectos_generales;
create policy "festos compras proyectos generales write"
on public.compras_proyectos_generales
for all to authenticated
using (true)
with check (true);

commit;
notify pgrst, 'reload schema';
