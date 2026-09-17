-- Notificaciones de cotizaciones pendientes de envío
create table if not exists public.cotizacion_notificaciones (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  tipo text not null default 'en_revision',
  destinatarios text[] not null default '{}',
  estado text not null default 'pendiente' check (estado in ('pendiente','enviado','error')),
  error_mensaje text,
  created_at timestamptz not null default now(),
  enviado_at timestamptz,
  unique (cotizacion_id, tipo)
);

alter table public.cotizacion_notificaciones enable row level security;

-- Ajustar estas políticas según los roles de tu instalación.
create policy "usuarios autenticados pueden consultar notificaciones"
  on public.cotizacion_notificaciones for select
  to authenticated using (true);

create policy "usuarios autenticados pueden crear notificaciones"
  on public.cotizacion_notificaciones for insert
  to authenticated with check (true);
