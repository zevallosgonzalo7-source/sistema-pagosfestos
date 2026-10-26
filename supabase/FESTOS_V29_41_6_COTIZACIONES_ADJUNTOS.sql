-- ============================================================
-- FESTOS V29.41.6 — COTIZACIONES: PROFORMA APROBADA + ADJUNTOS
-- ============================================================
-- Ejecutar una sola vez en Supabase SQL Editor.

begin;

create table if not exists public.cotizacion_adjuntos (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  tipo text not null check (tipo in ('PROFORMA_APROBADA','ADJUNTO')),
  nombre_archivo text not null,
  storage_path text not null unique,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cotizacion_adjuntos_cotizacion
  on public.cotizacion_adjuntos(cotizacion_id, created_at);

-- Una sola proforma aprobada por cotización.
create unique index if not exists uq_cotizacion_proforma_aprobada
  on public.cotizacion_adjuntos(cotizacion_id)
  where tipo = 'PROFORMA_APROBADA';

-- Máximo 5 adjuntos complementarios por cotización.
create or replace function public.validar_limite_cotizacion_adjuntos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'ADJUNTO' then
    if (
      select count(*)
      from public.cotizacion_adjuntos
      where cotizacion_id = new.cotizacion_id
        and tipo = 'ADJUNTO'
        and (tg_op = 'INSERT' or id <> new.id)
    ) >= 5 then
      raise exception 'La cotización ya tiene el máximo de 5 adjuntos.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_limite_cotizacion_adjuntos on public.cotizacion_adjuntos;
create trigger trg_validar_limite_cotizacion_adjuntos
before insert or update on public.cotizacion_adjuntos
for each row execute function public.validar_limite_cotizacion_adjuntos();

alter table public.cotizacion_adjuntos enable row level security;

drop policy if exists "cotizacion_adjuntos_select_authenticated" on public.cotizacion_adjuntos;
create policy "cotizacion_adjuntos_select_authenticated"
on public.cotizacion_adjuntos for select
to authenticated
using (true);

drop policy if exists "cotizacion_adjuntos_insert_authenticated" on public.cotizacion_adjuntos;
create policy "cotizacion_adjuntos_insert_authenticated"
on public.cotizacion_adjuntos for insert
to authenticated
with check (true);

drop policy if exists "cotizacion_adjuntos_update_authenticated" on public.cotizacion_adjuntos;
create policy "cotizacion_adjuntos_update_authenticated"
on public.cotizacion_adjuntos for update
to authenticated
using (true)
with check (true);

drop policy if exists "cotizacion_adjuntos_delete_authenticated" on public.cotizacion_adjuntos;
create policy "cotizacion_adjuntos_delete_authenticated"
on public.cotizacion_adjuntos for delete
to authenticated
using (true);

-- Bucket privado para archivos de cotizaciones.
insert into storage.buckets (id, name, public)
values ('cotizaciones-adjuntos', 'cotizaciones-adjuntos', false)
on conflict (id) do update set public = false;

-- Policies de Storage. Los permisos finos de la UI siguen dependiendo
-- de gestionar_cotizaciones; Storage queda disponible para usuarios autenticados.
drop policy if exists "cotizaciones_adjuntos_storage_select" on storage.objects;
create policy "cotizaciones_adjuntos_storage_select"
on storage.objects for select
to authenticated
using (bucket_id = 'cotizaciones-adjuntos');

drop policy if exists "cotizaciones_adjuntos_storage_insert" on storage.objects;
create policy "cotizaciones_adjuntos_storage_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'cotizaciones-adjuntos');

drop policy if exists "cotizaciones_adjuntos_storage_update" on storage.objects;
create policy "cotizaciones_adjuntos_storage_update"
on storage.objects for update
to authenticated
using (bucket_id = 'cotizaciones-adjuntos')
with check (bucket_id = 'cotizaciones-adjuntos');

drop policy if exists "cotizaciones_adjuntos_storage_delete" on storage.objects;
create policy "cotizaciones_adjuntos_storage_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'cotizaciones-adjuntos');

commit;

notify pgrst, 'reload schema';
