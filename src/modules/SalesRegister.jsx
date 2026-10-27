import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { FestosIcon } from '../FestosIcon';
import SearchableSelect from '../components/SearchableSelect';
import { nombreCompletoUsuario } from '../teamDirectory';
import { exportarListadoFiltradoExcel } from './BusinessModules';

const money = v => `S/. ${new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0)}`;
const today = () => new Date().toISOString().slice(0,10);
const datePlus = (iso, days=0) => { if(!iso) return ''; const d=new Date(`${iso}T12:00:00`); d.setDate(d.getDate()+(Number(days)||0)); return d.toISOString().slice(0,10); };
const daysUntil = iso => { if(!iso) return null; const a=new Date(`${today()}T12:00:00`); const b=new Date(`${iso}T12:00:00`); return Math.round((b-a)/86400000); };
const emptyForm = { project_id:'', fecha_factura:today(), fecha_control:today(), tipo_documento:'FACTURA', numero_documento:'', precio_venta:'', retencion:'0', detraccion_aplica:false, porcentaje_detraccion:'12', porcentaje_comision:'', observaciones:'' };
const emptyPay = { venta_id:'', tipo:'PAGO_COMERCIAL', fecha_pago:today(), monto:'', medio_pago:'TRANSFERENCIA', referencia:'', observaciones:'' };

function estadoVenta(v){
  const sc=Number(v.saldo_comercial ?? v.saldo ?? 0); const sd=Number(v.saldo_detraccion ?? 0); const pagado=Number(v.pagado)||0; const detPag=Number(v.detraccion_pagada)||0;
  if(sc<=0.01 && sd<=0.01) return 'COBRADO';
  if(sc<=0.01 && sd>0.01) return 'PENDIENTE DETRACCIÓN';
  if(v.fecha_vencimiento && v.fecha_vencimiento<today()) return 'VENCIDO';
  if(pagado>0 || detPag>0) return 'PARCIAL';
  return 'PENDIENTE';
}
const statusClass = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-');

