-- FESTOS V29.42.15. Ejecutar en Supabase SQL Editor ANTES de instalar la aplicación.
-- Aplica a la base existente. No borra datos ni reemplaza las funciones V2.
create extension if not exists pgcrypto;
create table if not exists public.ventas_adjuntos (
 id uuid primary key default gen_random_uuid(),
 venta_id uuid not null references public.ventas(id) on delete cascade,
 nombre text not null,
 ruta text not null unique,
 tamano bigint not null default 0,
 tipo text,
 created_at timestamptz not null default now()
);
create index if not exists idx_ventas_adjuntos_venta on public.ventas_adjuntos(venta_id);
alter table public.ventas_adjuntos enable row level security;
-- La aplicación utiliza usuarios autenticados. Ajustar según los roles de producción.
drop policy if exists ventas_adjuntos_select on public.ventas_adjuntos;
create policy ventas_adjuntos_select on public.ventas_adjuntos for select to authenticated using (true);
drop policy if exists ventas_adjuntos_insert on public.ventas_adjuntos;
create policy ventas_adjuntos_insert on public.ventas_adjuntos for insert to authenticated with check (true);
drop policy if exists ventas_adjuntos_delete on public.ventas_adjuntos;
create policy ventas_adjuntos_delete on public.ventas_adjuntos for delete to authenticated using (true);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('ventas-adjuntos','ventas-adjuntos',false,15728640,null)
on conflict (id) do nothing;
drop policy if exists festos_ventas_storage_read on storage.objects;
create policy festos_ventas_storage_read on storage.objects for select to authenticated using (bucket_id='ventas-adjuntos');
drop policy if exists festos_ventas_storage_insert on storage.objects;
create policy festos_ventas_storage_insert on storage.objects for insert to authenticated with check (bucket_id='ventas-adjuntos');
drop policy if exists festos_ventas_storage_delete on storage.objects;
create policy festos_ventas_storage_delete on storage.objects for delete to authenticated using (bucket_id='ventas-adjuntos');

