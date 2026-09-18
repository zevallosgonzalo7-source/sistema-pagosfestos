-- CSSFESTOS V2: contactos, condiciones de pago y soporte de eliminación de proyectos
-- Ejecutar en Supabase SQL Editor después de la estructura actual.

alter table public.clientes add column if not exists tipo_pago text;
alter table public.clientes add column if not exists plazo_dias integer default 0;
alter table public.clientes add column if not exists estado boolean default true;
update public.clientes set tipo_pago = upper(coalesce(tipo_pago, 'CONTADO'));
update public.clientes set tipo_pago = 'CREDITO' where lower(coalesce(tipo_pago,'')) in ('crédito','credito');
update public.clientes set tipo_pago = 'CONTADO' where tipo_pago is null or tipo_pago not in ('CONTADO','CREDITO');
alter table public.clientes alter column tipo_pago set default 'CONTADO';

alter table public.proveedores add column if not exists correo text;
alter table public.proveedores add column if not exists condicion_pago text;
alter table public.proveedores add column if not exists estado boolean default true;
update public.proveedores set condicion_pago = 'CONTADO' where condicion_pago is null or upper(condicion_pago) not in ('CONTADO','CREDITO');
alter table public.proveedores alter column condicion_pago set default 'CONTADO';

create table if not exists public.cliente_contactos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  telefono text,
  correo text,
  cargo text,
  created_at timestamptz not null default now()
);

alter table public.cliente_contactos enable row level security;
drop policy if exists "festos cliente contactos anon access" on public.cliente_contactos;
create policy "festos cliente contactos anon access" on public.cliente_contactos for all to anon, authenticated using (true) with check (true);

create index if not exists idx_cliente_contactos_cliente on public.cliente_contactos(cliente_id);
create index if not exists idx_clientes_tipo_pago on public.clientes(tipo_pago);
create index if not exists idx_proveedores_condicion_pago on public.proveedores(condicion_pago);

create table if not exists public.proveedor_contactos (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  telefono text,
  correo text,
  created_at timestamptz not null default now()
);

alter table public.proveedor_contactos enable row level security;
drop policy if exists "festos proveedor contactos anon access" on public.proveedor_contactos;
create policy "festos proveedor contactos anon access" on public.proveedor_contactos for all to anon, authenticated using (true) with check (true);
create index if not exists idx_proveedor_contactos_proveedor on public.proveedor_contactos(proveedor_id);
