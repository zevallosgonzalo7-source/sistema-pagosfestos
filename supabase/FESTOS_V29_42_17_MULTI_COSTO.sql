-- V29.42.17. Ejecutar DESPUÉS de V29.42.15, con copia de seguridad.
-- No elimina registros existentes.
alter table public.ventas add column if not exists costo_manual_activo boolean not null default false;
alter table public.ventas add column if not exists costo_manual numeric(14,2);

create or replace function public.guardar_venta_festos_v4(
 p_proyectos jsonb,
 p_fecha_factura date,
 p_tipo_documento text,
 p_numero_documento text,
 p_valor_venta numeric,
 p_lob text,
 p_detraccion_aplica boolean,
 p_porcentaje_detraccion numeric,
 p_ejecutivo text,
 p_observaciones text,
 p_created_by text default null,
 p_venta_id uuid default null,
 p_costo_manual_activo boolean default false,
 p_costo_manual numeric default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  item jsonb;
  pid uuid;
  first_pid uuid;
  first_client uuid;
  current_client uuid;
  n int:=0;
  total_asignado numeric(14,2):=0;
  asignado numeric(14,2);
  v_id uuid;
  resultado jsonb;
  v_costo numeric(14,2):=0;
  v_utilidad numeric(14,2);
  v_margen numeric(10,4);
  v_precio numeric(14,2);
  v_precio_asignado numeric(14,2);
  v_precio_previo numeric(14,2):=0;
  old_venta public.ventas%rowtype;
  old_count int:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if jsonb_typeof(p_proyectos) <> 'array' or jsonb_array_length(p_proyectos)=0 then raise exception 'Selecciona al menos un proyecto'; end if;
  if coalesce(p_costo_manual_activo,false) and (p_costo_manual is null or p_costo_manual<0) then raise exception 'Costo manual inválido'; end if;
  if coalesce(p_ejecutivo,'') not in ('GONZALO','MARJORIE MUÑOZ') then raise exception 'Ejecutivo inválido'; end if;
  if p_venta_id is not null then
    select * into old_venta from public.ventas where id=p_venta_id for update;
    if not found then raise exception 'Venta no encontrada'; end if;
    select count(*) into old_count from public.venta_proyectos where venta_id=p_venta_id;
    if old_count>1 and abs(coalesce(old_venta.valor_venta,0)-p_valor_venta)>0.009 then
      raise exception 'Para editar el importe de una venta multiproyecto primero debe regularizarse su distribución';
    end if;
  end if;
  for item in select value from jsonb_array_elements(p_proyectos) loop
    pid:=(item->>'project_id')::uuid;
    asignado:=round((item->>'valor_venta')::numeric,2);
    if pid is null or asignado<=0 then raise exception 'Asignación inválida'; end if;
    select client_id into current_client from public.proyectos where id=pid;
    if not found then raise exception 'Proyecto inexistente'; end if;
    if n=0 then first_pid:=pid; first_client:=current_client;
    elsif current_client is distinct from first_client then raise exception 'Los proyectos deben pertenecer al mismo cliente'; end if;
    if p_venta_id is not null and first_client is distinct from old_venta.client_id then raise exception 'No se puede cambiar el cliente de una venta existente'; end if;
    n:=n+1; total_asignado:=total_asignado+asignado;
  end loop;
  if n <> (select count(distinct (value->>'project_id')) from jsonb_array_elements(p_proyectos)) then raise exception 'Proyectos duplicados'; end if;
  if abs(total_asignado-round(p_valor_venta,2))>0.009 then raise exception 'La distribución no coincide con el valor de venta'; end if;
  if p_venta_id is null then
    resultado:=public.registrar_venta_festos_v3(first_pid,p_fecha_factura,p_tipo_documento,p_numero_documento,p_valor_venta,p_lob,p_detraccion_aplica,p_observaciones,p_created_by,p_porcentaje_detraccion,p_ejecutivo);
    v_id:=(resultado->>'venta_id')::uuid;
  else
    resultado:=public.editar_venta_festos_v3(p_venta_id,p_fecha_factura,p_tipo_documento,p_numero_documento,p_valor_venta,p_lob,p_detraccion_aplica,p_observaciones,p_porcentaje_detraccion,p_ejecutivo);
    v_id:=p_venta_id;
  end if;
  if p_costo_manual_activo then
    v_costo:=round(p_costo_manual,2);
  else
    select coalesce(sum(coalesce(nullif(monto_base,0),monto,0)),0)::numeric(14,2) into v_costo
      from public.compras where project_id in (select (value->>'project_id')::uuid from jsonb_array_elements(p_proyectos));
  end if;
  v_utilidad:=round(p_valor_venta-v_costo,2);
  v_margen:=case when p_valor_venta>0 then round(v_utilidad/p_valor_venta*100,4) else 0 end;
  update public.ventas set project_id=first_pid, costo=v_costo, utilidad=v_utilidad,margen=v_margen,
    costo_manual_activo=coalesce(p_costo_manual_activo,false),costo_manual=case when p_costo_manual_activo then v_costo else null end
    where id=v_id;
  delete from public.venta_proyectos where venta_id=v_id;
  v_precio:=round(p_valor_venta*1.18,2);
  for item in select value from jsonb_array_elements(p_proyectos) loop
    pid:=(item->>'project_id')::uuid;
    asignado:=round((item->>'valor_venta')::numeric,2);
    n:=n-1;
    v_precio_asignado:=case when n=0 then v_precio-v_precio_previo else round(asignado*1.18,2) end;
    v_precio_previo:=v_precio_previo+v_precio_asignado;
    insert into public.venta_proyectos(venta_id,project_id,valor_venta_asignado,precio_venta_asignado,costo_real_snapshot,utilidad_real_snapshot,margen_real_snapshot)
    values(v_id,pid,asignado,v_precio_asignado,
      round(v_costo*asignado/p_valor_venta,2),
      round(v_utilidad*asignado/p_valor_venta,2),v_margen);
  end loop;
  return resultado||jsonb_build_object('costo',v_costo,'utilidad',v_utilidad,'margen',v_margen);
end $$;
grant execute on function public.guardar_venta_festos_v4(jsonb,date,text,text,numeric,text,boolean,numeric,text,text,text,uuid,boolean,numeric) to authenticated;