export function SalesRegister({ usuario, puedeGestionar = true, proyectoSolicitado = null, onConsumirProyecto = () => {}, onNotify = () => {}, onAudit = () => {} }) {
  const [ventas,setVentas]=useState([]); const [proyectos,setProyectos]=useState([]); const [compras,setCompras]=useState([]); const [cobros,setCobros]=useState([]);
  const [form,setForm]=useState(emptyForm); const [modal,setModal]=useState(false); const [cargando,setCargando]=useState(false);
  const [payForm,setPayForm]=useState(emptyPay); const [payModal,setPayModal]=useState(false); const [guardandoPago,setGuardandoPago]=useState(false);
  const [busqueda,setBusqueda]=useState(''); const [estado,setEstado]=useState('TODOS'); const [detalle,setDetalle]=useState(null); const [alertFilter,setAlertFilter]=useState('');
  const [comprasAbiertas,setComprasAbiertas]=useState(false);
  const [errorCarga,setErrorCarga]=useState('');

  const cargar=async()=>{
    setErrorCarga('');
    try{
      const [v,p,c,cb,cl,vp]=await Promise.all([
        supabase.from('ventas').select('*').order('fecha_factura',{ascending:false}).order('created_at',{ascending:false}),
        supabase.from('proyectos').select('id,codigo,nombre,lob,ejecutivo,client_id,estado,valor_venta,valor_base').order('created_at',{ascending:false}),
        supabase.from('compras').select('id,project_id,fecha_compra,descripcion,monto_base,monto,lob,fecha_control,tipo_comprobante,numero_documento,proveedor_nombre,proveedores(nombre,nombre_comercial)').not('project_id','is',null),
        supabase.from('ventas_cobros').select('*').order('fecha_pago',{ascending:false}).order('created_at',{ascending:false}),
        supabase.from('clientes').select('id,nombre,ruc,tipo_pago,plazo_dias'),
        supabase.from('venta_proyectos').select('venta_id,project_id,valor_venta_asignado,precio_venta_asignado,costo_asignado')
      ]);

      if(v.error) throw new Error(`Ventas: ${v.error.message||v.error.code||'error de lectura'}`);
      if(p.error) console.error('Proyectos:',p.error);
      if(c.error) console.error('Compras:',c.error);
      if(cb.error && cb.error?.code!=='42P01') console.error('Cobros:',cb.error);
      if(cl.error) console.error('Clientes:',cl.error);
      if(vp.error && vp.error?.code!=='42P01') console.error('Venta proyectos:',vp.error);

      const clientes=(cl.data||[]);
      const clienteMap=new Map(clientes.map(x=>[x.id,x]));
      const proyectosBase=(p.data||[]).map(pr=>({...pr,clientes:clienteMap.get(pr.client_id)||null}));
      const proyectoMap=new Map(proyectosBase.map(x=>[x.id,x]));
      const linksPorVenta=new Map();
      for(const link of (vp.data||[])){
        if(!linksPorVenta.has(link.venta_id)) linksPorVenta.set(link.venta_id,[]);
        linksPorVenta.get(link.venta_id).push({...link,proyecto:proyectoMap.get(link.project_id)||null});
      }
      const ventasEnriquecidas=(v.data||[]).map(row=>{
        const links=linksPorVenta.get(row.id)||[];
        const proyectoPrincipal=proyectoMap.get(row.project_id)||links[0]?.proyecto||null;
        const clienteDirecto=clienteMap.get(row.cliente_id)||proyectoPrincipal?.clientes||null;
        return {...row,proyectos:proyectoPrincipal,clientes:clienteDirecto,venta_proyectos:links};
      });

      setVentas(ventasEnriquecidas);
      setProyectos(proyectosBase);
      if(!c.error)setCompras(c.data||[]);
      if(!cb.error)setCobros(cb.data||[]);
    }catch(err){
      console.error('Error cargando Registro de Ventas:',err);
      setVentas([]);
      setErrorCarga(err?.message||'No se pudo cargar Registro de Ventas.');
    }
  };
  useEffect(()=>{ cargar(); const ch=supabase.channel(`festos-ventas-${Date.now()}`).on('postgres_changes',{event:'*',schema:'public',table:'ventas'},cargar).on('postgres_changes',{event:'*',schema:'public',table:'ventas_cobros'},cargar).subscribe(); return()=>supabase.removeChannel(ch);},[]);

  useEffect(()=>{
    if(!proyectoSolicitado) return;
    const pid=typeof proyectoSolicitado==='object'?proyectoSolicitado.id:proyectoSolicitado;
    if(!pid) return;
    setForm({...emptyForm,project_id:pid}); setComprasAbiertas(false); setModal(true); onConsumirProyecto();
  },[proyectoSolicitado]);

  const proyecto=form.project_id?proyectos.find(p=>p.id===form.project_id):null;
  const comprasProyecto=useMemo(()=>compras.filter(c=>c.project_id===form.project_id),[compras,form.project_id]);
  const costoReal=useMemo(()=>comprasProyecto.reduce((s,c)=>s+(Number(c.monto_base)||0),0),[comprasProyecto]);
  const precio=Number(form.precio_venta)||0; const valorVenta=precio/1.18; const utilidad=valorVenta-costoReal; const margen=valorVenta>0?utilidad/valorVenta*100:0;
  const condicion=String(proyecto?.clientes?.tipo_pago||'CONTADO').toUpperCase();
  const plazo=(condicion==='CREDITO'||condicion==='CRÉDITO')?(Number(proyecto?.clientes?.plazo_dias)||0):0;
  const fechaVencimiento=datePlus(form.fecha_factura,plazo);
  const pctDet=form.detraccion_aplica?(Number(form.porcentaje_detraccion)||0):0;
  const montoDet=form.detraccion_aplica?precio*pctDet/100:0;
  const pagoEsperado=Math.max(precio-(Number(form.retencion)||0)-montoDet,0);

  const abrir=()=>{setForm(emptyForm);setComprasAbiertas(false);setModal(true)};
  const guardar=async e=>{
    e.preventDefault(); if(!form.project_id||!form.fecha_factura||!form.numero_documento.trim()||precio<=0) return alert('Completa proyecto, fecha, número de comprobante y precio de venta.');
    setCargando(true);
    try{
      const {data,error}=await supabase.rpc('registrar_venta_festos',{p_project_id:form.project_id,p_fecha_factura:form.fecha_factura,p_fecha_control:form.fecha_control||form.fecha_factura,p_tipo_documento:form.tipo_documento,p_numero_documento:form.numero_documento.trim(),p_precio_venta:precio,p_retencion:Number(form.retencion)||0,p_detraccion_aplica:!!form.detraccion_aplica,p_porcentaje_detraccion:Number(form.porcentaje_detraccion)||12,p_porcentaje_comision:form.porcentaje_comision===''?null:Number(form.porcentaje_comision),p_observaciones:form.observaciones.trim()||null,p_created_by:usuario||null});
      if(error) throw error;
      onNotify('Venta registrada y cobranza programada','nuevo'); onAudit('Creación',`Registro de venta ${form.numero_documento} · ${proyecto?.nombre||''} · ${money(precio)}`);
      setModal(false); setForm(emptyForm); await cargar();
      alert(`Venta registrada. Vence: ${data?.fecha_vencimiento||fechaVencimiento}. Pago comercial esperado: ${money(data?.pago_comercial_esperado??pagoEsperado)}${Number(data?.detraccion||0)>0?` · Detracción: ${money(data.detraccion)}`:''}.`);
    }catch(err){console.error(err);alert(`No se pudo registrar la venta. ${err.message||''}`)}finally{setCargando(false)}
  };

  const abrirPago=(v,tipo='PAGO_COMERCIAL')=>{
    const pendiente=tipo==='DETRACCION'?Number(v.saldo_detraccion||0):Number(v.saldo_comercial ?? v.saldo ?? 0);
    setPayForm({...emptyPay,venta_id:v.id,tipo,monto:pendiente>0?String(pendiente.toFixed(2)):''}); setPayModal(true);
  };
  const guardarPago=async e=>{
    e.preventDefault(); const monto=Number(payForm.monto)||0; if(!payForm.venta_id||monto<=0) return alert('Ingresa un monto válido.');
    setGuardandoPago(true);
    try{
      const {error}=await supabase.rpc('registrar_cobro_venta_festos',{p_venta_id:payForm.venta_id,p_tipo:payForm.tipo,p_fecha_pago:payForm.fecha_pago,p_monto:monto,p_medio_pago:payForm.medio_pago||null,p_referencia:payForm.referencia.trim()||null,p_observaciones:payForm.observaciones.trim()||null,p_created_by:usuario||null});
      if(error) throw error;
      onNotify(payForm.tipo==='DETRACCION'?'Detracción registrada':'Cobro registrado','nuevo'); onAudit('Creación',`${payForm.tipo==='DETRACCION'?'Detracción':'Cobro'} ${money(monto)}`);
      setPayModal(false); setPayForm(emptyPay); await cargar();
    }catch(err){console.error(err);alert(`No se pudo registrar el pago. ${err.message||''}`)}finally{setGuardandoPago(false)}
  };

  const alertas=useMemo(()=>{
    const vencidas=ventas.filter(v=>estadoVenta(v)==='VENCIDO');
    const detracciones=ventas.filter(v=>Number(v.saldo_detraccion||0)>0.01);
    const porVencer=ventas.filter(v=>{const d=daysUntil(v.fecha_vencimiento);return Number(v.saldo_comercial??v.saldo??0)>0.01&&d!=null&&d>=0&&d<=7;});
    return {vencidas,detracciones,porVencer};
  },[ventas]);

  const filtradas=useMemo(()=>ventas.filter(v=>{
    const q=busqueda.trim().toLowerCase(); const proyectosExtra=(v.venta_proyectos||[]).map(x=>`${x.proyecto?.codigo||''} ${x.proyecto?.nombre||''}`).join(' '); const texto=`${v.numero_documento||''} ${v.proyectos?.codigo||''} ${v.proyectos?.nombre||''} ${proyectosExtra} ${v.clientes?.nombre||''} ${v.lob||''}`.toLowerCase();
    const st=estadoVenta(v); let alertaOk=true;
    if(alertFilter==='VENCIDAS') alertaOk=st==='VENCIDO';
    if(alertFilter==='DETRACCION') alertaOk=Number(v.saldo_detraccion||0)>0.01;
    if(alertFilter==='POR_VENCER'){const d=daysUntil(v.fecha_vencimiento); alertaOk=Number(v.saldo_comercial??v.saldo??0)>0.01&&d!=null&&d>=0&&d<=7;}
    return(!q||texto.includes(q))&&(estado==='TODOS'||estado===st)&&alertaOk;
  }),[ventas,busqueda,estado,alertFilter]);
  const kpi=useMemo(()=>({precio:filtradas.reduce((s,v)=>s+(Number(v.precio_venta)||0),0),cobrado:filtradas.reduce((s,v)=>s+(Number(v.pagado)||0),0),saldoCom:filtradas.reduce((s,v)=>s+(Number(v.saldo_comercial??v.saldo)||0),0),saldoDet:filtradas.reduce((s,v)=>s+(Number(v.saldo_detraccion)||0),0)}),[filtradas]);

  const exportarVentas = async () => {
    try {
      const ok = await exportarListadoFiltradoExcel({
        nombreModulo: 'Registro de Ventas',
        nombreArchivo: `FESTOS_REGISTRO_VENTAS_${new Date().toISOString().slice(0,10)}`,
        filas: filtradas,
        columnas: [
          { header: 'Fecha factura', width: 16, value: v => v.fecha_factura || '' },
          { header: 'Documento', width: 16, value: v => v.tipo_documento || '' },
          { header: 'Número', width: 20, value: v => v.numero_documento || '' },
          { header: 'Cliente', width: 34, value: v => v.clientes?.nombre || '' },
          { header: 'RUC', width: 16, value: v => v.clientes?.ruc || '' },
          { header: 'Proyecto', width: 38, value: v => v.proyectos?.nombre || '' },
          { header: 'LOB', width: 24, value: v => v.lob || '' },
          { header: 'Ejecutivo', width: 24, value: v => nombreCompletoUsuario(v.ejecutivo, v.ejecutivo || '') },
          { header: 'Valor venta', width: 18, type: 'money', value: v => Number(v.valor_venta) || 0 },
          { header: 'Precio venta', width: 18, type: 'money', value: v => Number(v.precio_venta) || 0 },
          { header: 'Costo real', width: 18, type: 'money', value: v => Number(v.costo) || 0 },
          { header: 'Utilidad', width: 18, type: 'money', value: v => Number(v.utilidad) || 0 },
          { header: 'Margen %', width: 14, value: v => `${Number(v.margen || 0).toFixed(1)}%` },
          { header: 'Condición', width: 16, value: v => v.condicion_pago || '' },
          { header: 'Plazo días', width: 12, align: 'right', value: v => Number(v.plazo_dias) || 0 },
          { header: 'Vencimiento', width: 16, value: v => v.fecha_vencimiento || '' },
          { header: 'Cobrado', width: 18, type: 'money', value: v => Number(v.pagado) || 0 },
          { header: 'Saldo comercial', width: 18, type: 'money', value: v => Number(v.saldo_comercial ?? v.saldo) || 0 },
          { header: 'Detracción', width: 18, type: 'money', value: v => Number(v.detraccion) || 0 },
          { header: 'Detracción pagada', width: 18, type: 'money', value: v => Number(v.detraccion_pagada) || 0 },
          { header: 'Saldo detracción', width: 18, type: 'money', value: v => Number(v.saldo_detraccion) || 0 },
          { header: 'Estado', width: 22, value: v => estadoVenta(v) }
        ],
        filtros: [
          { label: 'Búsqueda', value: busqueda },
          { label: 'Estado', value: estado },
          { label: 'Alerta', value: alertFilter || 'TODAS' }
        ],
        resumen: {
          titulo: 'RESUMEN REGISTRO DE VENTAS',
          items: [
            { label: 'Facturado', value: kpi.precio, type: 'money' },
            { label: 'Cobrado', value: kpi.cobrado, type: 'money' },
            { label: 'Por cobrar', value: kpi.saldoCom, type: 'money' },
            { label: 'Detracción pendiente', value: kpi.saldoDet, type: 'money' }
          ]
        }
      });
      if (ok) {
        onNotify(`Excel de Registro de Ventas generado · ${filtradas.length} registros`, 'nuevo');
        onAudit('Exportación', `Registro de Ventas · ${filtradas.length} registros`);
      }
    } catch (error) {
      console.error(error);
      alert(`No se pudo generar el Excel de Registro de Ventas. ${error?.message || ''}`);
    }
  };

  return <div className="sales-module">
    <div className="section-header sales-head"><div><h3 className="section-title"><FestosIcon name="ReceiptText" size={21}/> Registro de Ventas</h3><p className="panel-note">Facturación, cobranza, vencimientos y detracciones.</p></div><div className="sales-head-actions"><button className="btn-export" type="button" onClick={exportarVentas}><FestosIcon name="Sheet" size={16}/> Exportar Excel</button>{puedeGestionar&&<button className="btn-primary" onClick={abrir}><FestosIcon name="Plus" size={16}/> Registrar venta</button>}</div></div>

    <div className="sales-kpis"><div><span>Facturado</span><strong>{money(kpi.precio)}</strong></div><div><span>Cobrado</span><strong>{money(kpi.cobrado)}</strong></div><div><span>Por cobrar</span><strong>{money(kpi.saldoCom)}</strong></div><div><span>Detracción pendiente</span><strong>{money(kpi.saldoDet)}</strong></div></div>

    {(alertas.vencidas.length>0 || alertas.detracciones.length>0 || alertas.porVencer.length>0) && <div className="sales-alert-strip" role="group" aria-label="Alertas de cobranza">
      {alertas.vencidas.length>0 && <button type="button" className={`sales-alert-chip danger ${alertFilter==='VENCIDAS'?'active':''}`} onClick={()=>setAlertFilter(alertFilter==='VENCIDAS'?'':'VENCIDAS')}><FestosIcon name="AlertTriangle" size={15}/><strong>{alertas.vencidas.length}</strong><span>factura{alertas.vencidas.length===1?'':'s'} vencida{alertas.vencidas.length===1?'':'s'}</span><small>{money(alertas.vencidas.reduce((s,v)=>s+(Number(v.saldo_comercial??v.saldo)||0),0))}</small></button>}
      {alertas.porVencer.length>0 && <button type="button" className={`sales-alert-chip soon ${alertFilter==='POR_VENCER'?'active':''}`} onClick={()=>setAlertFilter(alertFilter==='POR_VENCER'?'':'POR_VENCER')}><FestosIcon name="Clock3" size={15}/><strong>{alertas.porVencer.length}</strong><span>vence{alertas.porVencer.length===1?'':'n'} en 7 días</span><small>{money(alertas.porVencer.reduce((s,v)=>s+(Number(v.saldo_comercial??v.saldo)||0),0))}</small></button>}
      {alertas.detracciones.length>0 && <button type="button" className={`sales-alert-chip warning ${alertFilter==='DETRACCION'?'active':''}`} onClick={()=>setAlertFilter(alertFilter==='DETRACCION'?'':'DETRACCION')}><FestosIcon name="AlertTriangle" size={15}/><strong>{alertas.detracciones.length}</strong><span>detracción{alertas.detracciones.length===1?'':'es'} pendiente{alertas.detracciones.length===1?'':'s'}</span><small>{money(alertas.detracciones.reduce((s,v)=>s+(Number(v.saldo_detraccion)||0),0))}</small></button>}
      {alertFilter && <button type="button" className="sales-alert-clear" onClick={()=>setAlertFilter('')}><FestosIcon name="X" size={14}/> Quitar alerta</button>}
    </div>}
    <div className="glass-card sales-toolbar"><input className="search-input" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar factura, cliente o proyecto..."/><select value={estado} onChange={e=>setEstado(e.target.value)}><option>TODOS</option><option>PENDIENTE</option><option>PARCIAL</option><option>VENCIDO</option><option>PENDIENTE DETRACCIÓN</option><option>COBRADO</option></select></div>

    {errorCarga&&<div className="glass-card sales-load-error"><strong>No se pudo cargar Registro de Ventas</strong><span>{errorCarga}</span><button type="button" className="btn-secondary" onClick={cargar}>Reintentar</button></div>}
    <div className="sales-list">{filtradas.length===0?<div className="glass-card empty-card">No hay ventas para este filtro.</div>:filtradas.map(v=>{const st=estadoVenta(v);const abierto=detalle===v.id;const pagosVenta=cobros.filter(c=>c.venta_id===v.id);const d=daysUntil(v.fecha_vencimiento);return <article key={v.id} className="glass-card sales-card"><button type="button" className="sales-card-main" onClick={()=>setDetalle(abierto?null:v.id)}><div><small>{v.fecha_factura} · {v.tipo_documento}</small><strong>{v.numero_documento}</strong><span>{v.clientes?.nombre||'—'} · {(v.venta_proyectos||[]).length>1?`${v.venta_proyectos.length} proyectos`:v.proyectos?.nombre||'—'}</span></div><div><small>POR REGULARIZAR</small><strong>{money(v.saldo)}</strong><span className={`sales-status st-${statusClass(st)}`}>{st}</span></div></button>{abierto&&<div className="sales-open-detail">
      <div className="sales-detail"><div><span>LOB</span><strong>{v.lob||'—'}</strong></div><div><span>Ejecutivo</span><strong>{nombreCompletoUsuario(v.ejecutivo,v.ejecutivo||'—')}</strong></div><div><span>Precio venta</span><strong>{money(v.precio_venta)}</strong></div><div><span>Valor venta</span><strong>{money(v.valor_venta)}</strong></div><div><span>Costo</span><strong>{money(v.costo)}</strong></div><div><span>Utilidad</span><strong>{money(v.utilidad)}</strong></div><div><span>Condición</span><strong>{v.condicion_pago||'CONTADO'} · {v.plazo_dias||0} días</strong></div><div><span>Vencimiento</span><strong>{v.fecha_vencimiento||'—'} {d!=null&&d<0?`· ${Math.abs(d)} días vencido`:d!=null&&d<=7?`· vence en ${d} días`:''}</strong></div><div><span>F. control</span><strong>{v.fecha_control||'—'}</strong></div></div>
      <div className="sales-collection-grid"><section><header><div><span>Pago comercial</span><strong>{money(v.pagado)} / {money(v.pago_comercial_esperado??(Number(v.precio_venta)-Number(v.detraccion||0)-Number(v.retencion||0)))}</strong></div><b>{money(v.saldo_comercial??v.saldo)} pendiente</b></header>{puedeGestionar&&Number(v.saldo_comercial??v.saldo)>0.01&&<button type="button" className="btn-secondary" onClick={()=>abrirPago(v,'PAGO_COMERCIAL')}>Registrar pago</button>}</section>
      <section className={Number(v.detraccion||0)>0?'has-detraction':''}><header><div><span>Detracción {Number(v.porcentaje_detraccion||0)>0?`${Number(v.porcentaje_detraccion).toFixed(1)}%`:''}</span><strong>{money(v.detraccion_pagada)} / {money(v.detraccion)}</strong></div><b>{v.estado_detraccion||'NO APLICA'}</b></header>{puedeGestionar&&Number(v.saldo_detraccion||0)>0.01&&<button type="button" className="btn-secondary" onClick={()=>abrirPago(v,'DETRACCION')}>Registrar detracción</button>}</section></div>
      <div className="sales-history"><h5>Historial de pagos</h5>{pagosVenta.length===0?<p className="panel-note">Todavía no hay pagos registrados.</p>:pagosVenta.map(c=><div key={c.id} className="sales-history-row"><span>{c.fecha_pago}</span><strong>{c.tipo==='DETRACCION'?'Detracción':'Pago comercial'}</strong><span>{c.medio_pago||'—'}</span><b>{money(c.monto)}</b></div>)}</div>
    </div>}</article>})}</div>

    {modal&&<div className="sales-editor-overlay" onClick={()=>!cargando&&setModal(false)}><aside className="sales-editor-drawer" onClick={e=>e.stopPropagation()}><div className="section-header sales-editor-header"><div><h3 className="section-title"><FestosIcon name="ReceiptText" size={21}/> Registrar venta</h3><p className="panel-note">El plazo se toma automáticamente de Clientes y queda guardado como histórico.</p></div><button type="button" className="btn-secondary" onClick={()=>setModal(false)} disabled={cargando}><FestosIcon name="ArrowLeft" size={16}/> Volver</button></div><form className="glass-card form-card sales-editor-form" onSubmit={guardar}>
      <div className="form-row"><label>Proyecto *</label><SearchableSelect value={form.project_id} onChange={value=>setForm(f=>({...f,project_id:value}))} placeholder="Selecciona un proyecto..." ariaLabel="Seleccionar proyecto a facturar" options={[{value:'',label:'Selecciona un proyecto...'},...proyectos.map(p=>({value:p.id,label:`${p.codigo||''} · ${p.nombre}`,searchText:`${p.codigo||''} ${p.nombre||''} ${p.clientes?.nombre||''}`}))]}/></div>
      {proyecto&&<><div className="sales-impact"><div><span>Cliente</span><strong>{proyecto.clientes?.nombre||'—'}</strong></div><div><span>Condición</span><strong>{condicion}</strong></div><div><span>Plazo</span><strong>{plazo} días</strong></div><div><span>LOB</span><strong>{proyecto.lob||'—'}</strong></div><div><span>Compras vinculadas</span><strong>{comprasProyecto.length}</strong></div><div><span>Costo real</span><strong>{money(costoReal)}</strong></div></div>
      <section className="sales-linked-purchases">
        <button type="button" className="sales-linked-purchases-toggle" onClick={()=>setComprasAbiertas(v=>!v)} aria-expanded={comprasAbiertas}>
          <div><span>Compras vinculadas al proyecto</span><strong>{comprasProyecto.length} {comprasProyecto.length===1?'compra':'compras'} · {money(costoReal)}</strong><small>{comprasProyecto.length?`Se sincronizarán LOB y fecha de control al confirmar.`:'Este proyecto todavía no tiene compras vinculadas.'}</small></div>
          <FestosIcon name={comprasAbiertas?'ChevronUp':'ChevronDown'} size={19}/>
        </button>
        {comprasAbiertas&&<div className="sales-linked-purchases-body">
          {comprasProyecto.length===0?<div className="sales-linked-empty">No hay compras asociadas a este proyecto. La venta se puede registrar, pero el costo real será S/. 0.00 hasta que existan compras vinculadas.</div>:<>
            <div className="sales-linked-sync-note"><FestosIcon name="RefreshCw" size={16}/><div><strong>Vista previa de sincronización</strong><span>LOB final: {proyecto.lob||'—'} · Fecha de control final: {form.fecha_control||form.fecha_factura||'—'}</span></div></div>
            <div className="sales-linked-purchases-list">{comprasProyecto.map((c,index)=>{const proveedor=c.proveedor_nombre||c.proveedores?.nombre_comercial||c.proveedores?.nombre||'Proveedor sin nombre'; const lobCambia=String(c.lob||'').trim()!==String(proyecto.lob||'').trim(); const fechaFinal=form.fecha_control||form.fecha_factura; const fechaCambia=String(c.fecha_control||'')!==String(fechaFinal||''); return <article key={c.id} className="sales-linked-purchase-row">
              <div className="sales-linked-purchase-index">{index+1}</div>
              <div className="sales-linked-purchase-main"><strong>{proveedor}</strong><span>{c.tipo_comprobante||'SIN COMPROBANTE'}{c.numero_documento?` · ${c.numero_documento}`:''}{c.descripcion?` · ${c.descripcion}`:''}</span><small>{c.fecha_compra||'Sin fecha de compra'}</small></div>
              <div className="sales-linked-purchase-amount"><span>Valor compra</span><strong>{money(c.monto_base||c.monto)}</strong></div>
              <div className="sales-linked-purchase-change"><span>LOB</span><strong className={lobCambia?'will-change':''}>{c.lob||'Sin LOB'} <b>→</b> {proyecto.lob||'—'}</strong></div>
              <div className="sales-linked-purchase-change"><span>Fecha control</span><strong className={fechaCambia?'will-change':''}>{c.fecha_control||'Pendiente'} <b>→</b> {fechaFinal||'—'}</strong></div>
            </article>})}</div>
          </>}
        </div>}
      </section></>}
      <div className="form-grid-2"><div className="form-row"><label>Fecha factura *</label><input type="date" value={form.fecha_factura} onChange={e=>setForm({...form,fecha_factura:e.target.value,fecha_control:e.target.value})}/></div><div className="form-row"><label>Fecha vencimiento</label><input type="date" value={fechaVencimiento} readOnly/></div></div>
      <div className="form-grid-2"><div className="form-row"><label>Fecha de control compras *</label><input type="date" value={form.fecha_control} onChange={e=>setForm({...form,fecha_control:e.target.value})}/></div><div className="form-row"><label>Documento</label><select value={form.tipo_documento} onChange={e=>setForm({...form,tipo_documento:e.target.value})}><option>FACTURA</option><option>BOLETA</option><option>NOTA DE DÉBITO</option><option>OTRO</option></select></div></div>
      <div className="form-grid-2"><div className="form-row"><label>Número *</label><input value={form.numero_documento} onChange={e=>setForm({...form,numero_documento:e.target.value})} placeholder="FF01-0000123"/></div><div className="form-row"><label>Precio venta con IGV *</label><input type="number" min="0" step="0.01" value={form.precio_venta} onChange={e=>setForm({...form,precio_venta:e.target.value})}/></div></div>
      <div className="sales-preview"><div><span>Valor venta</span><strong>{money(valorVenta)}</strong></div><div><span>Costo real</span><strong>{money(costoReal)}</strong></div><div><span>Utilidad</span><strong>{money(utilidad)}</strong></div><div><span>Margen</span><strong>{margen.toFixed(1)}%</strong></div></div>
      <div className="sales-detraction-box"><label className="sales-switch"><input type="checkbox" checked={form.detraccion_aplica} onChange={e=>setForm({...form,detraccion_aplica:e.target.checked})}/><span>Aplica detracción</span></label>{form.detraccion_aplica&&<div className="form-row compact"><label>Porcentaje</label><div className="percent-input"><input type="number" min="0" max="100" step="0.1" value={form.porcentaje_detraccion} onChange={e=>setForm({...form,porcentaje_detraccion:e.target.value})}/><span>%</span></div></div>}<div><span>Detracción</span><strong>{money(montoDet)}</strong></div><div><span>Pago comercial esperado</span><strong>{money(pagoEsperado)}</strong></div></div>
      <div className="form-grid-2"><div className="form-row"><label>Retención</label><input type="number" min="0" step="0.01" value={form.retencion} onChange={e=>setForm({...form,retencion:e.target.value})}/></div><div className="form-row"><label>% Comisión</label><input type="number" min="0" step="0.01" value={form.porcentaje_comision} onChange={e=>setForm({...form,porcentaje_comision:e.target.value})} placeholder={String(proyecto?.ejecutivo||'').toUpperCase()==='MAR'?'Ej. 3':'0'}/></div></div>
      <div className="sales-impact-warning"><FestosIcon name="RefreshCw" size={17}/><div><strong>Impacto al confirmar</strong><span>Se guardará el plazo del cliente ({plazo} días), el vencimiento ({fechaVencimiento||'—'}), se actualizarán {comprasProyecto.length} compras y se separará el pago comercial de la detracción.</span></div></div>
      <div className="form-row"><label>Observaciones</label><textarea rows="2" value={form.observaciones} onChange={e=>setForm({...form,observaciones:e.target.value})}/></div>
      <div className="modal-actions sales-editor-actions"><button className="btn-primary" disabled={cargando}>{cargando?'Registrando...':'Confirmar venta'}</button><button type="button" className="btn-secondary" onClick={()=>setModal(false)} disabled={cargando}>Cancelar</button></div>
    </form></aside></div>}

    {payModal&&<div className="modal-overlay" onClick={()=>!guardandoPago&&setPayModal(false)}><form className="glass-card modal-card sales-pay-modal" onSubmit={guardarPago} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h4 className="panel-title">{payForm.tipo==='DETRACCION'?'Registrar detracción':'Registrar pago'}</h4><p className="panel-note">El historial queda vinculado a la factura.</p></div><button type="button" className="modal-close-btn" onClick={()=>setPayModal(false)}>×</button></div><div className="form-grid-2"><div className="form-row"><label>Fecha *</label><input type="date" value={payForm.fecha_pago} onChange={e=>setPayForm({...payForm,fecha_pago:e.target.value})}/></div><div className="form-row"><label>Monto *</label><input type="number" min="0" step="0.01" value={payForm.monto} onChange={e=>setPayForm({...payForm,monto:e.target.value})}/></div></div><div className="form-row"><label>Medio de pago</label><select value={payForm.medio_pago} onChange={e=>setPayForm({...payForm,medio_pago:e.target.value})}><option>TRANSFERENCIA</option><option>DEPÓSITO</option><option>CHEQUE</option><option>EFECTIVO</option><option>OTRO</option></select></div><div className="form-row"><label>Referencia / operación</label><input value={payForm.referencia} onChange={e=>setPayForm({...payForm,referencia:e.target.value})}/></div><div className="form-row"><label>Observaciones</label><textarea rows="2" value={payForm.observaciones} onChange={e=>setPayForm({...payForm,observaciones:e.target.value})}/></div><div className="modal-actions"><button className="btn-primary" disabled={guardandoPago}>{guardandoPago?'Guardando...':'Registrar'}</button><button type="button" className="btn-secondary" onClick={()=>setPayModal(false)}>Cancelar</button></div></form></div>}
  </div>;
}
