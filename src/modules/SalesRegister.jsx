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
const LOBS_VENTAS = ['GRAFICA PUBLICITARIA','MERCH & GIFTS','ESPACIOS Y ESTRUCTURAS','AGENCIA 360°'];
const emptyForm = { project_id:'', project_ids:[], allocations:{}, costo_manual_activo:false, costo_manual:'', lob:'', fecha_factura:today(), tipo_documento:'FACTURA', numero_documento:'', valor_venta:'', detraccion_aplica:false, porcentaje_detraccion:'12', ejecutivo:'', observaciones:'' };
const emptyPay = { venta_id:'', tipo:'PAGO_COMERCIAL', fecha_pago:today(), monto:'', medio_pago:'TRANSFERENCIA', observaciones:'' };

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
  const [desde,setDesde]=useState(''); const [hasta,setHasta]=useState(''); const [clienteFiltro,setClienteFiltro]=useState('TODOS'); const [lobFiltro,setLobFiltro]=useState('TODOS'); const [ejecutivoFiltro,setEjecutivoFiltro]=useState('TODOS');
  const [editandoId,setEditandoId]=useState(null);
  const [comprasAbiertas,setComprasAbiertas]=useState(false); const [selectorMultiproyecto,setSelectorMultiproyecto]=useState(false);
  const [errorCarga,setErrorCarga]=useState(''); const [adjuntosVenta,setAdjuntosVenta]=useState({}); const [adjuntosPendientes,setAdjuntosPendientes]=useState([]); const [subiendoAdjuntos,setSubiendoAdjuntos]=useState(false);

  const cargar=async()=>{
    setErrorCarga('');
    try{
      const [v,p,c,cb,cl,vp]=await Promise.all([
        supabase.from('ventas').select('*').order('fecha_factura',{ascending:false}).order('created_at',{ascending:false}),
        supabase.from('proyectos').select('id,codigo,nombre,categoria,lob,ejecutivo,client_id,estado,valor_venta,valor_base').order('created_at',{ascending:false}),
        supabase.from('compras').select('id,project_id,fecha_compra,descripcion,monto_base,monto,lob,fecha_control,tipo_comprobante,numero_documento,proveedor_nombre,proveedores(nombre,nombre_comercial)').not('project_id','is',null),
        supabase.from('ventas_cobros').select('*').order('fecha_pago',{ascending:false}).order('created_at',{ascending:false}),
        supabase.from('clientes').select('id,nombre,ruc,tipo_pago,plazo_dias,agente_retenedor'),
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
    setForm({...emptyForm,project_id:pid,project_ids:[pid]}); setComprasAbiertas(false); setModal(true); onConsumirProyecto();
  },[proyectoSolicitado]);

  const idsSeleccionados=form.project_ids?.length?form.project_ids:(form.project_id?[form.project_id]:[]);
  const proyectosSeleccionados=proyectos.filter(p=>idsSeleccionados.includes(p.id));
  const proyecto=proyectosSeleccionados[0]||null;
  const comprasProyecto=useMemo(()=>compras.filter(c=>idsSeleccionados.includes(c.project_id)),[compras,form.project_ids,form.project_id]);
  const costoReal=useMemo(()=>comprasProyecto.reduce((s,c)=>s+(Number(c.monto_base)||Number(c.monto)||0),0),[comprasProyecto]);
  const costoTotal=form.costo_manual_activo?(Number(form.costo_manual)||0):costoReal;
  const valorVenta=Number(form.valor_venta)||0; const precio=Number((valorVenta*1.18).toFixed(2)); const igv=Number((precio-valorVenta).toFixed(2)); const utilidad=valorVenta-costoTotal; const margen=valorVenta>0?utilidad/valorVenta*100:0;
  const condicion=String(proyecto?.clientes?.tipo_pago||'CONTADO').toUpperCase();
  const plazo=(condicion==='CREDITO'||condicion==='CRÉDITO')?(Number(proyecto?.clientes?.plazo_dias)||0):0;
  const fechaVencimiento=datePlus(form.fecha_factura,plazo);
  const superaUmbral=precio>700;
  const agenteRetenedor=!!proyecto?.clientes?.agente_retenedor;
  const detraccionActiva=superaUmbral&&!!form.detraccion_aplica;
  const montoDet=detraccionActiva?Number((precio*(Number(form.porcentaje_detraccion)||0)/100).toFixed(2)):0;
  const retencionAuto=superaUmbral&&agenteRetenedor&&!detraccionActiva?Number((precio*0.03).toFixed(2)):0;
  const pagoEsperado=Math.max(Number((precio-retencionAuto-montoDet).toFixed(2)),0);

  const abrir=()=>{setEditandoId(null);setForm({...emptyForm});setAdjuntosPendientes([]);setComprasAbiertas(false);setModal(true)};
  const abrirEditar=(v)=>{ cargarAdjuntosVenta(v.id);
    const links=v.venta_proyectos||[];
    setEditandoId(v.id);
    setForm({
      ...emptyForm,
      project_id:v.project_id||links[0]?.project_id||'',
      project_ids:links.length?links.map(x=>x.project_id):[v.project_id].filter(Boolean),
      allocations:Object.fromEntries(links.map(x=>[x.project_id,String(Number(x.valor_venta_asignado)||0)])),
      costo_manual_activo:!!v.costo_manual_activo, costo_manual:v.costo_manual_activo?String(Number(v.costo_manual)||0):'',
      lob:v.lob||'',
      fecha_factura:v.fecha_factura||today(),
      tipo_documento:v.tipo_documento||'FACTURA',
      numero_documento:v.numero_documento||'',
      valor_venta:String(Number(v.valor_venta)||0),
      detraccion_aplica:!!v.detraccion_aplica||Number(v.detraccion||0)>0,
      ejecutivo:String(v.ejecutivo||'').trim().toUpperCase()==='MAR'?'MARJORIE MUÑOZ':(v.ejecutivo||''), porcentaje_detraccion:String(v.porcentaje_detraccion ?? (v.detraccion_aplica?12:12)), observaciones:v.observaciones||''
    });
    setAdjuntosPendientes([]); setComprasAbiertas(false); setModal(true);
  };
  const esFuncionNoDisponible=(err)=>{
    const msg=String(err?.message||'').toLowerCase();
    return err?.code==='PGRST202'||msg.includes('schema cache')||msg.includes('could not find the function');
  };
  const recalcularFacturacionLocal=async(projectId)=>{
    if(!projectId) return;
    try{
      const [{data:links=[]},{data:directas=[]},{data:proy}]=await Promise.all([
        supabase.from('venta_proyectos').select('venta_id,precio_venta_asignado').eq('project_id',projectId),
        supabase.from('ventas').select('id,precio_venta,fecha_factura').eq('project_id',projectId),
        supabase.from('proyectos').select('id,valor_base,valor_venta,estado').eq('id',projectId).maybeSingle()
      ]);
      const linkedIds=new Set((links||[]).map(x=>x.venta_id));
      const totalLinks=(links||[]).reduce((s,x)=>s+(Number(x.precio_venta_asignado)||0),0);
      const directasSinLink=(directas||[]).filter(x=>!linkedIds.has(x.id));
      const totalDirecto=directasSinLink.reduce((s,x)=>s+(Number(x.precio_venta)||0),0);
      const total=totalLinks+totalDirecto;
      const objetivo=(Number(proy?.valor_base)||Number(proy?.valor_venta)||0)*1.18;
      const estadoFact=total<=0.01?'NO FACTURADO':(objetivo>0&&total>=objetivo-0.01?'FACTURADO':'PARCIAL');
      const idsVentas=Array.from(new Set([...(links||[]).map(x=>x.venta_id),...(directas||[]).map(x=>x.id)]));
      let ultima=null;
      if(idsVentas.length){ const {data:fechas=[]}=await supabase.from('ventas').select('fecha_factura').in('id',idsVentas).order('fecha_factura',{ascending:false}).limit(1); ultima=fechas?.[0]?.fecha_factura||null; }
      const cambios={total_facturado:total,facturacion_estado:estadoFact,fecha_ultima_factura:ultima};
      if(proy?.estado==='FACTURADO'&&estadoFact!=='FACTURADO') cambios.estado='FINALIZADO';
      if(estadoFact==='FACTURADO') cambios.estado='FACTURADO';
      await supabase.from('proyectos').update(cambios).eq('id',projectId);
    }catch(e){ console.warn('No se pudo recalcular facturación local',projectId,e); }
  };
  const eliminarVenta=async(v)=>{
    if(!puedeGestionar) return;
    if(!window.confirm(`¿Eliminar ${v.tipo_documento||'venta'} ${v.numero_documento}?\n\nSe eliminarán también sus cobros vinculados y se recalculará la facturación de los proyectos.`)) return;
    try{
      const projectIds=Array.from(new Set([v.project_id,...(v.venta_proyectos||[]).map(x=>x.project_id)].filter(Boolean)));
      const {error}=await supabase.rpc('eliminar_venta_festos',{p_venta_id:v.id});
      if(error){
        if(!esFuncionNoDisponible(error)) throw error;
        const {error:deleteError}=await supabase.from('ventas').delete().eq('id',v.id);
        if(deleteError) throw deleteError;
        for(const pid of projectIds) await recalcularFacturacionLocal(pid);
      }
      onNotify(`Venta ${v.numero_documento} eliminada`,'nuevo'); onAudit('Eliminación',`Registro de venta ${v.numero_documento}`);
      setDetalle(null); await cargar();
    }catch(err){ console.error(err); alert(`No se pudo eliminar la venta. ${err.message||''}`); }
  };
  const guardar=async e=>{
    e.preventDefault();
    if(!idsSeleccionados.length||!form.lob||!form.ejecutivo.trim()||!form.fecha_factura||!form.numero_documento.trim()||valorVenta<=0) return alert('Completa proyecto, LOB, fecha, número de comprobante y valor venta.');
    if(detraccionActiva && (!Number.isFinite(Number(form.porcentaje_detraccion)) || Number(form.porcentaje_detraccion)<=0 || Number(form.porcentaje_detraccion)>100)) return alert('Ingresa un porcentaje de detracción válido entre 0.01 y 100.');
    if(form.costo_manual_activo && (form.costo_manual==='' || !Number.isFinite(Number(form.costo_manual)) || Number(form.costo_manual)<0)) return alert('Ingresa un costo total manual válido.');
    const asignaciones=idsSeleccionados.map(id=>({project_id:id,valor_venta:Number(form.allocations?.[id]||0)}));
    if(idsSeleccionados.length===1) asignaciones[0].valor_venta=valorVenta;
    if(idsSeleccionados.length>1 && (asignaciones.some(x=>x.valor_venta<=0)||Math.abs(asignaciones.reduce((sum,x)=>sum+x.valor_venta,0)-valorVenta)>0.009)) return alert('Distribuye el Valor venta entre los proyectos. La suma debe coincidir exactamente con el valor de la factura.');
    setCargando(true);
    try{
      const payload={
        p_fecha_factura:form.fecha_factura,
        p_tipo_documento:form.tipo_documento,
        p_numero_documento:form.numero_documento.trim(),
        p_valor_venta:valorVenta,
        p_lob:form.lob,
        p_detraccion_aplica:detraccionActiva, p_porcentaje_detraccion:detraccionActiva?Number(form.porcentaje_detraccion):0, p_ejecutivo:form.ejecutivo.trim(),
        p_observaciones:form.observaciones.trim()||null
      };
      const {data,error}=await supabase.rpc('guardar_venta_festos_v4',{
        p_venta_id:editandoId||null,
        p_proyectos:asignaciones,
        p_costo_manual_activo:!!form.costo_manual_activo,
        p_costo_manual:form.costo_manual_activo?Number(form.costo_manual):null,
        ...payload,
        p_created_by:usuario||null
      });
      if(error) throw error;
      const ventaId=editandoId||data?.venta_id;
      if(ventaId && adjuntosPendientes.length) {
        const resultado=await subirArchivosVenta(ventaId,adjuntosPendientes);
        if(resultado.errores.length) alert(`Venta guardada, pero algunos adjuntos fallaron: ${resultado.errores.join('; ')}`);
      }
      onNotify(editandoId?'Venta actualizada':'Venta registrada y cobranza programada','nuevo'); onAudit(editandoId?'Edición':'Creación',`Registro de venta ${form.numero_documento} · ${proyecto?.nombre||''} · ${money(precio)}`);
      const eraEdicion=!!editandoId; setModal(false); setForm({...emptyForm}); setAdjuntosPendientes([]); setEditandoId(null); await cargar();
      if(!eraEdicion) alert(`Venta registrada. Vence: ${data?.fecha_vencimiento||fechaVencimiento}. Pago comercial esperado: ${money(data?.pago_comercial_esperado??pagoEsperado)}${Number(data?.detraccion||0)>0?` · Detracción: ${money(data.detraccion)}`:''}${Number(data?.retencion||0)>0?` · Retención: ${money(data.retencion)}`:''}.`);
    }catch(err){console.error(err);alert(`No se pudo registrar la venta. ${err.message||''}`)}finally{setCargando(false)}
  };

  const cargarAdjuntosVenta=async(ventaId)=>{
    if(!ventaId) return;
    const {data,error}=await supabase.from('ventas_adjuntos').select('*').eq('venta_id',ventaId).order('created_at',{ascending:true});
    if(error){console.error('Adjuntos de venta',error);return;}
    setAdjuntosVenta(prev=>({...prev,[ventaId]:data||[]}));
  };
  const subirArchivosVenta=async(ventaId,archivos)=>{
    const errores=[]; setSubiendoAdjuntos(true);
    try{
      for(const file of archivos){
        if(file.size>15*1024*1024){errores.push(`${file.name}: máximo 15 MB`);continue;}
        if(!/\.(pdf|png|jpe?g|webp|docx?|xlsx?)$/i.test(file.name)){errores.push(`${file.name}: formato no admitido`);continue;}
        const ruta=`${ventaId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        const {error:upError}=await supabase.storage.from('ventas-adjuntos').upload(ruta,file,{upsert:false});
        if(upError){errores.push(`${file.name}: ${upError.message}`);continue;}
        const {error:dbError}=await supabase.from('ventas_adjuntos').insert({venta_id:ventaId,nombre:file.name,ruta,tamano:file.size,tipo:file.type||null});
        if(dbError){await supabase.storage.from('ventas-adjuntos').remove([ruta]);errores.push(`${file.name}: ${dbError.message}`);}
      }
      await cargarAdjuntosVenta(ventaId);
    }finally{setSubiendoAdjuntos(false);}
    return {errores};
  };
  const abrirAdjuntoVenta=async(doc)=>{
    const {data,error}=await supabase.storage.from('ventas-adjuntos').createSignedUrl(doc.ruta,90);
    if(error||!data?.signedUrl) return alert(error?.message||'No se pudo abrir el archivo');
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  };
  const quitarAdjuntoVenta=async(doc)=>{
    if(!window.confirm(`¿Eliminar el archivo ${doc.nombre}?`)) return;
    const {error}=await supabase.from('ventas_adjuntos').delete().eq('id',doc.id);
    if(error) return alert(error.message);
    await supabase.storage.from('ventas-adjuntos').remove([doc.ruta]);
    await cargarAdjuntosVenta(doc.venta_id);
  };
  const archivosVentaUI=(ventaId)=> <div className="sales-attachments"><strong>Adjuntos</strong>
    {(adjuntosVenta[ventaId]||[]).map(doc=><div className="sales-attachment-item" key={doc.id}><span>{doc.nombre}</span><button type="button" className="btn-secondary" onClick={()=>abrirAdjuntoVenta(doc)}>Abrir / descargar</button>{puedeGestionar&&<button type="button" className="btn-danger" onClick={()=>quitarAdjuntoVenta(doc)}>Eliminar</button>}</div>)}
    {puedeGestionar&&ventaId&&<label className="sales-attachment-add">Agregar archivos <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" disabled={subiendoAdjuntos} onChange={async e=>{const files=[...e.target.files];e.target.value='';const res=await subirArchivosVenta(ventaId,files);if(res.errores.length)alert(res.errores.join('\n'));}}/></label>}
  </div>;
  const abrirPago=(v,tipo='PAGO_COMERCIAL')=>{
    const pendiente=tipo==='DETRACCION'?Number(v.saldo_detraccion||0):Number(v.saldo_comercial ?? v.saldo ?? 0);
    setPayForm({...emptyPay,venta_id:v.id,tipo,monto:pendiente>0?String(pendiente.toFixed(2)):''}); setPayModal(true);
  };
  const guardarPago=async e=>{
    e.preventDefault(); const monto=Number(payForm.monto)||0; if(!payForm.venta_id||monto<=0) return alert('Ingresa un monto válido.');
    setGuardandoPago(true);
    try{
      const {error}=await supabase.rpc('registrar_cobro_venta_festos_v2',{p_venta_id:payForm.venta_id,p_tipo:payForm.tipo,p_fecha_pago:payForm.fecha_pago,p_monto:monto,p_medio_pago:payForm.medio_pago||null,p_observaciones:payForm.observaciones.trim()||null,p_created_by:usuario||null});
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
    const fechaOk=(!desde||String(v.fecha_factura||'')>=desde)&&(!hasta||String(v.fecha_factura||'')<=hasta);
    const clienteOk=clienteFiltro==='TODOS'||String(v.clientes?.id||v.client_id||'')===clienteFiltro;
    const lobOk=lobFiltro==='TODOS'||String(v.lob||'')===lobFiltro;
    const ejecutivoOk=ejecutivoFiltro==='TODOS'||String(v.ejecutivo||'')===ejecutivoFiltro;
    return(!q||texto.includes(q))&&(estado==='TODOS'||estado===st)&&alertaOk&&fechaOk&&clienteOk&&lobOk&&ejecutivoOk;
  }),[ventas,busqueda,estado,alertFilter,desde,hasta,clienteFiltro,lobFiltro,ejecutivoFiltro]);
  const opcionesClientes=useMemo(()=>Array.from(new Map(ventas.filter(v=>v.clientes?.id).map(v=>[v.clientes.id,v.clientes])).values()).sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''))),[ventas]);
  const opcionesLob=useMemo(()=>Array.from(new Set(ventas.map(v=>v.lob).filter(Boolean))).sort(),[ventas]);
  const opcionesEjecutivo=useMemo(()=>Array.from(new Set(ventas.map(v=>v.ejecutivo).filter(Boolean))).sort(),[ventas]);
  const limpiarFiltros=()=>{setBusqueda('');setEstado('TODOS');setAlertFilter('');setDesde('');setHasta('');setClienteFiltro('TODOS');setLobFiltro('TODOS');setEjecutivoFiltro('TODOS');};
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
          { header: 'Costo total', width: 18, type: 'money', value: v => Number(v.costo) || 0 },
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
          { label: 'Desde', value: desde || '—' }, { label: 'Hasta', value: hasta || '—' },
          { label: 'Cliente', value: clienteFiltro==='TODOS'?'TODOS':opcionesClientes.find(x=>x.id===clienteFiltro)?.nombre||clienteFiltro },
          { label: 'LOB', value: lobFiltro }, { label: 'Ejecutivo', value: ejecutivoFiltro },
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

    <div className="glass-card sales-toolbar sales-toolbar-pro"><div className="sales-search-wide"><input className="search-input" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar factura, cliente o proyecto..."/></div><div className="sales-filter-grid"><label><span>Desde</span><input type="date" value={desde} onChange={e=>setDesde(e.target.value)}/></label><label><span>Hasta</span><input type="date" value={hasta} onChange={e=>setHasta(e.target.value)}/></label><label><span>Cliente</span><select value={clienteFiltro} onChange={e=>setClienteFiltro(e.target.value)}><option value="TODOS">Todos</option>{opcionesClientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label><label><span>LOB</span><select value={lobFiltro} onChange={e=>setLobFiltro(e.target.value)}><option value="TODOS">Todos</option>{opcionesLob.map(x=><option key={x} value={x}>{x}</option>)}</select></label><label><span>Ejecutivo</span><select value={ejecutivoFiltro} onChange={e=>setEjecutivoFiltro(e.target.value)}><option value="TODOS">Todos</option>{opcionesEjecutivo.map(x=><option key={x} value={x}>{nombreCompletoUsuario(x,x)}</option>)}</select></label><label><span>Estado</span><select value={estado} onChange={e=>setEstado(e.target.value)}><option>TODOS</option><option>PENDIENTE</option><option>PARCIAL</option><option>VENCIDO</option><option>PENDIENTE DETRACCIÓN</option><option>COBRADO</option></select></label></div><div className="sales-filter-actions"><span>{filtradas.length} venta{filtradas.length===1?'':'s'} visible{filtradas.length===1?'':'s'}</span><button type="button" className="btn-secondary" onClick={limpiarFiltros}><FestosIcon name="RotateCcw" size={15}/> Limpiar filtros</button></div></div>

    {errorCarga&&<div className="glass-card sales-load-error"><strong>No se pudo cargar Registro de Ventas</strong><span>{errorCarga}</span><button type="button" className="btn-secondary" onClick={cargar}>Reintentar</button></div>}
    <div className="sales-list">{filtradas.length===0?<div className="glass-card empty-card">No hay ventas para este filtro.</div>:filtradas.map(v=>{const st=estadoVenta(v);const abierto=detalle===v.id;const pagosVenta=cobros.filter(c=>c.venta_id===v.id);const d=daysUntil(v.fecha_vencimiento);return <article key={v.id} className="glass-card sales-card"><button type="button" className="sales-card-main" onClick={()=>{if(!abierto)cargarAdjuntosVenta(v.id);setDetalle(abierto?null:v.id);}}><div><strong>{v.numero_documento}</strong><span>{(v.venta_proyectos||[]).length>1?v.venta_proyectos.map(x=>x.proyecto?.nombre||'—').join(' · '):v.proyectos?.nombre||'—'}</span></div><div className="sales-card-right"><div className="sales-card-metrics"><div><small>VALOR VENTA</small><strong>{money(v.valor_venta)}</strong></div><div className="sales-margin-alert"><small>MARGEN</small><strong>{Number(v.costo||0) === 0 ? "Por verificar" : `${Number(v.margen||0).toFixed(1)}%`}</strong></div></div><div className="sales-card-payment"><span className={`sales-status st-${statusClass(st)}`}>{st}</span></div></div></button>{abierto&&<div className="sales-open-detail">
      <div className="sales-detail"><div><span>LOB</span><strong>{v.lob||'—'}</strong></div><div><span>Ejecutivo</span><strong>{nombreCompletoUsuario(v.ejecutivo,v.ejecutivo||'—')}</strong></div><div><span>Precio venta</span><strong>{money(v.precio_venta)}</strong></div><div><span>Valor venta</span><strong>{money(v.valor_venta)}</strong></div><div><span>Costo</span><strong>{money(v.costo)}</strong></div><div><span>Utilidad</span><strong>{money(v.utilidad)}</strong></div><div><span>Retención</span><strong>{money(v.retencion)}</strong></div><div><span>Condición</span><strong>{v.condicion_pago||'CONTADO'} · {v.plazo_dias||0} días</strong></div><div><span>Vencimiento</span><strong>{v.fecha_vencimiento||'—'} {d!=null&&d<0?`· ${Math.abs(d)} días vencido`:d!=null&&d<=7?`· vence en ${d} días`:''}</strong></div><div><span>Fecha de emisión factura</span><strong>{v.fecha_factura||'—'}</strong></div></div>
      <div className="sales-collection-grid"><section className={Number(v.detraccion||0)>0?'has-detraction':''}><header><div><span>Detracción {Number(v.porcentaje_detraccion||0)>0?`${Number(v.porcentaje_detraccion).toFixed(1)}%`:''}</span><strong>{money(v.detraccion_pagada)} / {money(v.detraccion)}</strong></div><b>{v.estado_detraccion||'NO APLICA'}</b></header>{puedeGestionar&&Number(v.saldo_detraccion||0)>0.01&&<button type="button" className="btn-secondary" onClick={()=>abrirPago(v,'DETRACCION')}>Registrar detracción</button>}</section></div>
      {puedeGestionar&&<div className="sales-record-actions"><button type="button" className="btn-secondary" onClick={()=>abrirEditar(v)}><FestosIcon name="Pencil" size={15}/> Editar venta</button><button type="button" className="btn-danger" onClick={()=>eliminarVenta(v)}><FestosIcon name="Trash2" size={15}/> Eliminar</button></div>}
      {(adjuntosVenta[v.id]||[]).length>0&&<div className="sales-detail-files"><strong>Adjuntos</strong>{(adjuntosVenta[v.id]||[]).map(doc=><button key={doc.id} className="btn-secondary" type="button" onClick={()=>abrirAdjuntoVenta(doc)}>{doc.nombre}</button>)}</div>}<div className="sales-history"><h5>Historial de pagos</h5>{pagosVenta.length===0?<p className="panel-note">Todavía no hay pagos registrados.</p>:pagosVenta.map(c=><div key={c.id} className="sales-history-row"><span>{c.fecha_pago}</span><strong>{c.tipo==='DETRACCION'?'Detracción':'Pago comercial'}</strong><span>{c.medio_pago||'—'}</span><b>{money(c.monto)}</b></div>)}</div>
    </div>}</article>})}</div>

    {modal&&<div className="sales-editor-overlay" onClick={()=>!cargando&&setModal(false)}><aside className="sales-editor-drawer" onClick={e=>e.stopPropagation()}><div className="section-header sales-editor-header"><div><h3 className="section-title"><FestosIcon name="ReceiptText" size={21}/> {editandoId?'Editar venta':'Registrar venta'}</h3></div><button type="button" className="btn-secondary" onClick={()=>setModal(false)} disabled={cargando}><FestosIcon name="ArrowLeft" size={16}/> Volver</button></div><form className="glass-card form-card sales-editor-form" onSubmit={guardar}>
      <div className="form-row"><label>Proyectos *</label><div className="sales-project-multi"><button type="button" className="sales-project-choice" onClick={()=>setSelectorMultiproyecto(v=>!v)}>{proyectosSeleccionados.length?proyectosSeleccionados.map(p=>p.codigo+' · '+p.nombre).join('  |  '):'Selecciona uno o varios proyectos'} <span>▾</span></button>{selectorMultiproyecto&&<div className="sales-project-options">{proyectos.filter(p=>!proyectosSeleccionados.length||idsSeleccionados.includes(p.id)||p.client_id===proyecto?.client_id).map(p=><label key={p.id}><input type="checkbox" checked={idsSeleccionados.includes(p.id)} onChange={e=>{const next=e.target.checked?[...idsSeleccionados,p.id]:idsSeleccionados.filter(id=>id!==p.id);setForm(f=>({...f,project_id:next[0]||'',project_ids:next,allocations:Object.fromEntries(Object.entries(f.allocations||{}).filter(([id])=>next.includes(id))),lob:next.length?f.lob:''}));}}/>{p.codigo} · {p.nombre}</label>)}</div>}</div></div>
      {proyecto&&<><div className="sales-impact"><div><span>Cliente</span><strong>{proyecto.clientes?.nombre||'—'}</strong></div><div><span>Condición</span><strong>{condicion}</strong></div><div><span>Plazo</span><strong>{plazo} días</strong></div></div>
      </>}
      <div className="form-row"><label>LOB *</label><select value={form.lob} onChange={e=>setForm({...form,lob:e.target.value})} required><option value="">Selecciona LOB...</option>{LOBS_VENTAS.map(lob=><option key={lob} value={lob}>{lob}</option>)}</select></div>
      <div className="form-grid-2"><div className="form-row"><label>Fecha factura *</label><input type="date" value={form.fecha_factura} onChange={e=>setForm({...form,fecha_factura:e.target.value})}/></div><div className="form-row"><label>Fecha vencimiento</label><input type="date" value={fechaVencimiento} readOnly/></div></div>
      <div className="form-grid-2"><div className="form-row"><label>Documento</label><select value={form.tipo_documento} onChange={e=>setForm({...form,tipo_documento:e.target.value})}><option>FACTURA</option><option>BOLETA</option><option>NOTA DE CRÉDITO</option><option>NOTA DE DÉBITO</option><option>OTRO</option></select></div><div className="form-row"><label>Número *</label><input value={form.numero_documento} onChange={e=>setForm({...form,numero_documento:e.target.value})} placeholder="FF01-0000123"/></div></div>
      <div className="form-row"><label>Ejecutivo *</label><select value={form.ejecutivo} onChange={e=>setForm({...form,ejecutivo:e.target.value})} required><option value="">Selecciona un ejecutivo</option><option value="GONZALO">GONZALO</option><option value="MARJORIE MUÑOZ">MARJORIE MUÑOZ</option></select></div><div className="form-row"><label>Valor venta *</label><input type="number" min="0" step="0.01" value={form.valor_venta} onChange={e=>{const next=e.target.value; const p=(Number(next)||0)*1.18; setForm({...form,valor_venta:next,detraccion_aplica:p>700?form.detraccion_aplica:false});}} placeholder="Monto sin IGV"/></div>
      {idsSeleccionados.length>1&&<div className="sales-allocation"><strong>Distribución del valor venta por proyecto</strong>{proyectosSeleccionados.map(p=><label key={p.id}><span>{p.codigo} · {p.nombre}</span><input type="number" min="0" step="0.01" value={form.allocations?.[p.id]??''} onChange={e=>setForm(f=>({...f,allocations:{...f.allocations,[p.id]:e.target.value}}))} placeholder="S/ sin IGV"/></label>)}<small>Asignado: {money(idsSeleccionados.reduce((sum,id)=>sum+(Number(form.allocations?.[id])||0),0))} de {money(valorVenta)}</small></div>}
      <label className="sales-manual-cost"><input type="checkbox" checked={!!form.costo_manual_activo} onChange={e=>setForm(f=>({...f,costo_manual_activo:e.target.checked,costo_manual:e.target.checked?(f.costo_manual||String(costoReal)):''}))}/> Modificar COSTO TOTAL manualmente (desvincular cálculo automático)</label>
      {form.costo_manual_activo&&<div className="form-row"><label>COSTO TOTAL manual (S/)</label><input type="number" min="0" step="0.01" value={form.costo_manual} onChange={e=>setForm({...form,costo_manual:e.target.value})} required/></div>}
      <div className="sales-preview"><div><span>IGV 18%</span><strong>{money(igv)}</strong></div><div><span>Precio venta</span><strong>{money(precio)}</strong></div><div><span>Costo total</span><strong>{money(costoTotal)}</strong></div><div><span>Utilidad</span><strong>{money(utilidad)}</strong></div><div><span>Margen</span><strong>{margen.toFixed(1)}%</strong></div></div>
      <div className="sales-detraction-box sales-tax-rules sales-tax-rules-compact"><div><span>Retención</span><strong>{retencionAuto>0?`3% · ${money(retencionAuto)}`:'NO APLICA'}</strong></div><label className="sales-switch"><input type="checkbox" checked={detraccionActiva} disabled={!superaUmbral} onChange={e=>setForm({...form,detraccion_aplica:e.target.checked})}/><span>Detracción</span></label>{detraccionActiva&&<label className="sales-detraction-rate">% <input type="number" min="0.01" max="100" step="0.01" value={form.porcentaje_detraccion} onChange={e=>setForm({...form,porcentaje_detraccion:e.target.value})} required/></label>}<div><span>Detracción</span><strong>{money(montoDet)}</strong></div><div><span>Pago comercial esperado</span><strong>{money(pagoEsperado)}</strong></div></div>
      
      <div className="form-row sales-attachments-editor"><label>Adjuntos</label><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" onChange={e=>setAdjuntosPendientes(prev=>[...prev,...e.target.files])}/>{adjuntosPendientes.map((f,i)=><div key={`${f.name}-${i}`} className="sales-attachment-item"><span>{f.name}</span><button type="button" className="btn-secondary" onClick={()=>setAdjuntosPendientes(a=>a.filter((_,j)=>j!==i))}>Quitar</button></div>)}{editandoId&&archivosVentaUI(editandoId)}</div><div className="form-row"><label>Observaciones</label><textarea rows="2" value={form.observaciones} onChange={e=>setForm({...form,observaciones:e.target.value})}/></div>
      <div className="modal-actions sales-editor-actions"><button className="btn-primary" disabled={cargando}>{cargando?(editandoId?'Guardando...':'Registrando...'):(editandoId?'Guardar cambios':'Confirmar venta')}</button><button type="button" className="btn-secondary" onClick={()=>setModal(false)} disabled={cargando}>Cancelar</button></div>
    </form></aside></div>}

    {payModal&&<div className="modal-overlay" onClick={()=>!guardandoPago&&setPayModal(false)}><form className="glass-card modal-card sales-pay-modal" onSubmit={guardarPago} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h4 className="panel-title">{payForm.tipo==='DETRACCION'?'Registrar detracción':'Registrar pago'}</h4><p className="panel-note">El historial queda vinculado a la factura.</p></div><button type="button" className="modal-close-btn" onClick={()=>setPayModal(false)}>×</button></div><div className="form-grid-2"><div className="form-row"><label>Fecha *</label><input type="date" value={payForm.fecha_pago} onChange={e=>setPayForm({...payForm,fecha_pago:e.target.value})}/></div><div className="form-row"><label>Monto *</label><input type="number" min="0" step="0.01" value={payForm.monto} onChange={e=>setPayForm({...payForm,monto:e.target.value})}/></div></div><div className="form-row"><label>Medio de pago</label><select value={payForm.medio_pago} onChange={e=>setPayForm({...payForm,medio_pago:e.target.value})}><option>TRANSFERENCIA</option><option>DEPÓSITO</option><option>CHEQUE</option><option>EFECTIVO</option><option>OTRO</option></select></div><div className="form-row sales-attachments-editor"><label>Adjuntos</label><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" onChange={e=>setAdjuntosPendientes(prev=>[...prev,...e.target.files])}/>{adjuntosPendientes.map((f,i)=><div key={`${f.name}-${i}`} className="sales-attachment-item"><span>{f.name}</span><button type="button" className="btn-secondary" onClick={()=>setAdjuntosPendientes(a=>a.filter((_,j)=>j!==i))}>Quitar</button></div>)}{editandoId&&archivosVentaUI(editandoId)}</div><div className="form-row"><label>Observaciones</label><textarea rows="2" value={payForm.observaciones} onChange={e=>setPayForm({...payForm,observaciones:e.target.value})}/></div><div className="modal-actions"><button className="btn-primary" disabled={guardandoPago}>{guardandoPago?'Guardando...':'Registrar'}</button><button type="button" className="btn-secondary" onClick={()=>setPayModal(false)}>Cancelar</button></div></form></div>}
  </div>;
}
