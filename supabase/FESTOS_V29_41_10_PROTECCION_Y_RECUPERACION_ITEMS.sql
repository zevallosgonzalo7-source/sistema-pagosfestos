-- ============================================================
-- FESTOS V29.41.10
-- PROTECCIÓN DE ÍTEMS + RECUPERACIÓN COT-2026-953312
-- ============================================================
-- Objetivos:
-- 1) En modo DIRECTO los ítems son opcionales, pero NUNCA se borran
--    automáticamente si una edición llega con p_items vacío.
-- 2) Antes de reemplazar ítems, guardar snapshot histórico.
-- 3) Recuperar los 20 ítems visibles en el PDF de COT-2026-953312.
--
-- IMPORTANTE:
-- El PDF no contiene costos internos ni valores por ítem; por eso esos
-- campos se recuperan en 0 y deberán reingresarse manualmente si aplicaba.

begin;

-- ------------------------------------------------------------
-- A. HISTORIAL DE SEGURIDAD
-- ------------------------------------------------------------
create table if not exists public.cotizacion_items_historial (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null,
  quote_id uuid not null references public.cotizaciones(id) on delete cascade,
  source_item_id uuid,
  orden integer,
  descripcion text,
  categoria text,
  modo text,
  cantidad numeric(14,4),
  valor_unitario numeric(14,2),
  valor_total numeric(14,2),
  costo numeric(14,2),
  margen numeric(8,4),
  snapshot_at timestamptz not null default now(),
  snapshot_by uuid default auth.uid(),
  motivo text not null default 'edicion_cotizacion'
);

create index if not exists idx_cotizacion_items_historial_quote
  on public.cotizacion_items_historial(quote_id, snapshot_at desc);

alter table public.cotizacion_items_historial enable row level security;

drop policy if exists "festos cotizacion items historial select" on public.cotizacion_items_historial;
create policy "festos cotizacion items historial select"
on public.cotizacion_items_historial
for select
to authenticated
using (
  public.festos_is_active()
  and public.festos_has_permission('ver_cotizaciones')
);

-- ------------------------------------------------------------
-- B. FUNCIÓN SEGURA DE ACTUALIZACIÓN
-- ------------------------------------------------------------
create or replace function public.actualizar_cotizacion_con_items(
  p_quote_id uuid,
  p_payload jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_count integer := 0;
  v_existing_count integer := 0;
  v_incoming_count integer := 0;
  v_mode text := 'detallado';
  v_snapshot_id uuid := gen_random_uuid();
  v_preserved boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  if not public.festos_is_active()
     or not public.festos_has_permission('gestionar_cotizaciones') then
    raise exception 'No tienes permiso para editar cotizaciones';
  end if;

  if not exists (select 1 from public.cotizaciones where id = p_quote_id) then
    raise exception 'La cotización no existe';
  end if;

  v_mode := lower(coalesce(nullif(p_payload->>'modo', ''), 'detallado'));
  if v_mode not in ('directo','detallado') then
    v_mode := 'detallado';
  end if;

  select count(*) into v_existing_count
  from public.cotizacion_items
  where quote_id = p_quote_id;

  v_incoming_count := jsonb_array_length(coalesce(p_items, '[]'::jsonb));

  update public.cotizaciones
     set client_id = (p_payload->>'client_id')::uuid,
         project_id = nullif(p_payload->>'project_id', '')::uuid,
         proyecto_nombre = p_payload->>'proyecto_nombre',
         lob = p_payload->>'lob',
         ejecutivo = p_payload->>'ejecutivo',
         codigo = p_payload->>'codigo',
         descripcion = nullif(p_payload->>'descripcion', ''),
         estado = p_payload->>'estado',
         aplicar_igv = coalesce((p_payload->>'aplicar_igv')::boolean, true),
         igv_rate = coalesce((p_payload->>'igv_rate')::numeric, 0.18),
         subtotal = coalesce((p_payload->>'subtotal')::numeric, 0),
         descuento = coalesce((p_payload->>'descuento')::numeric, 0),
         igv = coalesce((p_payload->>'igv')::numeric, 0),
         total = coalesce((p_payload->>'total')::numeric, 0),
         costo_estimado = coalesce((p_payload->>'costo_estimado')::numeric, 0),
         ganancia_estimada = coalesce((p_payload->>'ganancia_estimada')::numeric, 0),
         margen = coalesce((p_payload->>'margen')::numeric, 0),
         modo = v_mode,
         updated_by = p_payload->>'updated_by'
   where id = p_quote_id;

  -- BLINDAJE PRINCIPAL:
  -- Si la cotización es DIRECTA, ya tenía ítems, y por un bug llega []:
  -- NO BORRAR NADA.
  if v_mode = 'directo' and v_existing_count > 0 and v_incoming_count = 0 then
    v_preserved := true;
    v_count := v_existing_count;
  else
    -- Snapshot antes de cualquier reemplazo/borrado.
    if v_existing_count > 0 then
      insert into public.cotizacion_items_historial (
        snapshot_id, quote_id, source_item_id, orden, descripcion,
        categoria, modo, cantidad, valor_unitario, valor_total,
        costo, margen, snapshot_by, motivo
      )
      select
        v_snapshot_id, i.quote_id, i.id, i.orden, i.descripcion,
        i.categoria, i.modo, i.cantidad, i.valor_unitario, i.valor_total,
        i.costo, i.margen, auth.uid(), 'antes_de_reemplazar_items'
      from public.cotizacion_items i
      where i.quote_id = p_quote_id;
    end if;

    delete from public.cotizacion_items
    where quote_id = p_quote_id;

    for v_item in
      select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    loop
      insert into public.cotizacion_items (
        id, quote_id, orden, descripcion, categoria, modo,
        cantidad, valor_unitario, valor_total, costo, margen
      ) values (
        gen_random_uuid(),
        p_quote_id,
        coalesce((v_item->>'orden')::integer, v_count + 1),
        coalesce(v_item->>'descripcion', ''),
        nullif(v_item->>'categoria', ''),
        coalesce(nullif(lower(v_item->>'modo'), ''), v_mode),
        coalesce((v_item->>'cantidad')::numeric, 0),
        coalesce((v_item->>'valor_unitario')::numeric, 0),
        coalesce((v_item->>'valor_total')::numeric, 0),
        coalesce((v_item->>'costo')::numeric, 0),
        coalesce((v_item->>'margen')::numeric, 0)
      );
      v_count := v_count + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'quote_id', p_quote_id,
    'item_count', v_count,
    'preserved_items', v_preserved,
    'snapshot_id', case when v_existing_count > 0 and not v_preserved then v_snapshot_id else null end
  );
