import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { jsPDF } from 'jspdf';

const IGV_RATE = 0.18;
const money = (v) => `S/. ${(Number(v) || 0).toFixed(2)}`;
const num = (v) => { const n = Number.parseFloat(v); return Number.isFinite(n) ? n : 0; };
const id = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const REVISION_RECIPIENTS = ['zevallosgonzalo7@gmail.com'];
const registrarAvisoEmail = async (quoteId, codigo, tipo) => {
  const { error } = await supabase.from('cotizacion_notificaciones').upsert([{
    cotizacion_id: quoteId,
    tipo,
    destinatarios: REVISION_RECIPIENTS,
    estado: 'pendiente'
  }], { onConflict: 'cotizacion_id,tipo', ignoreDuplicates: true });

  if (error) {
    console.error(`No se pudo registrar el aviso ${tipo}:`, error);
    return { ok: false, error };
  }

  const { data, error: sendError } = await supabase.functions.invoke('send-quote-review-email', {
    body: { quoteId, codigo, tipo }
  });

  if (sendError || data?.ok === false) {
    console.error(`No se pudo enviar el correo ${tipo}:`, sendError || data?.error);
    return { ok: false, error: sendError || new Error(data?.error || 'No se pudo enviar el correo.') };
  }

  return { ok: true, data };
};

const emptyClient = { nombre: '', ruc: '', tipo_documento: 'RUC', tipo_pago: 'Contado', plazo_dias: 0, estado: true };
const emptyProject = { nombre: '', descripcion: '', estado: 'Activo', client_id: '' };
const newItem = () => ({ id: id(), descripcion: '', cantidad: 1, valor_unitario: '', valor_total: '', costo: '' });

