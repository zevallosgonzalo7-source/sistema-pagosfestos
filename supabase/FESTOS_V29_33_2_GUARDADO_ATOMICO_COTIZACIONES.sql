-- FESTOS V29.33.2
-- HOTFIX CRITICO: edición atómica de cotizaciones + reemplazo real de ítems.
-- Ejecutar UNA VEZ en Supabase > SQL Editor antes de desplegar esta versión.
-- No borra cotizaciones existentes ni altera su estructura.

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
begin
  -- Requiere sesión FESTOS activa y permiso de gestión.
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  if not public.festos_is_active() or not public.festos_has_permission('gestionar_cotizaciones') then
    raise exception 'No tienes permiso para editar cotizaciones';
  end if;

  if not exists (select 1 from public.cotizaciones where id = p_quote_id) then
    raise exception 'La cotización no existe';
  end if;

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
         updated_by = p_payload->>'updated_by'
   where id = p_quote_id;

  -- El reemplazo sucede dentro de la misma transacción que la cabecera.
  delete from public.cotizacion_items where quote_id = p_quote_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
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
      coalesce(nullif(v_item->>'modo', ''), 'detallado'),
      coalesce((v_item->>'cantidad')::numeric, 0),
      coalesce((v_item->>'valor_unitario')::numeric, 0),
      coalesce((v_item->>'valor_total')::numeric, 0),
      coalesce((v_item->>'costo')::numeric, 0),
      coalesce((v_item->>'margen')::numeric, 0)
    );
    v_count := v_count + 1;
  end loop;

  -- Verificación dentro de la misma transacción.
  if (select count(*) from public.cotizacion_items where quote_id = p_quote_id) <> v_count then
    raise exception 'No se pudo reemplazar correctamente la lista de ítems';
  end if;

  return jsonb_build_object(
    'ok', true,
    'quote_id', p_quote_id,
    'item_count', v_count
  );
end;
$$;

revoke all on function public.actualizar_cotizacion_con_items(uuid, jsonb, jsonb) from public;
grant execute on function public.actualizar_cotizacion_con_items(uuid, jsonb, jsonb) to authenticated;

comment on function public.actualizar_cotizacion_con_items(uuid, jsonb, jsonb) is
'FESTOS: actualiza cabecera y reemplaza todos los ítems de una cotización en una única transacción.';