create or replace function public.registrar_venta_festos_v3(
  p_project_id uuid,
  p_fecha_factura date,
  p_tipo_documento text,
  p_numero_documento text,
  p_valor_venta numeric,
  p_lob text,
  p_detraccion_aplica boolean default false,
  p_observaciones text default null,
  p_created_by text default null,
  p_porcentaje_detraccion numeric default 12,
  p_ejecutivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_project record;
  v_cliente record;
  v_venta_id uuid;
  v_precio numeric(14,2);
  v_costo numeric(14,2):=0;
  v_utilidad numeric(14,2):=0;
  v_margen numeric(10,4):=0;
  v_retencion numeric(14,2):=0;
  v_detraccion numeric(14,2):=0;
  v_pago_esperado numeric(14,2):=0;
  v_plazo integer:=0;
  v_condicion text:='CONTADO';
  v_venc date;
  v_det_activa boolean:=false;
  v_project_valor numeric(14,2):=0;
  v_project_utilidad numeric(14,2):=0;
  v_project_margen numeric(10,4):=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_project_id is null then raise exception 'Proyecto obligatorio'; end if;
  if coalesce(trim(p_ejecutivo),'')='' then raise exception 'Ejecutivo obligatorio'; end if;
  if p_porcentaje_detraccion<0 or p_porcentaje_detraccion>100 then raise exception 'Porcentaje de detracción inválido'; end if;
  if p_fecha_factura is null then raise exception 'Fecha factura obligatoria'; end if;
  if coalesce(trim(p_numero_documento),'')='' then raise exception 'Número de comprobante obligatorio'; end if;
  if coalesce(p_valor_venta,0)<=0 then raise exception 'Valor venta debe ser mayor a cero'; end if;
  if p_lob not in ('GRAFICA PUBLICITARIA','MERCH & GIFTS','ESPACIOS Y ESTRUCTURAS','AGENCIA 360°') then
    raise exception 'LOB inválido';
  end if;

  select * into v_project from public.proyectos where id=p_project_id;
  if not found then raise exception 'Proyecto no encontrado'; end if;
  select * into v_cliente from public.clientes where id=v_project.client_id;
  if not found then raise exception 'Cliente no encontrado'; end if;

  v_precio := round(p_valor_venta*1.18,2);
  v_condicion := upper(coalesce(v_cliente.tipo_pago,'CONTADO'));
  v_plazo := case when v_condicion in ('CREDITO','CRÉDITO') then coalesce(v_cliente.plazo_dias,0) else 0 end;
  v_venc := p_fecha_factura + v_plazo;

  select coalesce(sum(coalesce(nullif(monto_base,0),monto,0)),0)::numeric(14,2)
  into v_costo
  from public.compras
  where project_id=p_project_id;

  v_utilidad := round(p_valor_venta-v_costo,2);
  v_margen := case when p_valor_venta>0 then round((v_utilidad/p_valor_venta)*100,4) else 0 end;

  -- Regla: Precio venta <= S/700 => no retención ni detracción.
  v_det_activa := v_precio>700 and coalesce(p_detraccion_aplica,false);
  if v_det_activa then
    v_detraccion := round(v_precio*p_porcentaje_detraccion/100,2);
    v_retencion := 0;
  elsif v_precio>700 and coalesce(v_cliente.agente_retenedor,false) then
    v_retencion := round(v_precio*0.03,2);
    v_detraccion := 0;
  end if;
  v_pago_esperado := greatest(round(v_precio-v_retencion-v_detraccion,2),0);

  insert into public.ventas(
    project_id,client_id,fecha_factura,fecha_control,tipo_documento,numero_documento,lob,ejecutivo,
    valor_venta,precio_venta,costo,utilidad,margen,condicion_pago,plazo_dias,fecha_vencimiento,
    retencion,detraccion,detraccion_aplica,porcentaje_detraccion,pago_comercial_esperado,
    pagado,detraccion_pagada,saldo_comercial,saldo_detraccion,saldo,estado_detraccion,
    porcentaje_comision,comision,observaciones,created_by
  ) values (
    p_project_id,v_project.client_id,p_fecha_factura,p_fecha_factura,upper(coalesce(p_tipo_documento,'FACTURA')),trim(p_numero_documento),p_lob,trim(p_ejecutivo),
    round(p_valor_venta,2),v_precio,v_costo,v_utilidad,v_margen,v_condicion,v_plazo,v_venc,
    v_retencion,v_detraccion,v_det_activa,case when v_det_activa then p_porcentaje_detraccion else 0 end,v_pago_esperado,
    0,0,v_pago_esperado,v_detraccion,v_pago_esperado+v_detraccion,case when v_detraccion>0 then 'PENDIENTE' else 'NO APLICA' end,
    0,0,p_observaciones,p_created_by
  ) returning id into v_venta_id;

  -- Registro de Ventas define el LOB del proyecto y de sus compras.
  v_project_valor:=coalesce(nullif(v_project.valor_base,0),nullif(v_project.valor_venta,0),p_valor_venta,0);
  v_project_utilidad:=round(v_project_valor-v_costo,2);
  v_project_margen:=case when v_project_valor>0 then round((v_project_utilidad/v_project_valor)*100,4) else 0 end;

  update public.proyectos
  set lob=p_lob,
      costo_real=v_costo,
      utilidad_real=v_project_utilidad,
      margen_real=v_project_margen
  where id=p_project_id;

  update public.compras
  set lob=p_lob,
      fecha_control=p_fecha_factura
  where project_id=p_project_id;

  -- Relación explícita para compatibilidad multiproyecto.
  if to_regclass('public.venta_proyectos') is not null then
    insert into public.venta_proyectos(venta_id,project_id,valor_venta_asignado,precio_venta_asignado,costo_real_snapshot,utilidad_real_snapshot,margen_real_snapshot)
    values(v_venta_id,p_project_id,round(p_valor_venta,2),v_precio,v_costo,v_utilidad,v_margen)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'ok',true,'venta_id',v_venta_id,'valor_venta',round(p_valor_venta,2),'precio_venta',v_precio,
    'igv',round(v_precio-p_valor_venta,2),'retencion',v_retencion,'detraccion',v_detraccion,
    'pago_comercial_esperado',v_pago_esperado,'fecha_vencimiento',v_venc,'lob',p_lob
  );
end $$;

grant execute on function public.registrar_venta_festos_v3(uuid,date,text,text,numeric,text,boolean,text,text,numeric,text) to authenticated;