export function Clientes({ onNotify, onAudit, puedeGestionar = true }) {
  const [clientes, setClientes] = useState([]); const [busqueda, setBusqueda] = useState(''); const [form, setForm] = useState(emptyClient); const [editando, setEditando] = useState(null); const [cargando, setCargando] = useState(false);
  const cargar = async () => { const { data, error } = await supabase.from('clientes').select('*').order('nombre'); if (error) { console.error(error); return; } setClientes(data || []); };
  useEffect(() => { cargar(); }, []);
  const filtrados = useMemo(() => { const q = busqueda.trim().toLowerCase(); return !q ? clientes : clientes.filter(c => `${c.nombre} ${c.ruc} ${c.tipo_documento} ${c.tipo_pago} ${c.plazo_dias}`.toLowerCase().includes(q)); }, [clientes, busqueda]);
  const guardar = async e => { e.preventDefault(); if (!puedeGestionar) return; if (!form.nombre.trim() || !form.ruc.trim()) return alert('Completa el nombre y N° de documento.'); if (form.tipo_pago === 'Crédito' && num(form.plazo_dias) <= 0) return alert('Indica un plazo mayor a 0 días para crédito.'); setCargando(true); try { const payload = { nombre: form.nombre.trim(), ruc: form.ruc.trim(), tipo_documento: form.tipo_documento, tipo_pago: form.tipo_pago, plazo_dias: form.tipo_pago === 'Contado' ? 0 : Math.trunc(num(form.plazo_dias)), estado: !!form.estado }; const result = editando ? await supabase.from('clientes').update(payload).eq('id', editando.id) : await supabase.from('clientes').insert([{ ...payload, id: id() }]); if (result.error) throw result.error; onNotify(editando ? `Cliente actualizado: ${payload.nombre}` : `Nuevo cliente registrado: ${payload.nombre}`, editando ? 'edicion' : 'nuevo'); onAudit(editando ? 'Edición' : 'Creación', `${editando ? 'Cliente actualizado' : 'Cliente creado'} · ${payload.nombre}`); setForm(emptyClient); setEditando(null); await cargar(); } catch (err) { console.error(err); alert(`No se pudo guardar el cliente. ${err?.message || ''}`); } finally { setCargando(false); } };
  const editar = c => { if (!puedeGestionar) return; setEditando(c); setForm({ ...emptyClient, ...c }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggle = async c => { if (!puedeGestionar) return; const { error } = await supabase.from('clientes').update({ estado: !c.estado }).eq('id', c.id); if (error) return alert('No se pudo cambiar el estado.'); onAudit('Edición', `${c.nombre} · ${c.estado ? 'Desactivado' : 'Activado'}`); await cargar(); };
  return <div><div className="section-header"><div><h3 className="section-title">👥 Clientes</h3><p className="panel-note">{puedeGestionar ? 'Directorio de clientes reutilizable en proyectos y cotizaciones.' : 'Directorio de clientes en modo solo lectura — no tienes permiso para gestionar clientes.'}</p></div></div><div className="business-grid">{puedeGestionar && <form onSubmit={guardar} className="glass-card form-card"><h4 className="panel-title">{editando ? '✏️ Editar cliente' : '➕ Registrar cliente'}</h4><div className="form-row"><label>Cliente / Razón Social *</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required /></div><div className="form-grid-2"><div className="form-row"><label>Tipo documento *</label><select value={form.tipo_documento} onChange={e => setForm({ ...form, tipo_documento: e.target.value })}><option>RUC</option><option>DNI</option></select></div><div className="form-row"><label>N° DOC *</label><input value={form.ruc} onChange={e => setForm({ ...form, ruc: e.target.value })} inputMode="numeric" required /></div></div><div className="form-grid-2"><div className="form-row"><label>Tipo de pago *</label><select value={form.tipo_pago} onChange={e => setForm({ ...form, tipo_pago: e.target.value, plazo_dias: e.target.value === 'Contado' ? 0 : form.plazo_dias })}><option>Contado</option><option>Crédito</option></select></div><div className="form-row"><label>Plazo (días) *</label><input type="number" min="0" step="1" value={form.plazo_dias} disabled={form.tipo_pago === 'Contado'} onChange={e => setForm({ ...form, plazo_dias: e.target.value })} /></div></div><label className="checkbox-label"><input type="checkbox" checked={!!form.estado} onChange={e => setForm({ ...form, estado: e.target.checked })} /> Cliente activo</label><div className="modal-actions"><button className="btn-primary" disabled={cargando}>{cargando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar cliente'}</button>{editando && <button type="button" className="btn-secondary" onClick={() => { setEditando(null); setForm(emptyClient); }}>Cancelar</button>}</div></form>}<div className="glass-card form-card"><div className="section-header"><h4 className="panel-title">📋 Clientes ({filtrados.length})</h4><input className="search-input business-search" placeholder="Buscar cliente o documento..." value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>{filtrados.length === 0 ? <p className="empty-hint">No hay clientes registrados.</p> : <div className="record-list">{filtrados.map(c => <div className="glass-card record-card business-record" key={c.id}><div><div className="record-tags-row"><span className={`code-tag ${c.estado ? 'tag-paid' : 'tag-pending'}`}>{c.estado ? 'Activo' : 'Inactivo'}</span><span className="record-date">{c.codigo}</span><span className="record-date">{c.tipo_documento} {c.ruc}</span></div><h4 className="record-title">{c.nombre}</h4><p className="record-meta">{c.tipo_pago}{c.tipo_pago === 'Crédito' ? ` · ${c.plazo_dias} días` : ''}</p></div>{puedeGestionar && <div className="record-actions"><button className="btn-muted" onClick={() => editar(c)}>Editar</button><button className={c.estado ? 'btn-delete' : 'btn-approve'} onClick={() => toggle(c)}>{c.estado ? 'Desactivar' : 'Activar'}</button></div>}</div>)}</div>}</div></div></div>;
}

export function Proyectos({ onNotify, onAudit, puedeGestionar = true }) {
  const [clientes, setClientes] = useState([]); const [proyectos, setProyectos] = useState([]); const [form, setForm] = useState(emptyProject); const [editando, setEditando] = useState(null); const [busqueda, setBusqueda] = useState(''); const [cargando, setCargando] = useState(false);
  const cargar = async () => { const [{ data: c, error: ce }, { data: p, error: pe }] = await Promise.all([supabase.from('clientes').select('id,nombre,estado').order('nombre'), supabase.from('proyectos').select('*, clientes(nombre)').order('nombre')]); if (ce || pe) { console.error(ce || pe); return; } setClientes(c || []); setProyectos(p || []); };
  useEffect(() => { cargar(); }, []);
  const filtrados = proyectos.filter(p => `${p.nombre} ${p.descripcion || ''} ${p.clientes?.nombre || ''}`.toLowerCase().includes(busqueda.toLowerCase()));
  const guardar = async e => { e.preventDefault(); if (!puedeGestionar) return; if (!form.nombre.trim() || !form.client_id) return; setCargando(true); try { const payload = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, estado: form.estado, client_id: form.client_id }; const result = editando ? await supabase.from('proyectos').update(payload).eq('id', editando.id) : await supabase.from('proyectos').insert([{ ...payload, id: id() }]); if (result.error) throw result.error; onNotify(editando ? `Proyecto actualizado: ${payload.nombre}` : `Nuevo proyecto registrado: ${payload.nombre}`, editando ? 'edicion' : 'nuevo'); onAudit(editando ? 'Edición' : 'Creación', `${editando ? 'Proyecto actualizado' : 'Proyecto creado'} · ${payload.nombre}`); setForm(emptyProject); setEditando(null); await cargar(); } catch (err) { console.error(err); alert(`No se pudo guardar el proyecto. ${err?.message || ''}`); } finally { setCargando(false); } };
  return <div><div className="section-header"><div><h3 className="section-title">📁 Proyectos</h3><p className="panel-note">{puedeGestionar ? 'Cada proyecto pertenece a un cliente. En Cotizaciones, asociarlo es opcional.' : 'Vista de proyectos en modo solo lectura — no tienes permiso para gestionar proyectos.'}</p></div></div><div className="business-grid">{puedeGestionar && <form onSubmit={guardar} className="glass-card form-card"><h4 className="panel-title">{editando ? '✏️ Editar proyecto' : '➕ Registrar proyecto'}</h4><div className="form-row"><label>Cliente *</label><select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} required><option value="">Selecciona un cliente...</option>{clientes.filter(c => c.estado).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div><div className="form-row"><label>Nombre del proyecto *</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required /></div><div className="form-row"><label>Descripción</label><textarea rows="3" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></div><div className="form-row"><label>Estado</label><select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}><option>Activo</option><option>En pausa</option><option>Finalizado</option></select></div><div className="modal-actions"><button className="btn-primary" disabled={cargando}>{cargando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar proyecto'}</button>{editando && <button type="button" className="btn-secondary" onClick={() => { setEditando(null); setForm(emptyProject); }}>Cancelar</button>}</div></form>}<div className="glass-card form-card"><div className="section-header"><h4 className="panel-title">📋 Proyectos ({filtrados.length})</h4><input className="search-input business-search" placeholder="Buscar proyecto o cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>{filtrados.length === 0 ? <p className="empty-hint">No hay proyectos registrados.</p> : <div className="record-list">{filtrados.map(p => <div className="glass-card record-card business-record" key={p.id}><div><div className="record-tags-row"><span className="code-tag tag-paid">{p.codigo}</span><span className="code-tag tag-paid">{p.estado}</span></div><h4 className="record-title">{p.nombre}</h4><p className="record-meta">Cliente: <strong>{p.clientes?.nombre || 'Sin cliente'}</strong></p>{p.descripcion && <p className="record-note">{p.descripcion}</p>}</div>{puedeGestionar && <div className="record-actions"><button className="btn-muted" onClick={() => { setEditando(p); setForm({ nombre: p.nombre, descripcion: p.descripcion || '', estado: p.estado, client_id: p.client_id }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar</button></div>}</div>)}</div>}</div></div></div>;
}

export function Cotizaciones({ usuario, onNotify, onAudit, puedeAprobar = true }) {
  const [clientes, setClientes] = useState([]); const [proyectos, setProyectos] = useState([]); const [cotizaciones, setCotizaciones] = useState([]); const [vista, setVista] = useState('lista'); const [filtro, setFiltro] = useState('todas'); const [busqueda, setBusqueda] = useState(''); const [editando, setEditando] = useState(null); const [form, setForm] = useState({ client_id: '', proyecto_nombre: '', project_id: '', descripcion: '', aplicar_igv: true, descuento: 0, modo: 'detallado', items: [newItem()] }); const [cargando, setCargando] = useState(false); const [nuevoCliente, setNuevoCliente] = useState(false); const [itemsEditando, setItemsEditando] = useState(() => new Set()); const [itemsColapsados, setItemsColapsados] = useState(() => new Set()); const [valorVentaDirecto, setValorVentaDirecto] = useState(0); const [clienteRapido, setClienteRapido] = useState(emptyClient); const [menuAbierto, setMenuAbierto] = useState(null); const [detalleAbierto, setDetalleAbierto] = useState(null); const [detalleItems, setDetalleItems] = useState({});
  const cargarDatos = async () => {
    const { data: c, error: ce } = await supabase.from('clientes').select('*').eq('estado', true).order('nombre');
    if (ce) { console.error('Error cargando clientes:', ce); setClientes([]); } else { setClientes(c || []); }

    const { data: p, error: pe } = await supabase.from('proyectos').select('*, clientes(nombre)').order('nombre');
    if (pe) { console.error('Error cargando proyectos:', pe); setProyectos([]); } else { setProyectos(p || []); }

    const { data: q, error: qe } = await supabase.from('cotizaciones').select('*, clientes(nombre), proyectos(nombre)').order('created_at', { ascending: false });
    if (qe) { console.error('Error cargando cotizaciones:', qe); setCotizaciones([]); } else { setCotizaciones(q || []); }
  };
  useEffect(() => { cargarDatos(); }, []);
  const proyectosDisponibles = form.client_id ? proyectos.filter(p => p.client_id === form.client_id && p.estado !== 'Finalizado') : [];
  const itemTotal = item => num(item.cantidad) * num(item.valor_unitario);
  const subtotalItems = form.items.reduce((s, i) => s + itemTotal(i), 0); const subtotal = form.modo === 'directo' ? num(valorVentaDirecto) : subtotalItems; const descuento = 0; const base = subtotal; const igv = base * IGV_RATE; const total = base + igv; const costo = form.items.reduce((s, i) => s + (num(i.costo_unitario ?? i.costo) * num(i.cantidad)), 0); const ganancia = base - costo; const margen = base > 0 ? (ganancia / base) * 100 : 0;
  const reset = () => { setForm({ client_id: '', proyecto_nombre: '', project_id: '', descripcion: '', aplicar_igv: true, descuento: 0, modo: 'detallado', items: [newItem()] }); setValorVentaDirecto(0); setEditando(null); setItemsEditando(new Set()); setItemsColapsados(new Set()); setVista('lista'); };
  const nuevaCotizacion = () => { const item = newItem(); setEditando(null); setForm({ client_id: '', proyecto_nombre: '', project_id: '', descripcion: '', aplicar_igv: true, descuento: 0, modo: 'detallado', items: [item] }); setValorVentaDirecto(0); setItemsEditando(new Set([item.id])); setItemsColapsados(new Set()); setNuevoCliente(false); setVista('form'); };
  const updateItem = (itemId, changes) => setForm(prev => ({ ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, ...changes } : i) }));
  const addItem = () => { const item = newItem(); setForm(prev => ({ ...prev, items: [...prev.items, item] })); setItemsEditando(prev => new Set([...prev, item.id])); setItemsColapsados(prev => { const next = new Set(prev); next.delete(item.id); return next; }); };
  const guardarItem = itemId => { setItemsEditando(prev => { const next = new Set(prev); next.delete(itemId); return next; }); setItemsColapsados(prev => new Set([...prev, itemId])); };
  const editarItem = itemId => { setItemsEditando(prev => new Set([...prev, itemId])); setItemsColapsados(prev => { const next = new Set(prev); next.delete(itemId); return next; }); };
  const nuevoItemInicial = () => { const item = newItem(); setForm(prev => ({ ...prev, items: [item] })); setItemsEditando(new Set([item.id])); setItemsColapsados(new Set()); };
  const removeItem = itemId => {
    setForm(prev => {
      if (prev.items.length === 1) {
        const item = newItem();
        setItemsEditando(new Set([item.id]));
        setItemsColapsados(new Set());
        return { ...prev, items: [item] };
      }
      return { ...prev, items: prev.items.filter(i => i.id !== itemId) };
    });
    setItemsEditando(prev => { const next = new Set(prev); next.delete(itemId); return next; });
    setItemsColapsados(prev => { const next = new Set(prev); next.delete(itemId); return next; });
  };
  const cambiarModo = modo => { if (modo === 'directo') setValorVentaDirecto(subtotalItems); setForm(prev => ({ ...prev, modo })); };
  const guardar = async (estado = 'Borrador') => { if (estado === 'Aprobado' && !puedeAprobar) return alert('No tienes permiso para aprobar cotizaciones.'); if (!form.client_id) return alert('Selecciona un cliente.'); if (!form.proyecto_nombre.trim()) return alert('Escribe el nombre del proyecto. La cotización no puede guardarse sin proyecto.'); if (!form.items.some(i => i.descripcion.trim() && itemTotal(i) > 0)) return alert('Agrega al menos un ítem con descripción y valor.'); setCargando(true); try { const codigo = editando?.codigo || `COT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`; const payload = { client_id: form.client_id, project_id: editando?.project_id || null, proyecto_nombre: form.proyecto_nombre.trim(), codigo, descripcion: form.descripcion.trim() || null, estado, aplicar_igv: true, igv_rate: IGV_RATE, subtotal, descuento: 0, igv, total, costo_estimado: costo, ganancia_estimada: ganancia, margen, updated_by: usuario }; let quoteId = editando?.id; let error; if (editando) { ({ error } = await supabase.from('cotizaciones').update(payload).eq('id', editando.id)); if (!error) { const del = await supabase.from('cotizacion_items').delete().eq('quote_id', editando.id); if (del.error) throw del.error; } } else { quoteId = id(); ({ error } = await supabase.from('cotizaciones').insert([{ ...payload, id: quoteId, created_by: usuario }])); } if (error) throw error; const itemsPayload = form.items.filter(i => i.descripcion.trim()).map((i, index) => ({ id: id(), quote_id: quoteId, orden: index + 1, descripcion: i.descripcion.trim(), modo: form.modo, cantidad: num(i.cantidad), valor_unitario: num(i.valor_unitario), valor_total: itemTotal(i), costo: num(i.costo_unitario ?? i.costo) * num(i.cantidad), margen: itemTotal(i) > 0 ? ((itemTotal(i) - (num(i.costo_unitario ?? i.costo) * num(i.cantidad))) / itemTotal(i)) * 100 : 0 })); const itemsResult = await supabase.from('cotizacion_items').insert(itemsPayload); if (itemsResult.error) throw itemsResult.error;
      if (estado === 'Aprobado') {
        const { error: approvalError } = await supabase.rpc('aprobar_cotizacion', { p_cotizacion_id: quoteId, p_usuario: usuario });
        if (approvalError) throw approvalError;
        await registrarAvisoEmail(quoteId, codigo, 'aprobada');
        onNotify(`${editando ? 'Cotización actualizada y aprobada' : 'Nueva cotización aprobada'}: ${codigo} · Proyecto creado`, 'aprobacion');
        onAudit('Aprobación', `${codigo} · Proyecto creado automáticamente · ${form.proyecto_nombre.trim()}`);
      } else {
        onNotify(`${editando ? 'Cotización actualizada' : 'Nueva cotización'}: ${codigo}`, estado === 'En Revisión' ? 'pendiente' : 'nuevo');
        if (estado === 'En Revisión') await registrarAvisoEmail(quoteId, codigo, 'en_revision');
        onAudit(editando ? 'Edición' : 'Creación', `${codigo} · Estado: ${estado}`);
      }
      await cargarDatos(); reset(); } catch (err) { console.error(err); alert(`No se pudo guardar la cotización. ${err?.message || 'Verifica las tablas y políticas de Supabase.'}`); } finally { setCargando(false); } };
  const editar = async q => { const { data: items, error } = await supabase.from('cotizacion_items').select('*').eq('quote_id', q.id).order('orden'); if (error) return alert('No se pudieron cargar los ítems.'); const modo = items?.[0]?.modo || 'detallado'; setEditando(q); setItemsEditando(new Set((items || []).map(i => i.id))); setItemsColapsados(new Set()); setValorVentaDirecto(num(q.subtotal)); setForm({ client_id: q.client_id, proyecto_nombre: q.proyecto_nombre || q.proyectos?.nombre || '', project_id: q.project_id || '', descripcion: q.descripcion || '', aplicar_igv: true, descuento: 0, modo, items: (items || []).map(i => ({ id: i.id || id(), descripcion: i.descripcion || '', cantidad: i.cantidad ?? 1, valor_unitario: i.valor_unitario ?? '', valor_total: i.valor_total ?? '', costo: i.costo ?? '', costo_unitario: i.costo_unitario ?? (num(i.cantidad) > 0 ? num(i.costo) / num(i.cantidad) : 0) })) .concat((items || []).length ? [] : [newItem()]) }); setVista('form'); };
  const cambiarEstado = async (q, estado) => {
    if (estado === 'Aprobado' && !puedeAprobar) { alert('No tienes permiso para aprobar cotizaciones.'); return; }
    setMenuAbierto(null); setCargando(true);
    try {
      if (estado === 'Aprobado') {
        const { error } = await supabase.rpc('aprobar_cotizacion', { p_cotizacion_id: q.id, p_usuario: usuario });
        if (error) throw error;
        await registrarAvisoEmail(q.id, q.codigo, 'aprobada');
        onNotify(`${q.codigo} aprobada · Proyecto creado`, 'aprobacion');
        onAudit('Aprobación', `${q.codigo} · Proyecto creado automáticamente · ${(q.proyecto_nombre || q.proyectos?.nombre || '').trim()}`);
      } else {
        const { error } = await supabase.from('cotizaciones').update({ estado, updated_by: usuario }).eq('id', q.id);
        if (error) throw error;
        onNotify(`${q.codigo} → ${estado}`, 'pendiente');
        if (estado === 'En Revisión') await registrarAvisoEmail(q.id, q.codigo, 'en_revision');
        onAudit('Edición', `${q.codigo} · Estado cambiado a ${estado}`);
      }
      await cargarDatos();
    } catch (error) { console.error(error); alert(`No se pudo actualizar la cotización. ${error?.message || ''}`); }
    finally { setCargando(false); }
  };
  const eliminarCotizacion = async q => { setMenuAbierto(null); const ok = window.confirm(`¿Eliminar la cotización ${q.codigo}?\n\nSe eliminarán también todos sus ítems. Esta acción no se puede deshacer.`); if (!ok) return; setCargando(true); try { const { error } = await supabase.from('cotizaciones').delete().eq('id', q.id); if (error) throw error; setDetalleItems(prev => { const next = { ...prev }; delete next[q.id]; return next; }); if (detalleAbierto === q.id) setDetalleAbierto(null); onNotify(`Cotización eliminada: ${q.codigo}`, 'edicion'); onAudit('Eliminación', `${q.codigo} · Cotización eliminada`); await cargarDatos(); } catch (err) { console.error(err); alert(`No se pudo eliminar la cotización. ${err?.message || ''}`); } finally { setCargando(false); } };
  const toggleDetalle = async q => { setMenuAbierto(null); if (detalleAbierto === q.id) { setDetalleAbierto(null); return; } setDetalleAbierto(q.id); if (!detalleItems[q.id]) { const { data, error } = await supabase.from('cotizacion_items').select('*').eq('quote_id', q.id).order('orden'); if (error) return alert(`No se pudieron cargar los detalles. ${error.message}`); setDetalleItems(prev => ({ ...prev, [q.id]: data || [] })); } };
  const descargarPDF = async (q) => {
    try {
      const { data: items, error } = await supabase
        .from('cotizacion_items')
        .select('*')
        .eq('quote_id', q.id)
        .order('orden');
      if (error) throw error;
      const modoCotizacion = String(items?.[0]?.modo || q.modo || 'detallado').toLowerCase().trim();

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = 210;
      const H = 297;
      const margin = 15;
      const contentW = W - margin * 2;
      const petrol = [34, 66, 72];
      const dark = [42, 54, 58];
      const muted = [105, 116, 120];
      const soft = [242, 246, 246];
      const border = [218, 225, 226];

      const logoToDataUrl = async () => {
        try {
          const r = await fetch('/festoslogo-Photoroom.png');
          const b = await r.blob();
          return await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = reject;
            fr.readAsDataURL(b);
          });
        } catch {
          return null;
        }
      };

      const logo = await logoToDataUrl();
      const drawHeader = (firstPage = false) => {
        if (firstPage) {
          doc.setFillColor(...petrol);
          doc.rect(0, 0, W, 38, 'F');
          if (logo) {
            try { doc.addImage(logo, 'PNG', margin, 6, 49, 25, 'FESTOSLOGO'); } catch {}
          }
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(20);
          doc.text('COTIZACIÓN', W - margin, 14, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.text(q.codigo || '', W - margin, 21, { align: 'right' });
          doc.text(q.estado || '', W - margin, 28, { align: 'right' });
          return 47;
        }
        doc.setFillColor(...petrol);
        doc.rect(0, 0, W, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(`${q.codigo || 'COTIZACIÓN'} · DETALLE`, margin, 6.5);
        return 20;
      };

      let y = drawHeader(true);

      // Datos comerciales
      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('CLIENTE', margin, y);
      doc.text('PROYECTO', 112, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(q.clientes?.nombre || '—', margin, y);
      doc.text(q.proyecto_nombre || q.proyectos?.nombre || '—', 112, y);
      y += 5;
      doc.setTextColor(...muted);
      doc.setFontSize(8.5);
      doc.text(`RUC: ${q.clientes?.ruc || '—'}`, margin, y);
      const pago = q.clientes?.tipo_pago || '';
      const plazo = num(q.clientes?.plazo_dias);
      if (pago) doc.text(`Condición: ${pago}${pago === 'Crédito' ? ` · ${plazo} días` : ''}`, 112, y);

      y += 9;
      doc.setDrawColor(...border);
      doc.line(margin, y, W - margin, y);
      y += 8;

      // Encabezado de tabla moderno y columnas perfectamente alineadas.
      doc.setTextColor(...petrol);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('DETALLE DE LA PROPUESTA', margin, y);
      y += 6;

      const col = {
        desc: margin,
        qty: 137,
        unit: 166,
        total: W - margin
      };
      const tableRight = W - margin;
      const headerH = 9;
      doc.setFillColor(...soft);
      doc.roundedRect(margin, y - 5, contentW, headerH, 2, 2, 'F');
      doc.setTextColor(...muted);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.7);
      doc.text('DESCRIPCIÓN', col.desc + 3, y + 0.5);
      doc.text('CANT.', col.qty, y + 0.5, { align: 'right' });
      doc.text('VALOR UNIT.', col.unit, y + 0.5, { align: 'right' });
      doc.text('TOTAL', col.total - 3, y + 0.5, { align: 'right' });
      y += 9;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.7);
      (items || []).forEach((it, idx) => {
        const desc = String(it.descripcion || '—');
        const lines = doc.splitTextToSize(desc, 103);
        const rowH = Math.max(9, lines.length * 4.2 + 4);
        if (y + rowH > 264) {
          doc.addPage();
          y = drawHeader(false);
          doc.setTextColor(...muted);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.7);
          doc.text('DESCRIPCIÓN', col.desc + 3, y + 0.5);
          doc.text('CANT.', col.qty, y + 0.5, { align: 'right' });
          doc.text('VALOR UNIT.', col.unit, y + 0.5, { align: 'right' });
          doc.text('TOTAL', col.total - 3, y + 0.5, { align: 'right' });
          y += 9;
        }
        if (idx % 2 === 0) {
          doc.setFillColor(249, 251, 251);
          doc.rect(margin, y - 5, contentW, rowH, 'F');
        }
        doc.setTextColor(...dark);
        doc.setFont('helvetica', 'normal');
        doc.text(lines, col.desc + 3, y);
        doc.text(String(num(it.cantidad)), col.qty, y, { align: 'right' });
        doc.text(modoCotizacion === 'directo' ? '--' : money(num(it.valor_unitario)), col.unit, y, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text(modoCotizacion === 'directo' ? '--' : money(num(it.valor_total)), col.total - 3, y, { align: 'right' });
        doc.setDrawColor(232, 237, 238);
        doc.line(margin, y + rowH - 3, tableRight, y + rowH - 3);
        y += rowH;
      });

      // Resumen visible para el cliente: nunca incluir costos, utilidad ni margen.
      y += 7;
      const summaryX = 119;
      const summaryW = W - margin - summaryX;
      const summaryRows = [
        ['Valor de venta', money(q.subtotal)],
        ['IGV (18%)', money(q.igv)],
      ];
      summaryRows.forEach(([label, value]) => {
        doc.setTextColor(...muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(label, summaryX + 2, y);
        doc.setTextColor(...dark);
        doc.text(value, W - margin - 3, y, { align: 'right' });
        y += 7;
      });

      doc.setFillColor(...petrol);
      doc.roundedRect(summaryX, y - 5, summaryW, 11, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('PRECIO TOTAL', summaryX + 4, y + 2);
      doc.text(money(q.total), W - margin - 4, y + 2, { align: 'right' });
      y += 19;

      if (q.descripcion) {
        if (y > 250) {
          doc.addPage();
          y = drawHeader(false);
        }
        doc.setTextColor(...petrol);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('ALCANCE / NOTAS', margin, y);
        y += 5;
        doc.setTextColor(...muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const noteLines = doc.splitTextToSize(q.descripcion, contentW);
        doc.text(noteLines, margin, y);
      }

      // Pie de página en todas las páginas.
      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(...border);
        doc.line(margin, H - 14, W - margin, H - 14);
        doc.setTextColor(...muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('Documento generado desde Control Festos', margin, H - 8);
        doc.text(`Página ${page} de ${totalPages}`, W / 2, H - 8, { align: 'center' });
        doc.text(new Date().toLocaleDateString('es-PE'), W - margin, H - 8, { align: 'right' });
      }

      doc.save(`${q.codigo || 'cotizacion'}-Festos.pdf`);
      onNotify(`PDF generado: ${q.codigo}`, 'nuevo');
      onAudit('Exportación', `${q.codigo} · PDF descargado`);
    } catch (error) {
      console.error(error);
      alert(`No se pudo generar el PDF. ${error?.message || ''}`);
    }
  };
  const guardarClienteRapido = async e => { e.preventDefault(); if (!clienteRapido.nombre.trim() || !clienteRapido.ruc.trim()) return; const payload = { ...clienteRapido, nombre: clienteRapido.nombre.trim(), ruc: clienteRapido.ruc.trim(), plazo_dias: clienteRapido.tipo_pago === 'Contado' ? 0 : Math.trunc(num(clienteRapido.plazo_dias)), id: id() }; const { error } = await supabase.from('clientes').insert([payload]); if (error) return alert(`No se pudo registrar el cliente. ${error.message}`); onNotify(`Nuevo cliente registrado: ${payload.nombre}`, 'nuevo'); onAudit('Creación', `Cliente creado desde Cotizaciones · ${payload.nombre}`); setNuevoCliente(false); setClienteRapido(emptyClient); await cargarDatos(); setForm(prev => ({ ...prev, client_id: payload.id })); };
  const filtradas = cotizaciones.filter(q => { if (filtro !== 'todas' && q.estado !== filtro) return false; const text = `${q.codigo} ${q.clientes?.nombre || ''} ${q.proyectos?.nombre || ''} ${q.descripcion || ''}`.toLowerCase(); return !busqueda.trim() || text.includes(busqueda.toLowerCase()); });
  const badge = estado => estado === 'Aprobado' ? 'tag-paid' : estado === 'En Revisión' ? 'tag-approval' : 'tag-pending';
  if (vista === 'form') return <div><div className="section-header"><div><h3 className="section-title">{editando ? '✏️ Editar Cotización' : '📑 Nueva Cotización'}</h3><p className="panel-note">Cliente, proyecto obligatorio, ítems y control de rentabilidad.</p></div><button className="btn-secondary" onClick={reset}>← Volver</button></div><div className="glass-card form-card"><div className="form-grid-2"><div className="form-row"><label>Cliente *</label><div className="select-with-action"><select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value, project_id: '' })} required><option value="">Selecciona un cliente...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} · {c.ruc}</option>)}</select><button type="button" className="btn-muted" onClick={() => setNuevoCliente(v => !v)}>+ Cliente</button></div></div><div className="form-row"><label>Proyecto</label><div className="select-with-action"><select value={form.project_id} disabled={!form.usar_proyecto || !form.client_id} onChange={e => setForm({ ...form, project_id: e.target.value })}><option value="">{form.usar_proyecto ? (form.client_id ? 'Selecciona un proyecto...' : 'Primero selecciona cliente') : 'Proyecto no asociado'}</option>{proyectosDisponibles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div></div></div>{nuevoCliente && <form onSubmit={guardarClienteRapido} className="quick-client-card"><div className="quick-client-head"><strong>Registrar cliente sin salir de Cotizaciones</strong><button type="button" className="btn-muted" onClick={() => setNuevoCliente(false)}>Cerrar</button></div><div className="form-grid-2"><div className="form-row"><label>Razón social *</label><input value={clienteRapido.nombre} onChange={e => setClienteRapido({ ...clienteRapido, nombre: e.target.value })} required /></div><div className="form-row"><label>N° DOC *</label><input value={clienteRapido.ruc} onChange={e => setClienteRapido({ ...clienteRapido, ruc: e.target.value })} required /></div></div><div className="form-grid-2"><div className="form-row"><label>Tipo documento</label><select value={clienteRapido.tipo_documento} onChange={e => setClienteRapido({ ...clienteRapido, tipo_documento: e.target.value })}><option>RUC</option><option>DNI</option></select></div><div className="form-row"><label>Tipo de pago</label><select value={clienteRapido.tipo_pago} onChange={e => setClienteRapido({ ...clienteRapido, tipo_pago: e.target.value })}><option>Contado</option><option>Crédito</option></select></div></div><div className="form-row quick-client-plazo"><label>Plazo (días)</label><input type="number" min="0" value={clienteRapido.plazo_dias} disabled={clienteRapido.tipo_pago === 'Contado'} onChange={e => setClienteRapido({ ...clienteRapido, plazo_dias: e.target.value })} /></div><button className="btn-primary btn-small">Registrar y seleccionar cliente</button></form>}<div className="form-row quote-project-required"><label>Proyecto *</label><input value={form.proyecto_nombre} onChange={e => setForm({ ...form, proyecto_nombre: e.target.value })} required placeholder="Escribe el nombre del proyecto..." /><small>El proyecto se creará automáticamente en Proyectos cuando la cotización sea aprobada.</small></div><div className="form-row"><label>Descripción / alcance</label><textarea rows="3" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Alcance, condiciones o notas de la cotización..." /></div><div className="quote-items-head"><div><h4 className="panel-title" style={{ margin: 0 }}>🧾 Ítems</h4><span className="panel-note">El modo Detallado / Directo se aplica a toda la cotización.</span></div><button type="button" className="btn-primary" onClick={addItem}>+ Agregar Ítem</button></div><div className="quote-items-list">{form.items.map((item, index) => {
  const qty = num(item.cantidad);
  const costoUnitario = num(item.costo_unitario ?? item.costo);
  const valorUnitario = form.modo === 'detallado' ? num(item.valor_unitario) : (qty > 0 ? num(item.valor_total) / qty : 0);
  const valorTotal = itemTotal(item);
  const costoTotal = costoUnitario * qty;
  const margenBrutoItem = valorTotal - costoTotal;
  const margenPctItem = valorTotal > 0 ? (margenBrutoItem / valorTotal) * 100 : 0;
  return <div className="quote-item quote-item-pro" key={item.id}>
    <div className="quote-item-top quote-item-pro-head">
      <div className="quote-item-number"><span>{String(index + 1).padStart(2, '0')}</span><div><strong>Ítem {index + 1}</strong><small>{itemsColapsados.has(item.id) ? `${item.descripcion || 'Sin descripción'} · ${money(valorTotal)}` : 'Detalle de valorización'}</small></div></div>
      <div className="quote-item-actions">
        <button type="button" className="btn-primary btn-small" onClick={() => guardarItem(item.id)} disabled={!itemsEditando.has(item.id)}>Guardar</button>
        <button type="button" className="btn-muted btn-small" onClick={() => editarItem(item.id)} disabled={itemsEditando.has(item.id)}>Editar</button>
        <button type="button" className="btn-delete btn-small" onClick={() => removeItem(item.id)}>Eliminar</button>
      </div>
    </div>
    {!itemsColapsados.has(item.id) && <><div className="quote-item-grid quote-item-pro-grid">
      <div className="form-row quote-item-description"><label>Descripción *</label><input disabled={!itemsEditando.has(item.id)} value={item.descripcion} onChange={e => updateItem(item.id, { descripcion: e.target.value })} placeholder="Ej. Servicio de automatización" /></div>
      <div className="form-row quote-qty-field"><label>Cantidad</label><input disabled={!itemsEditando.has(item.id)} type="number" min="0" step="0.01" value={item.cantidad} onChange={e => updateItem(item.id, { cantidad: e.target.value })} /></div>
      <div className="form-row quote-cost-field"><label>Costo unitario</label><input disabled={!itemsEditando.has(item.id)} type="number" min="0" step="0.01" value={item.costo_unitario ?? item.costo ?? ''} onChange={e => updateItem(item.id, { costo_unitario: e.target.value })} /></div>
      <div className="form-row quote-value-field"><label>Valor unitario</label><input disabled={!itemsEditando.has(item.id)} type="number" min="0" step="0.01" value={item.valor_unitario} onChange={e => updateItem(item.id, { valor_unitario: e.target.value })} /></div>
    </div>
    <div className="quote-item-totals-pro quote-item-results-pro">
      <div><span>Subtotal</span><strong>{money(valorTotal)}</strong><small>Valor unitario × Cantidad</small></div>
      <div className="quote-item-margin-result"><span>Margen bruto</span><strong>{money(margenBrutoItem)}</strong><small>Valor total − costo</small></div>
      <div className={`quote-item-margin-result quote-item-margin-percent ${margenPctItem < 0 ? 'negative' : ''}`}><span>% Margen</span><strong>{margenPctItem.toFixed(0)}%</strong><small>Margen bruto ÷ Valor total</small></div>
    </div></>}
  </div>;
})}</div><div className="quote-mode-global"><div><strong>Modo de valorización de la cotización</strong><span>En Directo puedes ajustar el valor de venta total sin modificar los datos de los ítems.</span></div><div className="quote-mode-switch"><button type="button" className={form.modo === 'detallado' ? 'active' : ''} onClick={() => cambiarModo('detallado')}>Detallado</button><button type="button" className={form.modo === 'directo' ? 'active' : ''} onClick={() => cambiarModo('directo')}>Directo</button></div></div><div className="quote-summary"><div><span>Valor venta total</span>{form.modo === 'directo' ? <input className="quote-direct-value" type="number" min="0" step="0.01" value={valorVentaDirecto} onChange={e => setValorVentaDirecto(e.target.value)} /> : <strong>{money(subtotal)}</strong>}</div><div><span>IGV</span><strong>{money(igv)}</strong></div><div><span>Precio total</span><strong>{money(total)}</strong></div><div><span>Costo total</span><strong>{money(costo)}</strong></div><div><span>Utilidad</span><strong>{money(ganancia)}</strong></div><div><span>Margen global</span><strong>{margen.toFixed(2)}%</strong></div></div><div className="modal-actions quote-actions"><button className="btn-secondary" onClick={() => guardar('Borrador')} disabled={cargando}>Guardar borrador</button><button className="btn-muted" onClick={() => guardar('En Revisión')} disabled={cargando}>Enviar a revisión</button>{puedeAprobar && <button className="btn-primary" onClick={() => guardar('Aprobado')} disabled={cargando}>Aprobar cotización</button>}</div></div></div>;
  return <div onClick={() => menuAbierto && setMenuAbierto(null)}><div className="section-header"><div><h3 className="section-title">📑 Cotizaciones</h3><p className="panel-note">Propuestas comerciales, seguimiento de estados y rentabilidad en un solo lugar.</p></div><button className="btn-primary" onClick={nuevaCotizacion}>+ Nueva Cotización</button></div><div className="glass-card form-card quote-list-shell"><div className="quote-filter-bar"><input className="search-input" placeholder="Buscar por código, cliente, proyecto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} /><div className="quote-filters">{[['todas','Todas'],['Aprobado','Aprobadas'],['En Revisión','En Revisión'],['Borrador','Borradores']].map(([v,l]) => <button key={v} type="button" className={filtro === v ? 'active' : ''} onClick={() => setFiltro(v)}>{l}</button>)}</div></div>{filtradas.length === 0 ? <p className="empty-hint">No hay cotizaciones con los filtros actuales.</p> : <div className="quote-record-list">{filtradas.map(q => { const items = detalleItems[q.id] || []; const abierto = detalleAbierto === q.id; return <article className={`quote-record-pro ${abierto ? 'is-open' : ''}`} key={q.id}><div className="quote-record-main"><div className="quote-record-identity"><span className={`quote-status-dot ${badge(q.estado)}`} /> <div><div className="quote-record-code">{q.codigo}</div><h4>{q.clientes?.nombre || 'Cliente sin nombre'}</h4><div className="quote-record-subline"><span>{`Proyecto · ${q.proyecto_nombre || q.proyectos?.nombre || 'Sin nombre'}`}</span><span>•</span><span>{q.modo === 'directo' ? 'Valoración directa' : 'Valorización detallada'}</span></div></div></div><div className="quote-record-finance"><span>Precio total</span><strong>{money(q.total)}</strong><small>Margen {num(q.margen).toFixed(1)}%</small></div><div className="quote-record-status"><span className={`code-tag ${badge(q.estado)}`}>{q.estado}</span></div><div className="quote-record-menu-wrap"><button type="button" className="quote-more-btn" aria-label="Opciones de cotización" onClick={e => { e.stopPropagation(); setMenuAbierto(menuAbierto === q.id ? null : q.id); }}>⋮</button>{menuAbierto === q.id && <div className="quote-action-menu" onClick={e => e.stopPropagation()}><button onClick={() => toggleDetalle(q)}>⌄ <span>{abierto ? 'Ocultar detalle' : 'Ver detalle'}</span></button><button onClick={() => { setMenuAbierto(null); editar(q); }}>✏️ <span>Editar cotización</span></button>{q.estado === 'Borrador' && <button onClick={() => cambiarEstado(q, 'En Revisión')}>◷ <span>Enviar a revisión</span></button>}{puedeAprobar && q.estado !== 'Aprobado' && <button onClick={() => cambiarEstado(q, 'Aprobado')}>✓ <span>Aprobar cotización</span></button>}<button onClick={() => { setMenuAbierto(null); descargarPDF(q); }}>📄 <span>Descargar PDF</span></button><div className="quote-menu-separator" /><button className="danger" onClick={() => eliminarCotizacion(q)}>🗑 <span>Eliminar cotización</span></button></div>}</div></div><button type="button" className="quote-expand-bar" onClick={() => toggleDetalle(q)}><span>{abierto ? 'Ocultar detalle' : 'Ver detalle completo'}</span><span className={`quote-expand-chevron ${abierto ? 'open' : ''}`}>⌄</span></button>{abierto && <div className="quote-record-detail"><div className="quote-detail-grid"><div><span>Cliente</span><strong>{q.clientes?.nombre || '—'}</strong></div><div><span>Proyecto</span><strong>{q.proyecto_nombre || q.proyectos?.nombre || '—'}</strong></div><div><span>Valor venta</span><strong>{money(q.subtotal)}</strong></div><div><span>IGV 18%</span><strong>{money(q.igv)}</strong></div><div><span>Precio total</span><strong>{money(q.total)}</strong></div><div className="quote-detail-margin"><span>Margen global</span><strong>{num(q.margen).toFixed(1)}%</strong></div></div>{q.descripcion && <div className="quote-detail-description"><span>Alcance / notas</span><p>{q.descripcion}</p></div>}<div className="quote-detail-items-head"><strong>Ítems de la cotización</strong><span>{items.length} {items.length === 1 ? 'ítem' : 'ítems'}</span></div>{items.length === 0 ? <p className="empty-hint">No hay ítems registrados.</p> : <div className="quote-detail-items">{items.map((i, idx) => <div className="quote-detail-item" key={i.id || idx}><div className="quote-detail-item-num">{String(idx + 1).padStart(2, '0')}</div><div className="quote-detail-item-name"><strong>{i.descripcion}</strong><small>{num(i.cantidad)} × {money(i.valor_unitario)} · {i.modo === 'directo' ? 'Directo' : 'Detallado'}</small></div><div><span>Venta</span><strong>{money(i.valor_total)}</strong></div><div className="quote-detail-item-margin"><span>Margen</span><strong>{num(i.margen).toFixed(1)}%</strong></div></div>)}</div>}</div>}</article>; })}</div>}</div></div>;
}