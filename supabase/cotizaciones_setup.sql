-- IMPORTANTE: si aparece 'Could not find the table public.cotizaciones in the schema cache', ejecuta TODO este archivo en Supabase SQL Editor y luego recarga la app.
-- CONTROL FESTOS · Cotizaciones
-- Ejecutar en Supabase SQL Editor después de tener public.clientes creada.
-- No modifica pagos/facturas.

create extension if not exists pgcrypto;

create table if not exists public.proyectos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on update cascade on delete restrict,
  nombre text not null,
  descripcion text,
  estado text not null default 'Activo' check (estado in ('Activo','En pausa','Finalizado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  client_id uuid not null references public.clientes(id) on update cascade on delete restrict,
  project_id uuid null references public.proyectos(id) on update cascade on delete restrict,
  descripcion text,
  estado text not null default 'Borrador' check (estado in ('Borrador','En Revisión','Aprobado')),
  aplicar_igv boolean not null default true,
  igv_rate numeric(5,4) not null default 0.18,
  subtotal numeric(14,2) not null default 0,
  descuento numeric(14,2) not null default 0,
  igv numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  costo_estimado numeric(14,2) not null default 0,
  ganancia_estimada numeric(14,2) not null default 0,
  margen numeric(8,4) not null default 0,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cotizacion_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.cotizaciones(id) on update cascade on delete cascade,
  orden integer not null default 1,
  descripcion text not null,
  modo text not null default 'detallado' check (modo in ('detallado','directo')),
  cantidad numeric(14,4),
  valor_unitario numeric(14,2),
  valor_total numeric(14,2) not null default 0,
  costo numeric(14,2) not null default 0,
  margen numeric(8,4) not null default 0,
  created_at timestamptz not null default now()
);

-- Si las tablas ya existían de una versión anterior, estas sentencias dejan
-- Proyecto como opcional y permiten usar el nuevo comportamiento global.
alter table public.cotizaciones alter column project_id drop not null;

create index if not exists idx_proyectos_client_id on public.proyectos(client_id);
create index if not exists idx_cotizaciones_client_id on public.cotizaciones(client_id);
create index if not exists idx_cotizaciones_project_id on public.cotizaciones(project_id);
create index if not exists idx_cotizaciones_estado on public.cotizaciones(estado);
create index if not exists idx_cotizacion_items_quote_id on public.cotizacion_items(quote_id);

create or replace function public.set_festos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_proyectos_updated_at on public.proyectos;
create trigger trg_proyectos_updated_at before update on public.proyectos for each row execute function public.set_festos_updated_at();
drop trigger if exists trg_cotizaciones_updated_at on public.cotizaciones;
create trigger trg_cotizaciones_updated_at before update on public.cotizaciones for each row execute function public.set_festos_updated_at();

alter table public.proyectos enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.cotizacion_items enable row level security;

drop policy if exists "festos proyectos anon access" on public.proyectos;
create policy "festos proyectos anon access" on public.proyectos for all to anon, authenticated using (true) with check (true);
drop policy if exists "festos cotizaciones anon access" on public.cotizaciones;
create policy "festos cotizaciones anon access" on public.cotizaciones for all to anon, authenticated using (true) with check (true);
drop policy if exists "festos cotizacion items anon access" on public.cotizacion_items;
create policy "festos cotizacion items anon access" on public.cotizacion_items for all to anon, authenticated using (true) with check (true);
