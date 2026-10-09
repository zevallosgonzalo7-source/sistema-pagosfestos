-- FESTOS V29.34 - REGISTRO DE COMPRAS
-- Compra = obligación / costo adquirido. NO es un movimiento de caja.
-- El pago se integrará posteriormente con Caja Interbank y Caja Chica.

create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  fecha_compra date not null default current_date,
  project_id uuid null references public.proyectos(id) on delete set null,
  proveedor_id uuid null references public.proveedores(id) on delete set null,
  proveedor_nombre text,
  categoria text not null,
  descripcion text not null,
  monto numeric(14,2) not null check (monto > 0),
  tipo_comprobante text not null default 'SIN COMPROBANTE',
  serie text,
  numero text,
  fecha_vencimiento date,
  condicion_pago text not null default 'CONTADO' check (condicion_pago in ('CONTADO','CREDITO')),
  estado_pago text not null default 'PENDIENTE' check (estado_pago in ('PENDIENTE','PARCIAL','PAGADA')),
  monto_pagado numeric(14,2) not null default 0 check (monto_pagado >= 0),
  archivo_url text,
  observaciones text,
  registrado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compras_monto_pagado_check check (monto_pagado <= monto)
);

create sequence if not exists public.compras_correlativo_seq start 1;

create or replace function public.festos_asignar_codigo_compra()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    new.codigo := 'COM-' || to_char(coalesce(new.fecha_compra,current_date),'YYYYMM') || '-' || lpad(nextval('public.compras_correlativo_seq')::text, 4, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_compras_codigo on public.compras;
create trigger trg_compras_codigo
before insert or update on public.compras
for each row execute function public.festos_asignar_codigo_compra();

create index if not exists compras_project_id_idx on public.compras(project_id);
create index if not exists compras_proveedor_id_idx on public.compras(proveedor_id);
create index if not exists compras_fecha_compra_idx on public.compras(fecha_compra desc);
create index if not exists compras_estado_pago_idx on public.compras(estado_pago);

alter table public.compras enable row level security;

drop policy if exists "compras_select_activos" on public.compras;
create policy "compras_select_activos" on public.compras
for select to authenticated
using (public.festos_is_active());

drop policy if exists "compras_insert_activos" on public.compras;
create policy "compras_insert_activos" on public.compras
for insert to authenticated
with check (public.festos_is_active());

drop policy if exists "compras_update_activos" on public.compras;
create policy "compras_update_activos" on public.compras
for update to authenticated
using (public.festos_is_active())
with check (public.festos_is_active());

drop policy if exists "compras_delete_activos" on public.compras;
create policy "compras_delete_activos" on public.compras
for delete to authenticated
using (public.festos_is_active());

-- Realtime para que el registro se refresque entre usuarios.
do $$
begin
  begin
    alter publication supabase_realtime add table public.compras;
  exception when duplicate_object then null;
  end;
end $$;

comment on table public.compras is 'Registro de compras FESTOS. Registra lo comprado y la obligación, no la salida de caja.';
comment on column public.compras.project_id is 'Puede ser NULL para compras generales sin proyecto.';
comment on column public.compras.monto_pagado is 'Se actualizará desde los futuros movimientos de Caja Interbank/Caja Chica.';
