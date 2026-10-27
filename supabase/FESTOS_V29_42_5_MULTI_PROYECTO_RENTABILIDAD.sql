-- FESTOS V29.42.5 — FACTURA MULTIPROYECTO + RENTABILIDAD REAL POR PROYECTO
-- Requiere V29.42 y V29.42.1 previamente ejecutadas.

alter table public.proyectos add column if not exists costo_real numeric(14,2) not null default 0;
alter table public.proyectos add column if not exists utilidad_real numeric(14,2) not null default 0;
alter table public.proyectos add column if not exists margen_real numeric(10,4) not null default 0;

create table if not exists public.venta_proyectos (
  venta_id uuid not null references public.ventas(id) on delete cascade,
  project_id uuid not null references public.proyectos(id) on delete restrict,
  valor_venta_asignado numeric(14,2) not null default 0,
  precio_venta_asignado numeric(14,2) not null default 0,
  costo_real_snapshot numeric(14,2) not null default 0,
  utilidad_real_snapshot numeric(14,2) not null default 0,
  margen_real_snapshot numeric(10,4) not null default 0,
  created_at timestamptz not null default now(),
  primary key (venta_id, project_id)
);
create index if not exists venta_proyectos_project_idx on public.venta_proyectos(project_id);
alter table public.venta_proyectos enable row level security;
do $$ begin create policy venta_proyectos_select_auth on public.venta_proyectos for select to authenticated using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy venta_proyectos_insert_auth on public.venta_proyectos for insert to authenticated with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy venta_proyectos_update_auth on public.venta_proyectos for update to authenticated using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy venta_proyectos_delete_auth on public.venta_proyectos for delete to authenticated using (true); exception when duplicate_object then null; end $$;

-- Compatibilidad con las ventas ya creadas en V29.42.
insert into public.venta_proyectos(venta_id,project_id,valor_venta_asignado,precio_venta_asignado,costo_real_snapshot,utilidad_real_snapshot,margen_real_snapshot)
select v.id,v.project_id,v.valor_venta,v.precio_venta,v.costo,v.utilidad,v.margen
from public.ventas v
where v.project_id is not null
on conflict (venta_id,project_id) do nothing;

create or replace function public.recalcular_rentabilidad_proyecto(p_project_id uuid)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_proyecto public.proyectos%rowtype;
  v_costo numeric(14,2):=0;
  v_valor numeric(14,2):=0;
  v_utilidad numeric(14,2):=0;
  v_margen numeric(10,4):=0;
begin
  if p_project_id is null then return jsonb_build_object('ok',false); end if;
  select * into v_proyecto from public.proyectos where id=p_project_id for update;
  if not found then return jsonb_build_object('ok',false); end if;

  select coalesce(sum(coalesce(monto_base,0)),0)::numeric(14,2)
    into v_costo
  from public.compras
  where project_id=p_project_id;

  v_valor:=coalesce(nullif(v_proyecto.valor_base,0),nullif(v_proyecto.valor_venta,0),0);
  v_utilidad:=round(v_valor-v_costo,2);
  v_margen:=case when v_valor>0 then round((v_utilidad/v_valor)*100,4) else 0 end;

  update public.proyectos
     set costo_real=v_costo, utilidad_real=v_utilidad, margen_real=v_margen
   where id=p_project_id;

  return jsonb_build_object('ok',true,'costo_real',v_costo,'utilidad_real',v_utilidad,'margen_real',v_margen);
end $$;

grant execute on function public.recalcular_rentabilidad_proyecto(uuid) to authenticated;

create or replace function public.trg_compras_recalcular_rentabilidad()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if tg_op='DELETE' then
    perform public.recalcular_rentabilidad_proyecto(old.project_id);
    return old;
  end if;
  if tg_op='UPDATE' and old.project_id is distinct from new.project_id then
    perform public.recalcular_rentabilidad_proyecto(old.project_id);
  end if;
  perform public.recalcular_rentabilidad_proyecto(new.project_id);
  return new;
end $$;

drop trigger if exists compras_recalcular_rentabilidad on public.compras;
create trigger compras_recalcular_rentabilidad
after insert or update of project_id,monto_base or delete on public.compras
for each row execute function public.trg_compras_recalcular_rentabilidad();

-- Backfill de rentabilidad actual.
do $$ declare r record; begin
  for r in select id from public.proyectos loop
    perform public.recalcular_rentabilidad_proyecto(r.id);
  end loop;
end $$;

