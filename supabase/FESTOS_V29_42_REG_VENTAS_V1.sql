-- FESTOS V29.42 — REGISTRO DE VENTAS V1
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.proyectos(id) on delete restrict,
  client_id uuid references public.clientes(id) on delete set null,
  fecha_factura date not null,
  fecha_control date,
  tipo_documento text not null default 'FACTURA',
  numero_documento text not null,
  lob text,
  ejecutivo text,
  valor_venta numeric(14,2) not null default 0,
  precio_venta numeric(14,2) not null default 0,
  costo numeric(14,2) not null default 0,
  utilidad numeric(14,2) not null default 0,
  margen numeric(10,4) not null default 0,
  condicion_pago text,
  plazo_dias integer not null default 0,
  fecha_vencimiento date,
  pagado numeric(14,2) not null default 0,
  retencion numeric(14,2) not null default 0,
  detraccion numeric(14,2) not null default 0,
  saldo numeric(14,2) not null default 0,
  porcentaje_comision numeric(8,4) not null default 0,
  comision numeric(14,2) not null default 0,
  observaciones text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ventas_numero_documento_uq on public.ventas(lower(numero_documento));
create index if not exists ventas_project_id_idx on public.ventas(project_id);
create index if not exists ventas_fecha_factura_idx on public.ventas(fecha_factura desc);

alter table public.proyectos add column if not exists facturacion_estado text not null default 'NO FACTURADO';
alter table public.proyectos add column if not exists total_facturado numeric(14,2) not null default 0;
alter table public.proyectos add column if not exists fecha_ultima_factura date;

do $$ begin
  alter table public.proyectos add constraint proyectos_facturacion_estado_check check (facturacion_estado in ('NO FACTURADO','PARCIAL','FACTURADO'));
exception when duplicate_object then null; end $$;

alter table public.ventas enable row level security;
do $$ begin create policy ventas_select_auth on public.ventas for select to authenticated using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy ventas_insert_auth on public.ventas for insert to authenticated with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy ventas_update_auth on public.ventas for update to authenticated using (true) with check (true); exception when duplicate_object then null; end $$;

create or replace function public.registrar_venta_festos(
  p_project_id uuid,
  p_fecha_factura date,
  p_fecha_control date,
  p_tipo_documento text,
  p_numero_documento text,
  p_precio_venta numeric,
  p_retencion numeric default 0,
  p_detraccion numeric default 0,
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
  v_plazo integer:=0; v_condicion text:='CONTADO'; v_venc date; v_pct numeric(8,4):=0; v_comision numeric(14,2):=0; v_saldo numeric(14,2):=0;
  v_total_facturado numeric(14,2):=0; v_objetivo numeric(14,2):=0; v_estado text:='PARCIAL'; v_venta_id uuid; v_compras integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_precio_venta is null or p_precio_venta<=0 then raise exception 'Precio de venta inválido'; end if;
  if coalesce(trim(p_numero_documento),'')='' then raise exception 'Número de comprobante obligatorio'; end if;
  select * into v_project from public.proyectos where id=p_project_id for update;
  if not found then raise exception 'Proyecto no encontrado'; end if;
  if v_project.client_id is not null then select * into v_client from public.clientes where id=v_project.client_id; end if;
  select coalesce(sum(monto_base),0) into v_costo from public.compras where project_id=p_project_id;
  v_valor:=round(p_precio_venta/1.18,2); v_utilidad:=round(v_valor-v_costo,2); v_margen:=case when v_valor>0 then round((v_utilidad/v_valor)*100,4) else 0 end;
  v_condicion:=coalesce(v_client.tipo_pago,'CONTADO'); v_plazo:=case when upper(v_condicion)='CREDITO' then coalesce(v_client.plazo_dias,0) else 0 end; v_venc:=p_fecha_factura+v_plazo;
  v_pct:=coalesce(p_porcentaje_comision,case when upper(coalesce(v_project.ejecutivo,''))='MAR' then 3 else 0 end); v_comision:=round(v_valor*v_pct/100,2);
  v_saldo:=greatest(round(p_precio_venta-coalesce(p_retencion,0)-coalesce(p_detraccion,0),2),0);
  insert into public.ventas(project_id,client_id,fecha_factura,fecha_control,tipo_documento,numero_documento,lob,ejecutivo,valor_venta,precio_venta,costo,utilidad,margen,condicion_pago,plazo_dias,fecha_vencimiento,retencion,detraccion,saldo,porcentaje_comision,comision,observaciones,created_by)
  values(p_project_id,v_project.client_id,p_fecha_factura,coalesce(p_fecha_control,p_fecha_factura),upper(coalesce(p_tipo_documento,'FACTURA')),trim(p_numero_documento),v_project.lob,v_project.ejecutivo,v_valor,p_precio_venta,v_costo,v_utilidad,v_margen,v_condicion,v_plazo,v_venc,coalesce(p_retencion,0),coalesce(p_detraccion,0),v_saldo,v_pct,v_comision,p_observaciones,p_created_by)
  returning id into v_venta_id;
  update public.compras set fecha_control=coalesce(p_fecha_control,p_fecha_factura), lob=coalesce(v_project.lob,lob) where project_id=p_project_id;
  get diagnostics v_compras=row_count;
  select coalesce(sum(precio_venta),0) into v_total_facturado from public.ventas where project_id=p_project_id;
  v_objetivo:=coalesce(nullif(v_project.valor_base,0),nullif(v_project.valor_venta,0),0)*1.18;
  if v_total_facturado<=0 then v_estado:='NO FACTURADO'; elsif v_objetivo>0 and v_total_facturado>=v_objetivo-0.01 then v_estado:='FACTURADO'; else v_estado:='PARCIAL'; end if;
  update public.proyectos set total_facturado=v_total_facturado,facturacion_estado=v_estado,fecha_ultima_factura=p_fecha_factura,estado=case when v_estado='FACTURADO' then 'FACTURADO' else estado end where id=p_project_id;
  return jsonb_build_object('ok',true,'venta_id',v_venta_id,'compras_actualizadas',v_compras,'facturacion_estado',v_estado,'total_facturado',v_total_facturado);
end $$;

grant execute on function public.registrar_venta_festos(uuid,date,date,text,text,numeric,numeric,numeric,numeric,text,text) to authenticated;
notify pgrst,'reload schema';
