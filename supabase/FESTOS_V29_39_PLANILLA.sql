-- ============================================================
-- FESTOS V29.39.1 — MÓDULO PLANILLA + DETALLE + RXH/STORAGE
-- Empleados, comisiones, liquidaciones, datos bancarios y adjuntos
-- ============================================================
begin;

create extension if not exists pgcrypto;

create table if not exists public.planilla_empleados (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  cargo text not null,
  modalidad_pago text not null check (modalidad_pago in ('PLANILLA','RECIBO_HONORARIOS')),
  frecuencia_pago text not null default 'MENSUAL' check (frecuencia_pago in ('MENSUAL','QUINCENAL')),
  permite_comisiones boolean not null default false,
  sueldo_base numeric(14,2),
  documento text,
  ruc text,
  correo text,
  telefono text,
  banco text,
  cuenta_bancaria text,
  cci text,
  fecha_ingreso date,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planilla_sueldo_nonnegative check (sueldo_base is null or sueldo_base >= 0)
);

alter table public.planilla_empleados add column if not exists documento text;
alter table public.planilla_empleados add column if not exists ruc text;
alter table public.planilla_empleados add column if not exists correo text;
alter table public.planilla_empleados add column if not exists telefono text;
alter table public.planilla_empleados add column if not exists banco text;
alter table public.planilla_empleados add column if not exists cuenta_bancaria text;
alter table public.planilla_empleados add column if not exists cci text;
alter table public.planilla_empleados add column if not exists fecha_ingreso date;
alter table public.planilla_empleados add column if not exists activo boolean not null default true;
alter table public.planilla_empleados add column if not exists orden integer not null default 0;
alter table public.planilla_empleados add column if not exists created_at timestamptz not null default now();
alter table public.planilla_empleados add column if not exists updated_at timestamptz not null default now();

create table if not exists public.planilla_comisiones (
  id uuid primary key default gen_random_uuid(),
  empleado_codigo text not null references public.planilla_empleados(codigo) on update cascade on delete restrict,
  periodo text not null,
  origen text not null default 'OTRO' check (origen in ('COTIZACION','PROYECTO','VENTA','OTRO')),
  referencia text,
  descripcion text,
  monto numeric(14,2) not null check (monto >= 0),
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','APROBADA','PAGADA','ANULADA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planilla_comision_solo_mar check (empleado_codigo = 'MAR')
);

create table if not exists public.planilla_liquidaciones (
  id uuid primary key default gen_random_uuid(),
  periodo text not null,
  empleado_codigo text not null references public.planilla_empleados(codigo) on update cascade on delete restrict,
  frecuencia_pago text not null default 'MENSUAL' check (frecuencia_pago in ('MENSUAL','QUINCENAL')),
  sueldo_base numeric(14,2),
  comisiones numeric(14,2) not null default 0,
  bonos numeric(14,2) not null default 0,
  descuentos numeric(14,2) not null default 0,
  total_pagar numeric(14,2),
  fecha_pago date,
  medio_pago text,
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','POR_PAGAR','PAGADO','ANULADO')),
  observaciones text,
  registrado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(periodo, empleado_codigo),
  constraint planilla_total_nonnegative check (total_pagar is null or total_pagar >= 0)
);

create table if not exists public.planilla_documentos (
  id uuid primary key default gen_random_uuid(),
  empleado_codigo text not null references public.planilla_empleados(codigo) on update cascade on delete restrict,
  periodo text,
  tipo text not null default 'OTRO',
  nombre_archivo text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

insert into public.planilla_empleados
  (codigo,nombre,cargo,modalidad_pago,frecuencia_pago,permite_comisiones,sueldo_base,correo,activo,orden)
values
  ('GONZALO','Gonzalo Villavicencio','Head Admin','PLANILLA','MENSUAL',false,null,'gonzalo@festosmkt.com',true,1),
  ('JESUS','Jesus Jorge','Admin','RECIBO_HONORARIOS','QUINCENAL',false,null,'jesus@festosmkt.com',true,2),
  ('MAR','Marjorie Muñoz','Operadora Comercial','RECIBO_HONORARIOS','MENSUAL',true,null,'mar@festosmkt.com',true,3),
  ('RODRIGO','Rodrigo Zevallos','Desarrollador Software','RECIBO_HONORARIOS','QUINCENAL',false,null,'rodrigo@festosmkt.com',true,4)
on conflict (codigo) do update set
  nombre=excluded.nombre,
  cargo=excluded.cargo,
  modalidad_pago=excluded.modalidad_pago,
  frecuencia_pago=excluded.frecuencia_pago,
  permite_comisiones=excluded.permite_comisiones,
  correo=coalesce(public.planilla_empleados.correo, excluded.correo),
  orden=excluded.orden,
  updated_at=now();

create or replace function public.set_planilla_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_planilla_empleados_updated_at on public.planilla_empleados;
create trigger trg_planilla_empleados_updated_at before update on public.planilla_empleados for each row execute function public.set_planilla_updated_at();
drop trigger if exists trg_planilla_comisiones_updated_at on public.planilla_comisiones;
create trigger trg_planilla_comisiones_updated_at before update on public.planilla_comisiones for each row execute function public.set_planilla_updated_at();
drop trigger if exists trg_planilla_liquidaciones_updated_at on public.planilla_liquidaciones;
create trigger trg_planilla_liquidaciones_updated_at before update on public.planilla_liquidaciones for each row execute function public.set_planilla_updated_at();

alter table public.planilla_empleados enable row level security;
alter table public.planilla_comisiones enable row level security;
alter table public.planilla_liquidaciones enable row level security;
alter table public.planilla_documentos enable row level security;

grant select, insert, update, delete on public.planilla_empleados to authenticated;
grant select, insert, update, delete on public.planilla_comisiones to authenticated;
grant select, insert, update, delete on public.planilla_liquidaciones to authenticated;
grant select, insert, update, delete on public.planilla_documentos to authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['planilla_empleados','planilla_comisiones','planilla_liquidaciones','planilla_documentos'] LOOP
    EXECUTE format('drop policy if exists "festos %s authenticated" on public.%I', t, t);
    EXECUTE format('create policy "festos %s authenticated" on public.%I for all to authenticated using (true) with check (true)', t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- Storage bucket: planilla-rxh
-- Guarda recibos por honorarios, constancias y comprobantes.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('planilla-rxh', 'planilla-rxh', false)
on conflict (id) do nothing;

drop policy if exists "planilla-rxh authenticated read" on storage.objects;
create policy "planilla-rxh authenticated read"
on storage.objects for select
to authenticated
using (bucket_id = 'planilla-rxh');

drop policy if exists "planilla-rxh authenticated write" on storage.objects;
create policy "planilla-rxh authenticated write"
on storage.objects for insert
to authenticated
with check (bucket_id = 'planilla-rxh');

drop policy if exists "planilla-rxh authenticated update" on storage.objects;
create policy "planilla-rxh authenticated update"
on storage.objects for update
to authenticated
using (bucket_id = 'planilla-rxh')
with check (bucket_id = 'planilla-rxh');

drop policy if exists "planilla-rxh authenticated delete" on storage.objects;
create policy "planilla-rxh authenticated delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'planilla-rxh');

commit;
notify pgrst, 'reload schema';