end;
$$;

revoke all on function public.actualizar_cotizacion_con_items(uuid, jsonb, jsonb) from public;
grant execute on function public.actualizar_cotizacion_con_items(uuid, jsonb, jsonb) to authenticated;

-- ------------------------------------------------------------
-- C. RECUPERACIÓN: COT-2026-953312
-- ------------------------------------------------------------
-- Se restaura SOLO si actualmente no tiene ítems, para evitar duplicados.
do $$
declare
  v_quote_id uuid;
  v_count integer;
begin
  select id into v_quote_id
  from public.cotizaciones
  where codigo = 'COT-2026-953312'
  limit 1;

  if v_quote_id is null then
    raise exception 'No se encontró la cotización COT-2026-953312';
  end if;

  select count(*) into v_count
  from public.cotizacion_items
  where quote_id = v_quote_id;

  if v_count > 0 then
    raise notice 'COT-2026-953312 ya tiene % ítems. No se insertó nada para evitar duplicados.', v_count;
    return;
  end if;

  insert into public.cotizacion_items
    (quote_id, orden, descripcion, modo, cantidad, valor_unitario, valor_total, costo, margen)
  values
    (v_quote_id,  1, 'Arco de ingreso (modelo 1)', 'directo', 1,    0, 0, 0, 0),
    (v_quote_id,  2, 'MO instalación', 'directo', 2,               0, 0, 0, 0),
    (v_quote_id,  3, 'Plumas 3m', 'directo', 6,                    0, 0, 0, 0),
    (v_quote_id,  4, 'Banners 2m x 1m (con ojalillo y soguilla)', 'directo', 6, 0, 0, 0, 0),
    (v_quote_id,  5, 'Stickers para tribuna', 'directo', 5000,     0, 0, 0, 0),
    (v_quote_id,  6, 'Transporte Arco', 'directo', 2,              0, 0, 0, 0),
    (v_quote_id,  7, 'Glitter bar (Servicio incluye personal & materiales) x4 hora', 'directo', 3, 0, 0, 0, 0),
    (v_quote_id,  8, 'Glitter bar (fabricacion de bandejas personalizadas)', 'directo', 3, 0, 0, 0, 0),
    (v_quote_id,  9, 'Glitter bar (fabricacion de vestuarios promotoras )', 'directo', 3, 0, 0, 0, 0),
    (v_quote_id, 10, 'Merchandising (pañoleta personalizasda 2 diseños)', 'directo', 500, 0, 0, 0, 0),
    (v_quote_id, 11, 'Merchandising (porta toallitas personalizada 1 diseño)', 'directo', 500, 0, 0, 0, 0),
    (v_quote_id, 12, 'Merchandising (Pines 5.5c m)', 'directo', 2000, 0, 0, 0, 0),
    (v_quote_id, 13, 'Personal de apoyo', 'directo', 2,             0, 0, 0, 0),
    (v_quote_id, 14, 'Productor / Supervisor', 'directo', 1,       0, 0, 0, 0),
    (v_quote_id, 15, 'Viaticos', 'directo', 8,                     0, 0, 0, 0),
    (v_quote_id, 16, 'Gastos logísticos', 'directo', 1,            0, 0, 0, 0),
    (v_quote_id, 17, 'Movilidad y transporte de personal', 'directo', 1, 0, 0, 0, 0),
    (v_quote_id, 18, 'Sampling (personal promotoras) x 4horas', 'directo', 3, 0, 0, 0, 0),
    (v_quote_id, 19, 'Sampling (bolso grande tote bag )', 'directo', 3, 0, 0, 0, 0),
    (v_quote_id, 20, 'Sampling (uniforme personal )', 'directo', 3, 0, 0, 0, 0);

  update public.cotizaciones
  set modo = 'directo'
  where id = v_quote_id;

  raise notice 'Recuperados 20 ítems en COT-2026-953312.';
end;
$$;

notify pgrst, 'reload schema';
commit;

-- VERIFICACIÓN
select
  c.codigo,
  i.orden,
  i.descripcion,
  i.cantidad,
  i.costo,
  i.valor_total,
  i.margen
from public.cotizaciones c
join public.cotizacion_items i on i.quote_id = c.id
where c.codigo = 'COT-2026-953312'
order by i.orden;
