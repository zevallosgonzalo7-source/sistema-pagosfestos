-- FESTOS V29.42.1 — COBRANZA, VENCIMIENTOS Y DETRACCIONES
-- Ejecutar DESPUÉS de FESTOS_V29_42_REG_VENTAS_V1.sql

alter table public.ventas add column if not exists detraccion_aplica boolean not null default false;
alter table public.ventas add column if not exists porcentaje_detraccion numeric(8,4) not null default 0;
alter table public.ventas add column if not exists pago_comercial_esperado numeric(14,2) not null default 0;
alter table public.ventas add column if not exists detraccion_pagada numeric(14,2) not null default 0;
alter table public.ventas add column if not exists saldo_comercial numeric(14,2) not null default 0;
alter table public.ventas add column if not exists saldo_detraccion numeric(14,2) not null default 0;
alter table public.ventas add column if not exists estado_detraccion text not null default 'NO APLICA';
alter table public.ventas add column if not exists fecha_ultimo_pago date;

do $$ begin
  alter table public.ventas add constraint ventas_estado_detraccion_check
    check (estado_detraccion in ('NO APLICA','PENDIENTE','PAGADA'));
exception when duplicate_object then null; end $$;

create table if not exists public.ventas_cobros (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas(id) on delete cascade,
  tipo text not null default 'PAGO_COMERCIAL',
  fecha_pago date not null,
  monto numeric(14,2) not null check (monto > 0),
  medio_pago text,
  referencia text,
  observaciones text,
  created_by text,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.ventas_cobros add constraint ventas_cobros_tipo_check
    check (tipo in ('PAGO_COMERCIAL','DETRACCION'));
exception when duplicate_object then null; end $$;

create index if not exists ventas_cobros_venta_idx on public.ventas_cobros(venta_id, fecha_pago desc);
alter table public.ventas_cobros enable row level security;
do $$ begin create policy ventas_cobros_select_auth on public.ventas_cobros for select to authenticated using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy ventas_cobros_insert_auth on public.ventas_cobros for insert to authenticated with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy ventas_cobros_update_auth on public.ventas_cobros for update to authenticated using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy ventas_cobros_delete_auth on public.ventas_cobros for delete to authenticated using (true); exception when duplicate_object then null; end $$;

-- Normaliza ventas V29.42 ya existentes para no perder compatibilidad.
update public.ventas
set detraccion_aplica = coalesce(detraccion,0) > 0,
    porcentaje_detraccion = case when coalesce(precio_venta,0)>0 and coalesce(detraccion,0)>0 then round((detraccion/precio_venta)*100,4) else 0 end,
    pago_comercial_esperado = greatest(coalesce(precio_venta,0)-coalesce(retencion,0)-coalesce(detraccion,0),0),
    saldo_comercial = greatest(coalesce(precio_venta,0)-coalesce(retencion,0)-coalesce(detraccion,0)-coalesce(pagado,0),0),
    saldo_detraccion = greatest(coalesce(detraccion,0)-coalesce(detraccion_pagada,0),0),
    estado_detraccion = case when coalesce(detraccion,0)<=0 then 'NO APLICA' when coalesce(detraccion_pagada,0)>=coalesce(detraccion,0)-0.01 then 'PAGADA' else 'PENDIENTE' end,
    saldo = greatest(coalesce(precio_venta,0)-coalesce(retencion,0)-coalesce(detraccion,0)-coalesce(pagado,0),0)
          + greatest(coalesce(detraccion,0)-coalesce(detraccion_pagada,0),0);

-- Reemplazamos la firma V29.42 para calcular la detracción desde porcentaje.
drop function if exists public.registrar_venta_festos(uuid,date,date,text,text,numeric,numeric,numeric,numeric,text,text);

create or replace function public.registrar_venta_festos(
  p_project_id uuid,
  p_fecha_factura date,
  p_fecha_control date,
  p_tipo_documento text,
  p_numero_documento text,
  p_precio_venta numeric,
  p_retencion numeric default 0,
  p_detraccion_aplica boolean default false,
  p_porcentaje_detraccion numeric default 12,
  p_porcentaje_comision numeric default null,
  p_observaciones text default null,
  p_created_by text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_project public.proyectos%rowtype;
  v_client public.clientes%rowtype;
  v_costo numeric(14,2):=0; v_valor numeric(14,2):=0; v_utilidad numeric(14,2):=0; v_margen numeric(10,4):=0;
  v_plazo integer:=0; v_condicion text:='CONTADO'; v_venc date; v_pct numeric(8,4):=0; v_comision numeric(14,2):=0;
  v_detraccion numeric(14,2):=0; v_pago_esperado numeric(14,2):=0; v_saldo_total numeric(14,2):=0;
  v_total_facturado numeric(14,2):=0; v_objetivo numeric(14,2):=0; v_estado text:='PARCIAL'; v_venta_id uuid; v_compras integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_precio_venta is null or p_precio_venta<=0 then raise exception 'Precio de venta inválido'; end if;
  if coalesce(trim(p_numero_documento),'')='' then raise exception 'Número de comprobante obligatorio'; end if;
  if coalesce(p_porcentaje_detraccion,0)<0 or coalesce(p_porcentaje_detraccion,0)>100 then raise exception 'Porcentaje de detracción inválido'; end if;

  select * into v_project from public.proyectos where id=p_project_id for update;
  if not found then raise exception 'Proyecto no encontrado'; end if;
  if v_project.client_id is not null then select * into v_client from public.clientes where id=v_project.client_id; end if;

  select coalesce(sum(monto_base),0) into v_costo from public.compras where project_id=p_project_id;
  v_valor:=round(p_precio_venta/1.18,2);
  v_utilidad:=round(v_valor-v_costo,2);
  v_margen:=case when v_valor>0 then round((v_utilidad/v_valor)*100,4) else 0 end;

  -- Clientes es la fuente de verdad; la venta guarda snapshot histórico.
  v_condicion:=coalesce(v_client.tipo_pago,'CONTADO');
  v_plazo:=case when upper(v_condicion) in ('CREDITO','CRÉDITO') then coalesce(v_client.plazo_dias,0) else 0 end;
  v_venc:=p_fecha_factura+v_plazo;

  v_pct:=coalesce(p_porcentaje_comision,case when upper(coalesce(v_project.ejecutivo,''))='MAR' then 3 else 0 end);
  v_comision:=round(v_valor*v_pct/100,2);
  v_detraccion:=case when coalesce(p_detraccion_aplica,false) then round(p_precio_venta*coalesce(p_porcentaje_detraccion,12)/100,2) else 0 end;
  v_pago_esperado:=greatest(round(p_precio_venta-coalesce(p_retencion,0)-v_detraccion,2),0);
  v_saldo_total:=v_pago_esperado+v_detraccion;

  insert into public.ventas(
    project_id,client_id,fecha_factura,fecha_control,tipo_documento,numero_documento,lob,ejecutivo,
    valor_venta,precio_venta,costo,utilidad,margen,condicion_pago,plazo_dias,fecha_vencimiento,
    retencion,detraccion,detraccion_aplica,porcentaje_detraccion,pago_comercial_esperado,pagado,detraccion_pagada,
    saldo_comercial,saldo_detraccion,saldo,estado_detraccion,porcentaje_comision,comision,observaciones,created_by
  ) values(
    p_project_id,v_project.client_id,p_fecha_factura,coalesce(p_fecha_control,p_fecha_factura),upper(coalesce(p_tipo_documento,'FACTURA')),trim(p_numero_documento),v_project.lob,v_project.ejecutivo,
    v_valor,p_precio_venta,v_costo,v_utilidad,v_margen,v_condicion,v_plazo,v_venc,
    coalesce(p_retencion,0),v_detraccion,coalesce(p_detraccion_aplica,false),case when p_detraccion_aplica then coalesce(p_porcentaje_detraccion,12) else 0 end,v_pago_esperado,0,0,
    v_pago_esperado,v_detraccion,v_saldo_total,case when v_detraccion>0 then 'PENDIENTE' else 'NO APLICA' end,v_pct,v_comision,p_observaciones,p_created_by
  ) returning id into v_venta_id;

  update public.compras
     set fecha_control=coalesce(p_fecha_control,p_fecha_factura), lob=coalesce(v_project.lob,lob)
   where project_id=p_project_id;
  get diagnostics v_compras=row_count;

  select coalesce(sum(precio_venta),0) into v_total_facturado from public.ventas where project_id=p_project_id;
  v_objetivo:=coalesce(nullif(v_project.valor_base,0),nullif(v_project.valor_venta,0),0)*1.18;
  if v_total_facturado<=0 then v_estado:='NO FACTURADO';
  elsif v_objetivo>0 and v_total_facturado>=v_objetivo-0.01 then v_estado:='FACTURADO';
  else v_estado:='PARCIAL'; end if;

  update public.proyectos
     set total_facturado=v_total_facturado,facturacion_estado=v_estado,fecha_ultima_factura=p_fecha_factura,
         estado=case when v_estado='FACTURADO' then 'FACTURADO' else estado end
   where id=p_project_id;

  return jsonb_build_object(
    'ok',true,'venta_id',v_venta_id,'compras_actualizadas',v_compras,'facturacion_estado',v_estado,
    'total_facturado',v_total_facturado,'plazo_dias',v_plazo,'fecha_vencimiento',v_venc,
    'pago_comercial_esperado',v_pago_esperado,'detraccion',v_detraccion
  );
end $$;

grant execute on function public.registrar_venta_festos(uuid,date,date,text,text,numeric,numeric,boolean,numeric,numeric,text,text) to authenticated;

create or replace function public.registrar_cobro_venta_festos(
  p_venta_id uuid,
  p_tipo text,
  p_fecha_pago date,
  p_monto numeric,
  p_medio_pago text default null,
  p_referencia text default null,
  p_observaciones text default null,
  p_created_by text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v public.ventas%rowtype;
  v_tipo text:=upper(coalesce(p_tipo,''));
  v_pagado numeric(14,2):=0; v_det_pagada numeric(14,2):=0; v_saldo_com numeric(14,2):=0; v_saldo_det numeric(14,2):=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if v_tipo not in ('PAGO_COMERCIAL','DETRACCION') then raise exception 'Tipo de pago inválido'; end if;
  if p_monto is null or p_monto<=0 then raise exception 'Monto inválido'; end if;

  select * into v from public.ventas where id=p_venta_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  if v_tipo='DETRACCION' and not coalesce(v.detraccion_aplica,false) then raise exception 'La factura no tiene detracción'; end if;

  if v_tipo='PAGO_COMERCIAL' and p_monto>coalesce(v.saldo_comercial,0)+0.01 then raise exception 'El pago supera el saldo comercial pendiente'; end if;
  if v_tipo='DETRACCION' and p_monto>coalesce(v.saldo_detraccion,0)+0.01 then raise exception 'El depósito supera la detracción pendiente'; end if;

  insert into public.ventas_cobros(venta_id,tipo,fecha_pago,monto,medio_pago,referencia,observaciones,created_by)
  values(p_venta_id,v_tipo,p_fecha_pago,p_monto,nullif(trim(coalesce(p_medio_pago,'')),''),nullif(trim(coalesce(p_referencia,'')),''),nullif(trim(coalesce(p_observaciones,'')),''),p_created_by);

  select coalesce(sum(monto),0) into v_pagado from public.ventas_cobros where venta_id=p_venta_id and tipo='PAGO_COMERCIAL';
  select coalesce(sum(monto),0) into v_det_pagada from public.ventas_cobros where venta_id=p_venta_id and tipo='DETRACCION';
  v_saldo_com:=greatest(coalesce(v.pago_comercial_esperado,0)-v_pagado,0);
  v_saldo_det:=greatest(coalesce(v.detraccion,0)-v_det_pagada,0);

  update public.ventas
     set pagado=v_pagado,
         detraccion_pagada=v_det_pagada,
         saldo_comercial=v_saldo_com,
         saldo_detraccion=v_saldo_det,
         saldo=v_saldo_com+v_saldo_det,
         estado_detraccion=case when coalesce(detraccion,0)<=0 then 'NO APLICA' when v_saldo_det<=0.01 then 'PAGADA' else 'PENDIENTE' end,
         fecha_ultimo_pago=p_fecha_pago,
         updated_at=now()
   where id=p_venta_id;

  return jsonb_build_object('ok',true,'pagado',v_pagado,'detraccion_pagada',v_det_pagada,'saldo_comercial',v_saldo_com,'saldo_detraccion',v_saldo_det,'saldo_total',v_saldo_com+v_saldo_det);
end $$;

grant execute on function public.registrar_cobro_venta_festos(uuid,text,date,numeric,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