-- Nueva RPC: una factura puede incluir uno o varios proyectos.
-- p_proyectos = [{"project_id":"uuid","precio_venta":1234.50}, ...]
create or replace function public.registrar_venta_festos_multi(
  p_proyectos jsonb,
  p_fecha_factura date,
  p_fecha_control date,
  p_tipo_documento text,
  p_numero_documento text,
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
  v_item jsonb;
  v_project public.proyectos%rowtype;
  v_first_project public.proyectos%rowtype;
  v_client public.clientes%rowtype;
  v_pid uuid;
  v_first_pid uuid;
  v_price numeric(14,2);
  v_total_price numeric(14,2):=0;
  v_total_value numeric(14,2):=0;
  v_total_cost numeric(14,2):=0;
  v_total_utility numeric(14,2):=0;
  v_margin numeric(10,4):=0;
  v_client_id uuid:=null;
  v_lob text:=null;
  v_ejecutivo text:=null;
  v_plazo integer:=0;
  v_condicion text:='CONTADO';
  v_venc date;
  v_pct numeric(8,4):=0;
  v_comision numeric(14,2):=0;
  v_detraccion numeric(14,2):=0;
  v_pago_esperado numeric(14,2):=0;
  v_saldo_total numeric(14,2):=0;
  v_venta_id uuid;
  v_compras integer:=0;
  v_count integer:=0;
  v_total_facturado numeric(14,2):=0;
  v_objetivo numeric(14,2):=0;
  v_estado text;
  v_rent jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_proyectos is null or jsonb_typeof(p_proyectos)<>'array' or jsonb_array_length(p_proyectos)=0 then raise exception 'Selecciona al menos un proyecto'; end if;
  if coalesce(trim(p_numero_documento),'')='' then raise exception 'Número de comprobante obligatorio'; end if;
  if coalesce(p_porcentaje_detraccion,0)<0 or coalesce(p_porcentaje_detraccion,0)>100 then raise exception 'Porcentaje de detracción inválido'; end if;

  -- Validación previa + totales. Todos los proyectos de una factura deben pertenecer al mismo cliente.
  for v_item in select value from jsonb_array_elements(p_proyectos) loop
    v_pid:=(v_item->>'project_id')::uuid;
    v_price:=round(coalesce((v_item->>'precio_venta')::numeric,0),2);
    if v_price<=0 then raise exception 'Cada proyecto debe tener un monto de facturación mayor a cero'; end if;
    select * into v_project from public.proyectos where id=v_pid for update;
    if not found then raise exception 'Proyecto no encontrado: %',v_pid; end if;
    if v_count=0 then
      v_first_pid:=v_pid; v_first_project:=v_project; v_client_id:=v_project.client_id; v_lob:=v_project.lob; v_ejecutivo:=v_project.ejecutivo;
    else
      if v_project.client_id is distinct from v_client_id then raise exception 'Una misma factura solo puede agrupar proyectos del mismo cliente'; end if;
      if coalesce(v_lob,'')<>coalesce(v_project.lob,'') then v_lob:='MÚLTIPLE'; end if;
      if coalesce(v_ejecutivo,'')<>coalesce(v_project.ejecutivo,'') then v_ejecutivo:='MÚLTIPLE'; end if;
    end if;
    v_count:=v_count+1;
    v_total_price:=v_total_price+v_price;
  end loop;
  if v_total_price<=0 then raise exception 'Precio total inválido'; end if;

  if v_client_id is not null then select * into v_client from public.clientes where id=v_client_id; end if;
  v_condicion:=coalesce(v_client.tipo_pago,'CONTADO');
  v_plazo:=case when upper(v_condicion) in ('CREDITO','CRÉDITO') then coalesce(v_client.plazo_dias,0) else 0 end;
  v_venc:=p_fecha_factura+v_plazo;
  v_total_value:=round(v_total_price/1.18,2);
  v_detraccion:=case when coalesce(p_detraccion_aplica,false) then round(v_total_price*coalesce(p_porcentaje_detraccion,12)/100,2) else 0 end;
  v_pago_esperado:=greatest(round(v_total_price-coalesce(p_retencion,0)-v_detraccion,2),0);
  v_saldo_total:=v_pago_esperado+v_detraccion;

  -- Comisión de factura: solo automática cuando todos los proyectos comparten ejecutivo.
  v_pct:=coalesce(p_porcentaje_comision,case when upper(coalesce(v_ejecutivo,''))='MAR' then 3 else 0 end);
  v_comision:=round(v_total_value*v_pct/100,2);

  insert into public.ventas(
    project_id,client_id,fecha_factura,fecha_control,tipo_documento,numero_documento,lob,ejecutivo,
    valor_venta,precio_venta,costo,utilidad,margen,condicion_pago,plazo_dias,fecha_vencimiento,
    retencion,detraccion,detraccion_aplica,porcentaje_detraccion,pago_comercial_esperado,pagado,detraccion_pagada,
    saldo_comercial,saldo_detraccion,saldo,estado_detraccion,porcentaje_comision,comision,observaciones,created_by
  ) values(
    v_first_pid,v_client_id,p_fecha_factura,coalesce(p_fecha_control,p_fecha_factura),upper(coalesce(p_tipo_documento,'FACTURA')),trim(p_numero_documento),v_lob,v_ejecutivo,
    v_total_value,v_total_price,0,0,0,v_condicion,v_plazo,v_venc,
    coalesce(p_retencion,0),v_detraccion,coalesce(p_detraccion_aplica,false),case when p_detraccion_aplica then coalesce(p_porcentaje_detraccion,12) else 0 end,v_pago_esperado,0,0,
    v_pago_esperado,v_detraccion,v_saldo_total,case when v_detraccion>0 then 'PENDIENTE' else 'NO APLICA' end,v_pct,v_comision,p_observaciones,p_created_by
  ) returning id into v_venta_id;

  -- Vinculación, sincronización de compras y actualización individual por proyecto.
  for v_item in select value from jsonb_array_elements(p_proyectos) loop
    v_pid:=(v_item->>'project_id')::uuid;
    v_price:=round((v_item->>'precio_venta')::numeric,2);
    select * into v_project from public.proyectos where id=v_pid for update;
    v_rent:=public.recalcular_rentabilidad_proyecto(v_pid);
    select * into v_project from public.proyectos where id=v_pid;

    insert into public.venta_proyectos(venta_id,project_id,valor_venta_asignado,precio_venta_asignado,costo_real_snapshot,utilidad_real_snapshot,margen_real_snapshot)
    values(v_venta_id,v_pid,round(v_price/1.18,2),v_price,coalesce(v_project.costo_real,0),coalesce(v_project.utilidad_real,0),coalesce(v_project.margen_real,0));

    update public.compras
       set fecha_control=coalesce(p_fecha_control,p_fecha_factura), lob=coalesce(v_project.lob,lob)
     where project_id=v_pid;
    get diagnostics v_count=row_count;
    v_compras:=v_compras+v_count;

    select coalesce(sum(vp.precio_venta_asignado),0)
      into v_total_facturado
    from public.venta_proyectos vp
    where vp.project_id=v_pid;
    v_objetivo:=coalesce(nullif(v_project.valor_base,0),nullif(v_project.valor_venta,0),0)*1.18;
    if v_total_facturado<=0 then v_estado:='NO FACTURADO';
    elsif v_objetivo>0 and v_total_facturado>=v_objetivo-0.01 then v_estado:='FACTURADO';
    else v_estado:='PARCIAL'; end if;

    update public.proyectos
       set total_facturado=v_total_facturado,
           facturacion_estado=v_estado,
           fecha_ultima_factura=p_fecha_factura,
           estado=case when v_estado='FACTURADO' then 'FACTURADO' else estado end
     where id=v_pid;

    v_total_cost:=v_total_cost+coalesce(v_project.costo_real,0);
    v_total_utility:=v_total_utility+coalesce(v_project.utilidad_real,0);
  end loop;

  v_margin:=case when v_total_value>0 then round(((v_total_value-v_total_cost)/v_total_value)*100,4) else 0 end;
  update public.ventas set costo=v_total_cost,utilidad=round(v_total_value-v_total_cost,2),margen=v_margin where id=v_venta_id;

  return jsonb_build_object(
    'ok',true,'venta_id',v_venta_id,'proyectos',jsonb_array_length(p_proyectos),'compras_actualizadas',v_compras,
    'precio_venta',v_total_price,'valor_venta',v_total_value,'plazo_dias',v_plazo,'fecha_vencimiento',v_venc,
    'pago_comercial_esperado',v_pago_esperado,'detraccion',v_detraccion
  );
end $$;

grant execute on function public.registrar_venta_festos_multi(jsonb,date,date,text,text,numeric,boolean,numeric,numeric,text,text) to authenticated;

notify pgrst,'reload schema';