-- 4) Editar venta V2: mismas reglas automáticas.
create or replace function public.editar_venta_festos_v3(
  p_venta_id uuid,
  p_fecha_factura date,
  p_tipo_documento text,
  p_numero_documento text,
  p_valor_venta numeric,
  p_lob text,
  p_detraccion_aplica boolean default false,
  p_observaciones text default null,
  p_porcentaje_detraccion numeric default 12,
  p_ejecutivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v public.ventas%rowtype;
  v_cliente record;
  v_precio numeric(14,2);
  v_retencion numeric(14,2):=0;
  v_detraccion numeric(14,2):=0;
  v_pagado numeric(14,2):=0;
  v_det_pagada numeric(14,2):=0;
  v_pago_esperado numeric(14,2):=0;
  v_saldo_com numeric(14,2):=0;
  v_saldo_det numeric(14,2):=0;
  v_utilidad numeric(14,2):=0;
  v_margen numeric(10,4):=0;
  v_venc date;
  v_det_activa boolean:=false;
  pid uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select * into v from public.ventas where id=p_venta_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  if coalesce(trim(p_ejecutivo),'')='' then raise exception 'Ejecutivo obligatorio'; end if;
  if p_porcentaje_detraccion<0 or p_porcentaje_detraccion>100 then raise exception 'Porcentaje de detracción inválido'; end if;
  if coalesce(p_valor_venta,0)<=0 then raise exception 'Valor venta debe ser mayor a cero'; end if;
  if (select count(*) from public.venta_proyectos where venta_id=p_venta_id)>1
     and abs(coalesce(p_valor_venta,0)-coalesce(v.valor_venta,0))>0.01 then
    raise exception 'Factura multiproyecto: el Valor venta total no puede modificarse desde esta edición simple';
  end if;
  if p_lob not in ('GRAFICA PUBLICITARIA','MERCH & GIFTS','ESPACIOS Y ESTRUCTURAS','AGENCIA 360°') then raise exception 'LOB inválido'; end if;

  select * into v_cliente from public.clientes where id=v.client_id;
  v_precio := round(p_valor_venta*1.18,2);
  v_det_activa := v_precio>700 and coalesce(p_detraccion_aplica,false);
  if v_det_activa then
    v_detraccion:=round(v_precio*p_porcentaje_detraccion/100,2);
  elsif v_precio>700 and coalesce(v_cliente.agente_retenedor,false) then
    v_retencion:=round(v_precio*0.03,2);
  end if;

  select coalesce(sum(monto),0) into v_pagado from public.ventas_cobros where venta_id=p_venta_id and tipo='PAGO_COMERCIAL';
  select coalesce(sum(monto),0) into v_det_pagada from public.ventas_cobros where venta_id=p_venta_id and tipo='DETRACCION';

  v_pago_esperado:=greatest(round(v_precio-v_retencion-v_detraccion,2),0);
  if v_pagado>v_pago_esperado+0.01 then raise exception 'El nuevo valor venta es menor a los pagos comerciales ya registrados'; end if;
  v_saldo_com:=greatest(round(v_pago_esperado-v_pagado,2),0);
  v_saldo_det:=greatest(round(v_detraccion-v_det_pagada,2),0);
  v_utilidad:=round(p_valor_venta-coalesce(v.costo,0),2);
  v_margen:=case when p_valor_venta>0 then round((v_utilidad/p_valor_venta)*100,4) else 0 end;
  v_venc:=p_fecha_factura+coalesce(v.plazo_dias,0);

  update public.ventas set
    fecha_factura=p_fecha_factura,fecha_control=p_fecha_factura,tipo_documento=upper(coalesce(p_tipo_documento,'FACTURA')),
    numero_documento=trim(p_numero_documento),lob=p_lob,ejecutivo=trim(p_ejecutivo),valor_venta=round(p_valor_venta,2),precio_venta=v_precio,
    utilidad=v_utilidad,margen=v_margen,fecha_vencimiento=v_venc,retencion=v_retencion,detraccion=v_detraccion,
    detraccion_aplica=v_det_activa,porcentaje_detraccion=case when v_det_activa then p_porcentaje_detraccion else 0 end,
    pago_comercial_esperado=v_pago_esperado,saldo_comercial=v_saldo_com,detraccion_pagada=v_det_pagada,
    saldo_detraccion=v_saldo_det,saldo=v_saldo_com+v_saldo_det,
    estado_detraccion=case when v_detraccion<=0 then 'NO APLICA' when v_saldo_det<=0.01 then 'PAGADA' else 'PENDIENTE' end,
    porcentaje_comision=0,comision=0,observaciones=p_observaciones,updated_at=now()
  where id=p_venta_id;

  if (select count(*) from public.venta_proyectos where venta_id=p_venta_id)=1 then
    update public.venta_proyectos
       set valor_venta_asignado=round(p_valor_venta,2),
           precio_venta_asignado=v_precio,
           utilidad_real_snapshot=v_utilidad,
           margen_real_snapshot=v_margen
     where venta_id=p_venta_id;
  end if;

  for pid in
    select distinct project_id from (
      select v.project_id as project_id
      union all
      select vp.project_id from public.venta_proyectos vp where vp.venta_id=p_venta_id
    ) q where project_id is not null
  loop
    update public.proyectos set lob=p_lob where id=pid;
    update public.compras set lob=p_lob,fecha_control=p_fecha_factura where project_id=pid;
  end loop;

  return jsonb_build_object('ok',true,'venta_id',p_venta_id,'precio_venta',v_precio,'retencion',v_retencion,'detraccion',v_detraccion,'pago_comercial_esperado',v_pago_esperado,'fecha_vencimiento',v_venc);
end $$;

grant execute on function public.editar_venta_festos_v3(uuid,date,text,text,numeric,text,boolean,text,numeric,text) to authenticated;

