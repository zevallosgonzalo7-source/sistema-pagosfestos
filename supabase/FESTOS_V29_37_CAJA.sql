-- ============================================================
-- FESTOS V29.37 — MÓDULO CAJA
-- CAJA IBK + CAJA CHICA
-- ============================================================

begin;

create table if not exists public.caja_cuentas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  saldo_inicial numeric(14,2) not null default 0,
  fecha_saldo_inicial date,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.caja_cuentas (codigo,nombre,orden)
values
  ('INTERBANK','CAJA IBK',1),
  ('CAJA_CHICA','CAJA CHICA',2)
on conflict (codigo) do update
set nombre = excluded.nombre,
    orden = excluded.orden,
    activo = true;

create table if not exists public.caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null,
  fecha date not null default current_date,
  tipo text not null,
  origen text not null,
  monto numeric(14,2) not null,
  concepto text not null,
  compra_id uuid,
  venta_id uuid,
  tercero_nombre text,
  proyecto_texto text,
  documento text,
  observaciones text,
  transferencia_grupo uuid,
  registrado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint caja_movimientos_cuenta_id_fkey foreign key (cuenta_id) references public.caja_cuentas(id),
  constraint caja_movimientos_compra_id_fkey foreign key (compra_id) references public.compras(id) on delete set null,
  constraint caja_movimientos_tipo_check check (tipo in ('INGRESO','EGRESO')),
  constraint caja_movimientos_origen_check check (origen in ('COMPRA','VENTA','TRANSFERENCIA','REEMBOLSO','AJUSTE','OTRO')),
  constraint caja_movimientos_monto_check check (monto > 0)
);

create index if not exists idx_caja_movimientos_cuenta_fecha on public.caja_movimientos(cuenta_id, fecha desc);
create index if not exists idx_caja_movimientos_compra on public.caja_movimientos(compra_id);
create index if not exists idx_caja_movimientos_origen on public.caja_movimientos(origen);
create index if not exists idx_caja_movimientos_transferencia on public.caja_movimientos(transferencia_grupo);

alter table public.caja_cuentas enable row level security;
alter table public.caja_movimientos enable row level security;

grant select,insert,update,delete on public.caja_cuentas to authenticated;
grant select,insert,update,delete on public.caja_movimientos to authenticated;

drop policy if exists "festos caja cuentas read" on public.caja_cuentas;
create policy "festos caja cuentas read"
on public.caja_cuentas for select to authenticated
using (true);

drop policy if exists "festos caja cuentas write" on public.caja_cuentas;
create policy "festos caja cuentas write"
on public.caja_cuentas for all to authenticated
using (true) with check (true);

drop policy if exists "festos caja movimientos read" on public.caja_movimientos;
create policy "festos caja movimientos read"
on public.caja_movimientos for select to authenticated
using (true);

drop policy if exists "festos caja movimientos write" on public.caja_movimientos;
create policy "festos caja movimientos write"
on public.caja_movimientos for all to authenticated
using (true) with check (true);

create or replace function public.registrar_transferencia_caja(
  p_cuenta_origen uuid,
  p_cuenta_destino uuid,
  p_fecha date,
  p_monto numeric,
  p_concepto text,
  p_observaciones text default null,
  p_registrado_por text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo uuid := gen_random_uuid();
  v_origen_nombre text;
  v_destino_nombre text;
begin
  if p_cuenta_origen = p_cuenta_destino then
    raise exception 'La caja origen y destino deben ser diferentes';
  end if;
  if coalesce(p_monto,0) <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  select nombre into v_origen_nombre from public.caja_cuentas where id = p_cuenta_origen and activo = true;
  select nombre into v_destino_nombre from public.caja_cuentas where id = p_cuenta_destino and activo = true;
  if v_origen_nombre is null or v_destino_nombre is null then
    raise exception 'No se encontró una de las cajas';
  end if;

  insert into public.caja_movimientos
    (cuenta_id,fecha,tipo,origen,monto,concepto,tercero_nombre,observaciones,transferencia_grupo,registrado_por)
  values
    (p_cuenta_origen,coalesce(p_fecha,current_date),'EGRESO','TRANSFERENCIA',p_monto,
     coalesce(nullif(trim(p_concepto),''),'Transferencia entre cajas'),v_destino_nombre,p_observaciones,v_grupo,p_registrado_por);

  insert into public.caja_movimientos
    (cuenta_id,fecha,tipo,origen,monto,concepto,tercero_nombre,observaciones,transferencia_grupo,registrado_por)
  values
    (p_cuenta_destino,coalesce(p_fecha,current_date),'INGRESO','TRANSFERENCIA',p_monto,
     coalesce(nullif(trim(p_concepto),''),'Transferencia entre cajas'),v_origen_nombre,p_observaciones,v_grupo,p_registrado_por);

  return v_grupo;
end;
$$;

grant execute on function public.registrar_transferencia_caja(uuid,uuid,date,numeric,text,text,text) to authenticated;

commit;

notify pgrst,'reload schema';
