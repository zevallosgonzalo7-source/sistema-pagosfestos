-- FESTOS V29.34.2 · Registro de Compras + CeCo + LOB + IGV + Adjuntos
-- Idempotente: puede ejecutarse sobre la tabla compras existente.

-- Si todavía no existe la tabla base, créala primero de forma segura.
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  fecha_compra date not null default current_date,
  project_id uuid null references public.proyectos(id) on delete set null,
  proveedor_id uuid null references public.proveedores(id) on delete set null,
  proveedor_nombre text,
  categoria text not null default 'Otros',
  descripcion text not null,
  monto numeric(14,2) not null default 0,
  tipo_comprobante text not null default 'SIN COMPROBANTE',
  observaciones text,
  registrado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.compras add column if not exists ceco text;
alter table public.compras add column if not exists lob text;
alter table public.compras add column if not exists monto_base numeric(14,2);
alter table public.compras add column if not exists aplicar_igv boolean not null default false;
alter table public.compras add column if not exists igv_monto numeric(14,2) not null default 0;
alter table public.compras add column if not exists pdf_factura_path text;
alter table public.compras add column if not exists xml_factura_path text;
alter table public.compras add column if not exists ctz_path text;

-- Completa monto_base para registros históricos.
update public.compras
set monto_base = monto
where monto_base is null;

-- Bucket privado para adjuntos de compras.
insert into storage.buckets (id, name, public, file_size_limit)
values ('compras-adjuntos', 'compras-adjuntos', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

-- Políticas del bucket: cualquier usuario FESTOS autenticado puede gestionar adjuntos.
drop policy if exists "compras_adjuntos_select" on storage.objects;
create policy "compras_adjuntos_select" on storage.objects
for select to authenticated
using (bucket_id = 'compras-adjuntos');

drop policy if exists "compras_adjuntos_insert" on storage.objects;
create policy "compras_adjuntos_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'compras-adjuntos');

drop policy if exists "compras_adjuntos_update" on storage.objects;
create policy "compras_adjuntos_update" on storage.objects
for update to authenticated
using (bucket_id = 'compras-adjuntos')
with check (bucket_id = 'compras-adjuntos');

drop policy if exists "compras_adjuntos_delete" on storage.objects;
create policy "compras_adjuntos_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'compras-adjuntos');

-- RLS compras (si todavía no estaba habilitado).
alter table public.compras enable row level security;

-- Índices útiles.
create index if not exists compras_project_id_idx on public.compras(project_id);
create index if not exists compras_proveedor_id_idx on public.compras(proveedor_id);
create index if not exists compras_fecha_compra_idx on public.compras(fecha_compra desc);
create index if not exists compras_lob_idx on public.compras(lob);

comment on column public.compras.ceco is 'Centro de costo (CeCo) de la compra.';
comment on column public.compras.lob is 'Línea de negocio de la compra.';
comment on column public.compras.monto_base is 'Monto ingresado antes de IGV cuando aplicar_igv=true.';
comment on column public.compras.monto is 'Valor compra final, incluyendo IGV cuando corresponda.';
comment on column public.compras.pdf_factura_path is 'Ruta privada del PDF de factura en Supabase Storage.';
comment on column public.compras.xml_factura_path is 'Ruta privada del XML de factura en Supabase Storage.';
comment on column public.compras.ctz_path is 'Ruta privada del archivo CTZ en Supabase Storage.';
