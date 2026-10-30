-- FESTOS V29.42.10
-- Registro de Ventas: LOB como fuente, agente retenedor, valor venta, reglas S/700,
-- retención 3%, detracción 12%, fecha control = fecha factura y cobros de detracción redondeados.

begin;

-- 1) Clientes: agente retenedor
alter table public.clientes
  add column if not exists agente_retenedor boolean not null default false;

grant select, update on public.clientes to authenticated;

-- 2) Separar Categoría de LOB en Proyectos sin destruir datos anteriores.
alter table public.proyectos
  add column if not exists categoria text;

update public.proyectos
set categoria = lob
where categoria is null
  and lob in (
    'Gran formato y ambientación',
    'Merchandising promocional',
    'Kits, packs & especiales',
    'Producción 360°',
    'Impresos comerciales',
    'Proyecto integral',
    'Espacios y estructuras',
    'Material POP'
  );

-- Los proyectos creados desde cotizaciones antiguas todavía pueden traer la categoría en `lob`.
-- Este trigger la copia a `categoria` al insertar, pero NO borra lob: Registro de Ventas lo definirá después.
create or replace function public.festos_separar_categoria_lob_proyecto()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if new.categoria is null and new.lob in (
    'Gran formato y ambientación',
    'Merchandising promocional',
    'Kits, packs & especiales',
    'Producción 360°',
    'Impresos comerciales',
    'Proyecto integral',
    'Espacios y estructuras',
    'Material POP'
  ) then
    new.categoria := new.lob;
  end if;
  return new;
end $$;

drop trigger if exists trg_festos_separar_categoria_lob_proyecto on public.proyectos;
create trigger trg_festos_separar_categoria_lob_proyecto
before insert or update on public.proyectos
for each row execute function public.festos_separar_categoria_lob_proyecto();

-- Columnas de rentabilidad del proyecto, por compatibilidad con instalaciones previas.
alter table public.proyectos add column if not exists costo_real numeric(14,2) not null default 0;
alter table public.proyectos add column if not exists utilidad_real numeric(14,2) not null default 0;
alter table public.proyectos add column if not exists margen_real numeric(10,4) not null default 0;

-- 3) Registrar venta V2.
create or replace function public.registrar_venta_festos_v2(
  p_project_id uuid,
  p_fecha_factura date,
  p_tipo_documento text,
  p_numero_documento text,
  p_valor_venta numeric,
  p_lob text,
  p_detraccion_aplica boolean default false,
  p_observaciones text default null,
  p_created_by text default null
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
    v_detraccion := round(v_precio*0.12,2);
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
    p_project_id,v_project.client_id,p_fecha_factura,p_fecha_factura,upper(coalesce(p_tipo_documento,'FACTURA')),trim(p_numero_documento),p_lob,v_project.ejecutivo,
    round(p_valor_venta,2),v_precio,v_costo,v_utilidad,v_margen,v_condicion,v_plazo,v_venc,
    v_retencion,v_detraccion,v_det_activa,case when v_det_activa then 12 else 0 end,v_pago_esperado,
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

grant execute on function public.registrar_venta_festos_v2(uuid,date,text,text,numeric,text,boolean,text,text) to authenticated;

-- 4) Editar venta V2: mismas reglas automáticas.
create or replace function public.editar_venta_festos_v2(
  p_venta_id uuid,
  p_fecha_factura date,
  p_tipo_documento text,
  p_numero_documento text,
  p_valor_venta numeric,
  p_lob text,
  p_detraccion_aplica boolean default false,
  p_observaciones text default null
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
    v_detraccion:=round(v_precio*0.12,2);
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
    numero_documento=trim(p_numero_documento),lob=p_lob,valor_venta=round(p_valor_venta,2),precio_venta=v_precio,
    utilidad=v_utilidad,margen=v_margen,fecha_vencimiento=v_venc,retencion=v_retencion,detraccion=v_detraccion,
    detraccion_aplica=v_det_activa,porcentaje_detraccion=case when v_det_activa then 12 else 0 end,
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

grant execute on function public.editar_venta_festos_v2(uuid,date,text,text,numeric,text,boolean,text) to authenticated;

-- 5) Cobros V2. La detracción puede registrarse por cualquier monto positivo
-- porque el banco/cliente puede redondear. El saldo queda en cero si se paga de más.
create or replace function public.registrar_cobro_venta_festos_v2(
  p_venta_id uuid,
  p_tipo text,
  p_fecha_pago date,
  p_monto numeric,
  p_medio_pago text default null,
  p_observaciones text default null,
  p_created_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v public.ventas%rowtype;
  v_tipo text:=upper(trim(coalesce(p_tipo,'')));
  v_pagado numeric(14,2):=0;
  v_det_pagada numeric(14,2):=0;
  v_saldo_com numeric(14,2):=0;
  v_saldo_det numeric(14,2):=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if v_tipo not in ('PAGO_COMERCIAL','DETRACCION') then raise exception 'Tipo de pago inválido'; end if;
  if coalesce(p_monto,0)<=0 then raise exception 'Monto inválido'; end if;
  select * into v from public.ventas where id=p_venta_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  if v_tipo='DETRACCION' and not coalesce(v.detraccion_aplica,false) then raise exception 'La factura no tiene detracción'; end if;
  if v_tipo='PAGO_COMERCIAL' and p_monto>coalesce(v.saldo_comercial,v.saldo,0)+0.01 then raise exception 'El pago supera el saldo comercial pendiente'; end if;
  -- Para DETRACCION NO se bloquea por exceso: se permite el redondeo real.

  insert into public.ventas_cobros(venta_id,tipo,fecha_pago,monto,medio_pago,referencia,observaciones,created_by)
  values(p_venta_id,v_tipo,p_fecha_pago,p_monto,nullif(trim(coalesce(p_medio_pago,'')),''),null,nullif(trim(coalesce(p_observaciones,'')),''),p_created_by);

  select coalesce(sum(monto),0) into v_pagado from public.ventas_cobros where venta_id=p_venta_id and tipo='PAGO_COMERCIAL';
  select coalesce(sum(monto),0) into v_det_pagada from public.ventas_cobros where venta_id=p_venta_id and tipo='DETRACCION';
  v_saldo_com:=greatest(round(coalesce(v.pago_comercial_esperado,0)-v_pagado,2),0);
  v_saldo_det:=greatest(round(coalesce(v.detraccion,0)-v_det_pagada,2),0);

  update public.ventas set
    pagado=v_pagado,detraccion_pagada=v_det_pagada,
    saldo_comercial=v_saldo_com,saldo_detraccion=v_saldo_det,saldo=v_saldo_com+v_saldo_det,
    estado_detraccion=case when coalesce(detraccion,0)<=0 then 'NO APLICA' when v_saldo_det<=0.01 then 'PAGADA' else 'PENDIENTE' end,
    fecha_ultimo_pago=case when v_saldo_com<=0.01 then p_fecha_pago else fecha_ultimo_pago end,
    updated_at=now()
  where id=p_venta_id;

  return jsonb_build_object('ok',true,'pagado',v_pagado,'detraccion_pagada',v_det_pagada,'saldo_comercial',v_saldo_com,'saldo_detraccion',v_saldo_det,'saldo_total',v_saldo_com+v_saldo_det);
end $$;

grant execute on function public.registrar_cobro_venta_festos_v2(uuid,text,date,numeric,text,text,text) to authenticated;

commit;
notify pgrst, 'reload schema';

select 'FESTOS V29.42.10 listo' as estado,
       (select count(*) from public.clientes where agente_retenedor) as clientes_agentes_retenedores;
