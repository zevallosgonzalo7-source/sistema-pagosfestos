import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { FestosIcon } from '../FestosIcon';

const STATES = ['EN PROCESO', 'FINALIZADO', 'FACTURADO'];
const money = value => `S/. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
const stateOf = value => STATES.includes(String(value || '').toUpperCase()) ? String(value).toUpperCase() : 'EN PROCESO';
const day = value => value ? String(value).slice(0, 10) : '';
const currentDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const readPrefs = key => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } };

export function OperationsCenter({ usuario, permisos, onNavigate, onNotify, onAudit }) {
  const key = `festos_operaciones_preferencias_${String(usuario).toLowerCase()}`;
  const [prefs, setPrefs] = useState(() => readPrefs(key));
  const [tab, setTab] = useState('resumen');
  const [items, setItems] = useState({ projects: [], quotes: [], clients: [], providers: [] });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [dateDraft, setDateDraft] = useState({ entrega: '' });
  const [dateError, setDateError] = useState('');
  const [refreshId, setRefreshId] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);
  const selected = items.projects.find(p => p.id === detailId);
  const canEdit = Boolean(permisos.ver_proyectos && permisos.gestionar_proyectos);
  const canSeeProjects = Boolean(permisos.ver_proyectos);
  const hasDates = items.projects.some(p => Object.prototype.hasOwnProperty.call(p, 'fecha_entrega'));

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(prefs)); } catch { /* preferencias opcionales */ } }, [key, prefs]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    const requests = [
      permisos.ver_proyectos ? supabase.from('proyectos').select('*, clientes(nombre)').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
      permisos.ver_cotizaciones ? supabase.from('cotizaciones').select('id,project_id,proyecto_nombre,codigo,estado,subtotal,created_at,created_by').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
      permisos.ver_clientes ? supabase.from('clientes').select('id,nombre,estado').limit(1000) : Promise.resolve({ data: [] }),
      permisos.ver_proveedores ? supabase.from('proveedores').select('id,nombre,estado,categoria').limit(1000) : Promise.resolve({ data: [] }),
    ];
    Promise.all(requests).then(result => {
      if (!active) return;
      const firstError = result.find(x => x.error);
      if (firstError) throw firstError.error;
      setItems({ projects: result[0].data || [], quotes: result[1].data || [], clients: result[2].data || [], providers: result[3].data || [] });
    }).catch(err => { if (active) setError(err.message || 'No fue posible cargar el centro de trabajo.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [refreshId, permisos.ver_proyectos, permisos.ver_cotizaciones, permisos.ver_clientes, permisos.ver_proveedores]);
  useEffect(() => {
    if (!permisos.ver_proyectos) return;
    const channel = supabase.channel(`festos-center-${String(usuario)}-${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, () => setRefreshId(n => n + 1)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [permisos.ver_proyectos, usuario]);

  const query = String(prefs.search || '').trim().toLowerCase();
  const personal = Boolean(prefs.onlyMine);
  const filtered = useMemo(() => items.projects.filter(p => {
    if (personal && String(p.ejecutivo || p.created_by || '').toLowerCase().trim() !== String(usuario).toLowerCase().trim()) return false;
    if (prefs.state && prefs.state !== 'TODOS' && stateOf(p.estado) !== prefs.state) return false;
    if (prefs.lob && prefs.lob !== 'TODOS' && String(p.lob || '') !== prefs.lob) return false;
    if (query && !`${p.codigo || ''} ${p.nombre || ''} ${p.clientes?.nombre || ''} ${p.ejecutivo || ''}`.toLowerCase().includes(query)) return false;
    return true;
  }), [items.projects, personal, usuario, prefs.state, prefs.lob, query]);
  const lobOptions = [...new Set(items.projects.map(p => p.lob).filter(Boolean))].sort();
  const valueOf = p => { const direct = Number(p.valor_base ?? p.valor_venta); if (Number.isFinite(direct) && direct > 0) return direct; return Number(items.quotes.find(q => q.project_id === p.id)?.subtotal) || 0; };
  const counts = STATES.map(s => ({ label: s, count: filtered.filter(p => stateOf(p.estado) === s).length }));
  const activeQuotes = items.quotes.filter(q => /revisi/i.test(String(q.estado || '')) && (!personal || String(q.created_by || '').toLowerCase() === String(usuario).toLowerCase()));
  const upcoming = filtered.filter(p => p.fecha_entrega && stateOf(p.estado) === 'EN PROCESO' && day(p.fecha_entrega) >= currentDay())
    .sort((a, b) => day(a.fecha_entrega).localeCompare(day(b.fecha_entrega)));
  const late = filtered.filter(p => p.fecha_entrega && stateOf(p.estado) === 'EN PROCESO' && day(p.fecha_entrega) < currentDay());
  const nextSeven = new Date(); nextSeven.setDate(nextSeven.getDate() + 7);
  const withinWeek = upcoming.filter(p => day(p.fecha_entrega) <= `${nextSeven.getFullYear()}-${String(nextSeven.getMonth()+1).padStart(2,'0')}-${String(nextSeven.getDate()).padStart(2,'0')}`);
  const quoteFor = p => items.quotes.find(q => q.project_id === p.id) || items.quotes.find(q => q.proyecto_nombre && q.proyecto_nombre.trim().toLowerCase() === String(p.nombre || '').trim().toLowerCase());

  const changeStatus = async (project, next) => {
    if (!canEdit || !online || saving || stateOf(project.estado) === next) return;
    setSaving(project.id); setError('');
    const { data, error: err } = await supabase.from('proyectos').update({ estado: next }).eq('id', project.id).select('id').maybeSingle();
    if (err || !data) { setError(err?.message || 'No se pudo confirmar el cambio. Verifica tus permisos en Supabase.'); }
    else { onNotify(`Proyecto actualizado: ${project.codigo || project.nombre} · ${next}`, 'edicion'); onAudit('Edición', `${project.codigo || project.nombre} · Estado: ${next}`); setRefreshId(n => n + 1); }
    setSaving('');
  };
  const openDetails = p => { setDetailId(p.id); setDateDraft({ entrega: day(p.fecha_entrega) }); setDateError(''); };
  const saveDates = async () => {
    if (!selected || !hasDates || !canEdit || !online || saving) return;
    if (selected.fecha_pedido && dateDraft.entrega && day(selected.fecha_pedido) > dateDraft.entrega) { setDateError('La entrega no puede ser anterior a la fecha de pedido.'); return; }
    setSaving(selected.id); setDateError('');
    const { data, error: err } = await supabase.from('proyectos').update({ fecha_entrega: dateDraft.entrega || null }).eq('id', selected.id).select('id').maybeSingle();
    if (err || !data) setDateError(err?.message || 'No se pudo confirmar el cambio.');
    else { onNotify(`Fecha de entrega actualizada: ${selected.codigo || selected.nombre}`, 'edicion'); onAudit('Edición', `${selected.codigo || selected.nombre} · Fecha de entrega actualizada`); setRefreshId(n => n + 1); }
    setSaving('');
  };
  const month = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1);
  const calendarStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const emptyCells = (calendarStart.getDay() + 6) % 7;
  const monthDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const calendarRows = Array.from({ length: emptyCells + monthDays }, (_, i) => i < emptyCells ? null : i - emptyCells + 1);

  return <div className="ops-root">
    <header className="ops-header"><div><span className="ops-eyebrow">FESTOS · CENTRO OPERATIVO</span><h1>Tu espacio de trabajo</h1><p>Proyectos, equipo y fechas en un solo lugar. Los importes se muestran sin IGV.</p></div><div className="ops-header-actions"><button type="button" className="btn-muted" onClick={() => setRefreshId(n => n + 1)} disabled={busy}><FestosIcon name="RefreshCw" size={17}/> Actualizar</button><button type="button" className="btn-primary" onClick={() => onNavigate('proyectos')} disabled={!canSeeProjects}><FestosIcon name="FolderKanban" size={18}/> Abrir proyectos</button></div></header>
    <nav className="ops-tabs" aria-label="Vistas del centro operativo">{[['resumen','LayoutDashboard','Mi espacio'],['kanban','FolderKanban','Tablero Kanban'],['lista','ClipboardList','Lista compacta'],['calendario','CalendarDays','Calendario'],['documentos','FileText','Documentos'],['actividad','History','Actividad']].map(([id,icon,label]) => <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><FestosIcon name={icon} size={17}/>{label}</button>)}</nav>
    {error && <div className="ops-error" role="alert"><FestosIcon name="AlertTriangle" size={18}/>{error}</div>}
    {!online && <div className="ops-error" role="status">Sin conexión a Internet. Los cambios se deshabilitan hasta recuperar la conexión.</div>}
    <section className="ops-toolbar" aria-label="Filtros del centro operativo"><label><FestosIcon name="Search" size={17}/><input value={prefs.search || ''} onChange={e => setPrefs(p => ({...p,search:e.target.value}))} placeholder="Buscar proyectos, clientes, códigos…" /></label><select aria-label="Filtrar por estado" value={prefs.state || 'TODOS'} onChange={e => setPrefs(p => ({...p,state:e.target.value}))}><option value="TODOS">Todos los estados</option>{STATES.map(s => <option key={s}>{s}</option>)}</select><select aria-label="Filtrar por categoría" value={prefs.lob || 'TODOS'} onChange={e => setPrefs(p => ({...p,lob:e.target.value}))}><option value="TODOS">Todas las categorías</option>{lobOptions.map(x => <option key={x}>{x}</option>)}</select><label className="ops-own-filter"><input type="checkbox" checked={personal} onChange={e => setPrefs(p => ({...p,onlyMine:e.target.checked}))}/> Solo mis proyectos</label><button type="button" className="btn-muted" onClick={() => setPrefs({})}>Limpiar</button></section>
    <p className="ops-prefs-hint">Tus filtros se guardan únicamente en este dispositivo, para tu usuario.</p>
    {busy ? <div className="ops-skeleton" aria-label="Cargando datos"><i/><i/><i/><i/></div> : <>
      {tab === 'resumen' && <><section className="ops-metrics"><article><small>PROYECTOS FILTRADOS</small><strong>{filtered.length}</strong><span>{counts[0].count} en proceso</span></article><article><small>VALOR DE PROYECTOS</small><strong>{money(filtered.reduce((a,p) => a + valueOf(p), 0))}</strong><span>Valor registrado sin IGV</span></article><article><small>COTIZACIONES EN REVISIÓN</small><strong>{permisos.ver_cotizaciones ? activeQuotes.length : '—'}</strong><span>{permisos.ver_cotizaciones ? 'Pendientes de revisión' : 'Sin permiso de visualización'}</span></article><article><small>ENTREGAS PRÓXIMAS</small><strong>{hasDates ? withinWeek.length : '—'}</strong><span>{hasDates ? `${late.length} vencidas · próximos 7 días` : 'Fechas de entrega aún no configuradas'}</span></article></section><div className="ops-two-cols"><section className="ops-panel"><div className="ops-panel-head"><div><span>MI OPERACIÓN</span><h2>Proyectos recientes</h2></div><button type="button" className="ops-link" onClick={() => setTab('kanban')}>Ver tablero</button></div>{filtered.slice(0,7).map(p => <button type="button" className="ops-project-row" onClick={() => openDetails(p)} key={p.id}><span><strong>{p.nombre}</strong><small>{p.codigo || 'Sin código'} · {p.clientes?.nombre || 'Cliente sin registro'}</small></span><span className={`ops-chip ${stateOf(p.estado).toLowerCase().replaceAll(' ','-')}`}>{stateOf(p.estado)}</span></button>)}{!filtered.length && <p className="ops-empty">No hay proyectos para los filtros elegidos.</p>}</section><section className="ops-panel"><div className="ops-panel-head"><div><span>SEGUIMIENTO</span><h2>Próximas entregas</h2></div><button type="button" className="ops-link" onClick={() => setTab('calendario')}>Ver calendario</button></div>{!hasDates ? <p className="ops-empty">Para mostrar alertas reales, ejecuta la migración opcional de fechas y registra fechas de entrega en los proyectos. No se deducen vencimientos a partir de la fecha de registro.</p> : <>{late.slice(0,3).map(p => <button key={p.id} className="ops-project-row" type="button" onClick={() => openDetails(p)}><span><strong>{p.nombre}</strong><small>Entrega vencida: {day(p.fecha_entrega)}</small></span><span className="ops-chip late">VENCIDO</span></button>)}{upcoming.slice(0,5).map(p => <button key={p.id} className="ops-project-row" type="button" onClick={() => openDetails(p)}><span><strong>{p.nombre}</strong><small>Entrega: {day(p.fecha_entrega)}</small></span><span className="ops-chip">PRÓXIMO</span></button>)}{!late.length && !upcoming.length && <p className="ops-empty">Sin entregas pendientes registradas.</p>}</>}</section></div><section className="ops-quick"><div><span>ACCESOS RÁPIDOS</span><h2>Continuar trabajando</h2></div>{[['clientes','Users','Clientes'],['proveedores','Truck','Proveedores'],['cotizaciones','FileText','Cotizaciones'],['analisis','LayoutDashboard','Dashboard proyectos']].filter(([view]) => view === 'analisis' || permisos[`ver_${view}`]).map(([view,icon,label]) => <button type="button" key={view} onClick={() => onNavigate(view)}><FestosIcon name={icon} size={19}/>{label}<FestosIcon name="ArrowRight" size={15}/></button>)}</section></>}
      {tab === 'lista' && <section className="ops-panel ops-list-view"><div className="ops-panel-head"><div><span>VISTA PERSONALIZABLE</span><h2>Lista compacta de proyectos</h2></div><select value={prefs.sort || 'reciente'} aria-label="Orden de proyectos" onChange={e => setPrefs(p => ({ ...p, sort:e.target.value }))}><option value="reciente">Fecha de pedido más reciente</option><option value="nombre">Nombre A-Z</option><option value="valor">Mayor valor</option></select></div><div className="ops-table-scroll"><table><thead><tr><th>Proyecto</th><th>Cliente</th><th>Ejecutivo comercial</th><th>Estado</th><th>Valor sin IGV</th><th></th></tr></thead><tbody>{[...filtered].sort((a,b) => (prefs.sort === 'valor' ? valueOf(b)-valueOf(a) : prefs.sort === 'nombre' ? String(a.nombre).localeCompare(String(b.nombre),'es') : new Date(b.fecha_pedido || b.created_at)-new Date(a.fecha_pedido || a.created_at))).map(p => <tr key={p.id}><td><strong>{p.nombre}</strong><small>{p.codigo || 'Sin código'}</small></td><td>{p.clientes?.nombre || '—'}</td><td>{p.ejecutivo || '—'}</td><td><span className={`ops-chip ${stateOf(p.estado).toLowerCase().replaceAll(' ','-')}`}>{stateOf(p.estado)}</span></td><td className="ops-cell-money">{money(valueOf(p))}</td><td><button type="button" className="ops-link" onClick={() => openDetails(p)} aria-label={`Ver ${p.nombre}`}><FestosIcon name="Eye" size={18}/></button></td></tr>)}</tbody></table>{!filtered.length && <p className="ops-empty">No hay proyectos con los filtros seleccionados.</p>}</div></section>}
      {tab === 'kanban' && <section className="ops-board" aria-label="Tablero de proyectos">{STATES.map(s => <div className="ops-column" key={s}><header><strong>{s}</strong><span>{counts.find(x => x.label === s)?.count || 0}</span></header><div className="ops-column-body">{filtered.filter(p => stateOf(p.estado) === s).map(p => <article key={p.id} className="ops-kanban-card"><button type="button" className="ops-card-detail" onClick={() => openDetails(p)}><small>{p.codigo || 'PROYECTO'}</small><strong>{p.nombre}</strong><span>{p.clientes?.nombre || 'Cliente no registrado'}</span><b>{money(valueOf(p))}</b></button><div className="ops-card-actions"><span>{p.ejecutivo || 'Sin ejecutivo comercial'}</span>{canEdit && <select value={s} disabled={saving === p.id || !online} aria-label={`Cambiar estado de ${p.nombre}`} onChange={e => changeStatus(p,e.target.value)}>{STATES.map(next => <option key={next}>{next}</option>)}</select>}</div></article>)}{!filtered.some(p => stateOf(p.estado) === s) && <p className="ops-empty">Sin proyectos</p>}</div></div>)}</section>}
      {tab === 'calendario' && <section className="ops-panel ops-calendar-wrap"><div className="ops-panel-head"><div><span>CALENDARIO OPERATIVO</span><h2>{new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric'}).format(month)}</h2></div><div className="ops-calendar-controls"><button type="button" onClick={() => setMonthOffset(v => v - 1)} aria-label="Mes anterior">‹</button><button type="button" onClick={() => setMonthOffset(0)}>Hoy</button><button type="button" onClick={() => setMonthOffset(v => v + 1)} aria-label="Mes siguiente">›</button></div></div><p className="ops-prefs-hint">{hasDates ? 'Entrega = fecha de entrega · Registro = fecha de creación. Se muestran solo datos registrados.' : 'Las fechas indicadas corresponden al registro del proyecto, no a una entrega. Para habilitar entregas, ejecuta la migración de fechas.'}</p><div className="ops-calendar">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => <strong className="ops-calendar-weekday" key={d}>{d}</strong>)}{calendarRows.map((d,i) => { const key = d ? `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` : ''; const events = d ? filtered.filter(p => day(p.fecha_entrega) === key || day(p.fecha_pedido || p.created_at) === key).slice(0,4) : []; return <div className={`ops-calendar-day ${d ? '' : 'empty'}`} key={i}>{d && <><b>{d}</b>{events.map(p => <button type="button" key={p.id} className={day(p.fecha_entrega) === key ? 'due' : ''} onClick={() => openDetails(p)} title={`${p.nombre} · ${day(p.fecha_entrega) === key ? 'Entrega' : 'Pedido'}`}>{day(p.fecha_entrega) === key ? 'Entrega' : 'Pedido'} · {p.nombre}</button>)}</>}</div>; })}</div></section>}
      {tab === 'documentos' && <section className="ops-panel ops-feature"><div className="ops-feature-icon"><FestosIcon name="LockKeyhole" size={29}/></div><h2>Archivos por proyecto</h2><p>Preparamos el espacio para órdenes de compra, artes y entregables, pero aún no está habilitada la carga de documentos. Antes de activarla hay que implementar autenticación verificable por Supabase y políticas privadas de Storage por usuario/proyecto.</p><div className="ops-feature-footer"><span className="ops-chip">PENDIENTE DE CONFIGURACIÓN SEGURA</span><span>No se han creado buckets públicos ni se ha modificado la base de datos.</span></div></section>}
      {tab === 'actividad' && <section className="ops-panel"><div className="ops-panel-head"><div><span>REGISTROS EXISTENTES</span><h2>Actividad verificable</h2></div></div><p className="ops-prefs-hint">Se muestran fechas de creación registradas y estados actuales; esto no es todavía un historial compartido de cada edición.</p>{[...filtered.map(p => ({ id:`p-${p.id}`,name:p.nombre,detail:`Proyecto ${p.codigo || ''} · ${stateOf(p.estado)}`,date:p.created_at,ref:p })),...(permisos.ver_cotizaciones?items.quotes.map(q => ({id:`q-${q.id}`,name:q.proyecto_nombre || q.codigo,detail:`Cotización ${q.codigo || ''} · ${q.estado || 'Sin estado'}`,date:q.created_at})):[])].filter(x => x.date).sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,30).map(x => <div className="ops-activity-row" key={x.id}><span className="ops-activity-dot"/><div><strong>{x.name}</strong><small>{x.detail}</small></div><time>{new Date(x.date).toLocaleString('es-PE')}</time>{x.ref && <button type="button" onClick={() => openDetails(x.ref)} aria-label="Ver proyecto"><FestosIcon name="Eye" size={17}/></button>}</div>)}{!filtered.length && <p className="ops-empty">Sin registros para mostrar.</p>}</section>}
    </>}
    {selected && <div className="ops-drawer-backdrop" role="presentation" onMouseDown={() => setDetailId(null)}><aside className="ops-drawer" role="dialog" aria-modal="true" aria-label={`Detalle de ${selected.nombre}`} onMouseDown={e => e.stopPropagation()}><div className="ops-drawer-head"><span>FICHA DEL PROYECTO</span><button type="button" aria-label="Cerrar detalle" onClick={() => setDetailId(null)}>×</button></div><small>{selected.codigo || 'SIN CÓDIGO'}</small><h2>{selected.nombre}</h2><p>{selected.descripcion || 'Sin descripción registrada.'}</p><div className="ops-drawer-data"><div><span>Cliente</span><strong>{selected.clientes?.nombre || '—'}</strong></div><div><span>Ejecutivo comercial</span><strong>{selected.ejecutivo || '—'}</strong></div><div><span>Estado</span><strong>{stateOf(selected.estado)}</strong></div><div><span>Categoría</span><strong>{selected.lob || '—'}</strong></div><div><span>Valor sin IGV</span><strong>{money(valueOf(selected))}</strong></div><div><span>Cotización vinculada</span><strong>{quoteFor(selected)?.codigo || 'Sin vínculo registrado'}</strong></div><div><span>Fecha de pedido</span><strong>{selected.fecha_pedido ? new Date(`${selected.fecha_pedido}T12:00:00`).toLocaleDateString('es-PE') : (selected.created_at ? new Date(selected.created_at).toLocaleDateString('es-PE') : '—')}</strong></div></div><div className="ops-dates-editor"><h3>Fecha de entrega</h3>{!hasDates ? <p>Para registrar la fecha de entrega, ejecuta el SQL de migración opcional incluido en el ZIP. Hasta entonces no se generan alertas de vencimiento.</p> : <><label>Fecha de entrega<input type="date" value={dateDraft.entrega} disabled={!canEdit || !!saving} onChange={e => setDateDraft(p => ({...p,entrega:e.target.value}))}/></label>{dateError && <p role="alert" className="ops-error">{dateError}</p>}{canEdit && <button type="button" className="btn-primary" onClick={saveDates} disabled={!online || !!saving}>{saving ? 'Guardando...' : 'Guardar fecha de entrega'}</button>}</>}</div><div className="ops-drawer-bottom"><button className="btn-muted" type="button" onClick={() => setDetailId(null)}>Cerrar</button><button type="button" className="btn-primary" onClick={() => { setDetailId(null); onNavigate('proyectos'); }}>Ir a proyectos</button></div></aside></div>}
  </div>;
}
