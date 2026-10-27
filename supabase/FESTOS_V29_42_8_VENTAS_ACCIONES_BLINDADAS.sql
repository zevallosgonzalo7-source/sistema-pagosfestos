-- FESTOS V29.42.8 — REG. VENTAS / EDITAR + ELIMINAR BLINDADO
-- Ejecutar después de V29.42, V29.42.1 y V29.42.5.
-- Corrige RPCs, permisos, recálculo de facturación y fuerza refresh del schema cache de PostgREST.

begin;

-- RLS: la UI necesita poder editar/eliminar ventas autenticadas como fallback seguro.
alter table public.ventas enable row level security;
do $$ begin create policy ventas_update_auth on public.ventas for update to authenticated using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy ventas_delete_auth on public.ventas for delete to authenticated using (true); exception when duplicate_object then null; end $$;

grant select, insert, update, delete on public.ventas to authenticated;
grant select, insert, update, delete on public.ventas_cobros to authenticated;
grant select, insert, update, delete on public.venta_proyectos to authenticated;
grant select, update on public.proyectos to authenticated;
grant select, update on public.compras to authenticated;

-- Helper único: recalcula el avance de facturación de un proyecto considerando
-- venta_proyectos (multiproyecto) + ventas directas antiguas que no tienen vínculo.
create or replace function public.recalcular_facturacion_proyecto_festos(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_total numeric(14,2):=0;
  v_objetivo numeric(14,2):=0;
  v_estado text:='NO FACTURADO';
  v_ultima date;
  v_estado_actual text;
begin
  if p_project_id is null then
    return jsonb_build_object('ok',false,'motivo','project_id vacío');
  end if;

  if not exists(select 1 from public.proyectos where id=p_project_id) then
    return jsonb_build_object('ok',false,'motivo','Proyecto no encontrado');
  end if;

  select coalesce(sum(x.monto),0)::numeric(14,2), max(x.fecha_factura)
    into v_total,v_ultima
  from (
    select vp.precio_venta_asignado as monto, v.fecha_factura
      from public.venta_proyectos vp
      join public.ventas v on v.id=vp.venta_id
     where vp.project_id=p_project_id
    union all
    select v.precio_venta as monto, v.fecha_factura
      from public.ventas v
     where v.project_id=p_project_id
       and not exists(select 1 from public.venta_proyectos vp where vp.venta_id=v.id)
  ) x;

  select coalesce(nullif(valor_base,0),nullif(valor_venta,0),0)*1.18, estado
    into v_objetivo,v_estado_actual
  from public.proyectos
  where id=p_project_id;

  v_estado:=case
    when v_total<=0.01 then 'NO FACTURADO'
    when v_objetivo>0 and v_total>=v_objetivo-0.01 then 'FACTURADO'
    else 'PARCIAL'
  end;

  update public.proyectos
     set total_facturado=v_total,
         facturacion_estado=v_estado,
         fecha_ultima_factura=v_ultima,
         estado=case
           when v_estado='FACTURADO' then 'FACTURADO'
           when estado='FACTURADO' and v_estado<>'FACTURADO' then 'FINALIZADO'
           else estado
         end
   where id=p_project_id;

  return jsonb_build_object(
    'ok',true,
    'project_id',p_project_id,
    'total_facturado',v_total,
    'facturacion_estado',v_estado,
    'fecha_ultima_factura',v_ultima
  );
end $$;

grant execute on function public.recalcular_facturacion_proyecto_festos(uuid) to authenticated;

create or replace function public.editar_venta_festos(
  p_venta_id uuid,
  p_fecha_factura date,
  p_fecha_control date,
  p_tipo_documento text,
  p_numero_documento text,
  p_precio_venta numeric,
  p_retencion numeric default 0,
  p_detraccion_aplica boolean default false,
  p_porcentaje_detraccion numeric default 12,
  p_porcentaje_comision numeric default null,
  p_observaciones text default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v public.ventas%rowtype;
  v_pagado numeric(14,2):=0;
  v_det_pagada numeric(14,2):=0;
  v_valor numeric(14,2):=0;
  v_utilidad numeric(14,2):=0;
  v_margen numeric(10,4):=0;
  v_det numeric(14,2):=0;
  v_pago_esp numeric(14,2):=0;
  v_saldo_com numeric(14,2):=0;
  v_saldo_det numeric(14,2):=0;
  v_venc date;
  v_comision numeric(14,2):=0;
  v_pid uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v from public.ventas where id=p_venta_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  if p_precio_venta is null or p_precio_venta<=0 then raise exception 'Precio de venta inválido'; end if;
  if coalesce(trim(p_numero_documento),'')='' then raise exception 'Número de comprobante obligatorio'; end if;

  if (select count(*) from public.venta_proyectos where venta_id=p_venta_id)>1
     and abs(coalesce(p_precio_venta,0)-coalesce(v.precio_venta,0))>0.01 then
    raise exception 'Factura multiproyecto: el monto total no puede modificarse desde esta edición simple';
  end if;

  select coalesce(sum(monto),0) into v_pagado
    from public.ventas_cobros where venta_id=p_venta_id and tipo='PAGO_COMERCIAL';
  select coalesce(sum(monto),0) into v_det_pagada
    from public.ventas_cobros where venta_id=p_venta_id and tipo='DETRACCION';

  v_valor:=round(p_precio_venta/1.18,2);
  v_utilidad:=round(v_valor-coalesce(v.costo,0),2);
  v_margen:=case when v_valor>0 then round((v_utilidad/v_valor)*100,4) else 0 end;
  v_det:=case when coalesce(p_detraccion_aplica,false)
              then round(p_precio_venta*coalesce(p_porcentaje_detraccion,12)/100,2) else 0 end;
  v_pago_esp:=greatest(round(p_precio_venta-coalesce(p_retencion,0)-v_det,2),0);

  if v_pagado>v_pago_esp+0.01 then
    raise exception 'El nuevo precio dejaría pagos comerciales por encima del saldo permitido';
  end if;
  if v_det_pagada>v_det+0.01 then
    raise exception 'La nueva detracción sería menor a la detracción ya pagada';
  end if;

  v_saldo_com:=greatest(v_pago_esp-v_pagado,0);
  v_saldo_det:=greatest(v_det-v_det_pagada,0);
  v_venc:=p_fecha_factura+coalesce(v.plazo_dias,0);
  v_comision:=round(v_valor*coalesce(p_porcentaje_comision,v.porcentaje_comision,0)/100,2);

  update public.ventas set
    fecha_factura=p_fecha_factura,
    fecha_control=coalesce(p_fecha_control,p_fecha_factura),
    tipo_documento=upper(coalesce(p_tipo_documento,'FACTURA')),
    numero_documento=trim(p_numero_documento),
    valor_venta=v_valor,
    precio_venta=p_precio_venta,
    utilidad=v_utilidad,
    margen=v_margen,
    fecha_vencimiento=v_venc,
    retencion=coalesce(p_retencion,0),
    detraccion=v_det,
    detraccion_aplica=coalesce(p_detraccion_aplica,false),
    porcentaje_detraccion=case when p_detraccion_aplica then coalesce(p_porcentaje_detraccion,12) else 0 end,
    pago_comercial_esperado=v_pago_esp,
    saldo_comercial=v_saldo_com,
    saldo_detraccion=v_saldo_det,
    saldo=v_saldo_com+v_saldo_det,
    estado_detraccion=case when v_det<=0 then 'NO APLICA' when v_saldo_det<=0.01 then 'PAGADA' else 'PENDIENTE' end,
    porcentaje_comision=coalesce(p_porcentaje_comision,porcentaje_comision,0),
    comision=v_comision,
    observaciones=p_observaciones,
    updated_at=now()
  where id=p_venta_id;

  -- Fecha de control a TODAS las compras de los proyectos relacionados.
  for v_pid in
    select distinct project_id from (
      select v.project_id where v.project_id is not null
      union all
      select vp.project_id from public.venta_proyectos vp where vp.venta_id=p_venta_id
    ) q
  loop
    update public.compras
       set fecha_control=coalesce(p_fecha_control,p_fecha_factura)
     where project_id=v_pid;
    perform public.recalcular_facturacion_proyecto_festos(v_pid);
  end loop;

  return jsonb_build_object('ok',true,'venta_id',p_venta_id,'saldo',v_saldo_com+v_saldo_det);
end $$;

grant execute on function public.editar_venta_festos(uuid,date,date,text,text,numeric,numeric,boolean,numeric,numeric,text) to authenticated;

create or replace function public.eliminar_venta_festos(p_venta_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v public.ventas%rowtype;
  v_projects uuid[]:=array[]::uuid[];
  pid uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v from public.ventas where id=p_venta_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;

  select coalesce(array_agg(distinct project_id) filter (where project_id is not null),array[]::uuid[])
    into v_projects
  from (
    select v.project_id as project_id
    union all
    select project_id from public.venta_proyectos where venta_id=p_venta_id
  ) q;

  -- ventas_cobros y venta_proyectos se eliminan por ON DELETE CASCADE.
  delete from public.ventas where id=p_venta_id;

  foreach pid in array v_projects loop
    perform public.recalcular_facturacion_proyecto_festos(pid);
  end loop;

  return jsonb_build_object(
    'ok',true,
    'venta_id',p_venta_id,
    'proyectos_recalculados',cardinality(v_projects)
  );
end $$;

grant execute on function public.eliminar_venta_festos(uuid) to authenticated;

commit;

-- Fuerza a PostgREST/Supabase API a refrescar funciones recién creadas.
notify pgrst, 'reload schema';

-- Verificación: deben aparecer las tres funciones.
select
  p.proname as funcion,
  pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('editar_venta_festos','eliminar_venta_festos','recalcular_facturacion_proyecto_festos')
order by p.proname;
