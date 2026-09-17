-- Destinatarios configurados para avisos de cotizaciones en revisión.
-- Ejecuta este archivo solo si todavía no existe la tabla.
create table if not exists public.cotizacion_notificaciones (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  tipo text not null,
  destinatarios text[] not null default '{}',
  estado text not null default 'pendiente',
  error_mensaje text,
  created_at timestamptz not null default now(),
  enviado_at timestamptz,
  unique (cotizacion_id, tipo)
);

create index if not exists idx_cotizacion_notificaciones_estado
on public.cotizacion_notificaciones(estado, created_at desc);
