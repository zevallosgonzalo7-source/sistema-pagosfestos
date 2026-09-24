import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { FestosIcon } from '../FestosIcon';

const COLORS = [
  { id: 'petrol', label: 'Petróleo', hex: '#224248' },
  { id: 'blue', label: 'Azul', hex: '#3b82f6' },
  { id: 'green', label: 'Verde', hex: '#22a579' },
  { id: 'purple', label: 'Morado', hex: '#8b5cf6' },
  { id: 'amber', label: 'Ámbar', hex: '#d59a31' },
  { id: 'rose', label: 'Rosa', hex: '#e85b79' },
];
const TYPES = ['ACTIVIDAD', 'ENTREGA', 'REUNIÓN', 'RECORDATORIO', 'NOTA'];
const pad = value => String(value).padStart(2, '0');
const dateKey = value => { if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return String(value).slice(0,10); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const toLocalInput = value => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIso = value => value ? new Date(value).toISOString() : null;
const prettyDate = value => value ? new Date(value).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const monthName = date => date.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
const colorHex = id => COLORS.find(c => c.id === id)?.hex || '#224248';
const emptyForm = () => ({ titulo: '', descripcion: '', tipo: 'ACTIVIDAD', color: 'petrol', proyecto_id: '', asignado_a: '', fecha_inicio: '', fecha_fin: '' });

export function OperationsCenter({ usuario, permisos, onNavigate, onNotify, onAudit }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [activities, setActivities] = useState([]);
  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterType, setFilterType] = useState('TODOS');
  const [filterAssignee, setFilterAssignee] = useState('TODOS');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [a, p, u] = await Promise.all([
        supabase.from('calendario_actividades').select('*, proyectos(id,codigo,nombre)').order('fecha_inicio', { ascending: true }),
        permisos.ver_proyectos ? supabase.from('proyectos').select('id,codigo,nombre,estado').order('nombre') : Promise.resolve({ data: [], error: null }),
        supabase.from('profiles').select('usuario,nombre,rol_label,activo').eq('activo', true).order('nombre'),
      ]);
      if (a.error) throw a.error;
      if (p.error) throw p.error;
      setActivities(a.data || []);
      setProjects(p.data || []);
      const fallback = ['GONZALO','JESUS','MAR','RODRIGO'].map(x => ({ usuario:x, nombre:x }));
      setTeam(u.error || !(u.data || []).length ? fallback : u.data);
    } catch (err) {
      setError(err?.message || 'No se pudo cargar el calendario global. Ejecuta primero el SQL de esta versión.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const channel = supabase.channel(`festos-calendar-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendario_actividades' }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const visibleActivities = useMemo(() => activities.filter(a => {
    if (filterType !== 'TODOS' && a.tipo !== filterType) return false;
    if (filterAssignee !== 'TODOS' && String(a.asignado_a || '').toUpperCase() !== filterAssignee) return false;
    return true;
  }), [activities, filterType, filterAssignee]);

  const month = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1);
  const days = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
  const emptyBefore = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((emptyBefore + days) / 7) * 7 }, (_, i) => {
    const day = i - emptyBefore + 1;
    return day >= 1 && day <= days ? day : null;
  });
  const monthPrefix = `${month.getFullYear()}-${pad(month.getMonth()+1)}`;
  const today = dateKey(new Date().toISOString());
  const activitiesForDay = day => visibleActivities.filter(a => dateKey(a.fecha_inicio) === `${monthPrefix}-${pad(day)}`);
  const monthActivities = visibleActivities.filter(a => dateKey(a.fecha_inicio).startsWith(monthPrefix));
  const nextActivities = visibleActivities.filter(a => dateKey(a.fecha_inicio) >= today).slice().sort((a,b) => String(a.fecha_inicio).localeCompare(String(b.fecha_inicio))).slice(0, 7);

  const openNew = (day = null) => {
    const base = day ? `${monthPrefix}-${pad(day)}T09:00` : `${today}T09:00`;
    setEditing(null);
    setForm({ ...emptyForm(), fecha_inicio: base, fecha_fin: base, asignado_a: String(usuario || '').toUpperCase() });
    setSelected(null);
    setModalOpen(true);
  };
  const openEdit = activity => {
    setEditing(activity);
    setForm({ titulo: activity.titulo || '', descripcion: activity.descripcion || '', tipo: activity.tipo || 'ACTIVIDAD', color: activity.color || 'petrol', proyecto_id: activity.proyecto_id || '', asignado_a: activity.asignado_a || '', fecha_inicio: toLocalInput(activity.fecha_inicio), fecha_fin: toLocalInput(activity.fecha_fin || activity.fecha_inicio) });
    setSelected(null);
    setModalOpen(true);
  };
  const save = async e => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.fecha_inicio) return;
    setSaving(true); setError('');
    const payload = {
      titulo: form.titulo.trim(), descripcion: form.descripcion.trim() || null, tipo: form.tipo,
      color: form.color, proyecto_id: form.proyecto_id || null, asignado_a: form.asignado_a || null,
      fecha_inicio: toIso(form.fecha_inicio), fecha_fin: toIso(form.fecha_fin || form.fecha_inicio),
      updated_by: String(usuario || '').toUpperCase(),
    };
    let result;
    if (editing) result = await supabase.from('calendario_actividades').update(payload).eq('id', editing.id).select('id').maybeSingle();
    else result = await supabase.from('calendario_actividades').insert([{ ...payload, created_by: String(usuario || '').toUpperCase() }]).select('id').maybeSingle();
    if (result.error || !result.data) setError(result.error?.message || 'No se pudo guardar la actividad.');
    else {
      onNotify?.(`${editing ? 'Actividad actualizada' : 'Nueva actividad'}: ${payload.titulo}`, editing ? 'edicion' : 'nuevo');
      onAudit?.(editing ? 'Edición' : 'Creación', `Calendario global · ${payload.titulo}`);
      setModalOpen(false); setEditing(null); setForm(emptyForm()); await load(true);
    }
    setSaving(false);
  };
  const remove = async activity => {
    if (!window.confirm(`¿Eliminar “${activity.titulo}”?`)) return;
    const { error: err } = await supabase.from('calendario_actividades').delete().eq('id', activity.id);
    if (err) setError(err.message);
    else { onAudit?.('Eliminación', `Calendario global · ${activity.titulo}`); setSelected(null); await load(true); }
  };

  return <div className="global-calendar-page">
    <header className="global-calendar-hero">
      <div><span>FESTOS · AGENDA COMPARTIDA</span><h1>Calendario global</h1><p>Entregas, reuniones, notas y actividades del equipo en un solo calendario visible para todos.</p></div>
      <div className="global-calendar-actions"><button className="btn-muted" type="button" onClick={() => setMonthOffset(0)}>Hoy</button><button className="btn-primary" type="button" onClick={() => openNew()}><FestosIcon name="Plus" size={17}/> Agregar actividad</button></div>
    </header>

    {error && <div className="ops-error"><FestosIcon name="AlertTriangle" size={17}/>{error}</div>}
    <section className="global-calendar-toolbar">
      <div className="global-calendar-month-nav"><button type="button" onClick={() => setMonthOffset(v => v-1)}><FestosIcon name="ArrowLeft" size={17}/></button><strong>{monthName(month)}</strong><button type="button" onClick={() => setMonthOffset(v => v+1)}><FestosIcon name="ArrowRight" size={17}/></button></div>
      <div className="global-calendar-filters"><select value={filterType} onChange={e => setFilterType(e.target.value)}><option value="TODOS">Todos los tipos</option>{TYPES.map(x => <option key={x}>{x}</option>)}</select><select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}><option value="TODOS">Todo el equipo</option>{team.map(x => <option key={x.usuario} value={String(x.usuario).toUpperCase()}>{x.nombre || x.usuario}</option>)}</select></div>
    </section>

    <div className="global-calendar-layout">
      <section className="global-calendar-card">
        <div className="global-calendar-weekdays">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x => <span key={x}>{x}</span>)}</div>
        <div className="global-calendar-grid">
          {cells.map((day, idx) => day ? <button type="button" key={idx} className={`global-calendar-day ${`${monthPrefix}-${pad(day)}` === today ? 'is-today' : ''}`} onDoubleClick={() => openNew(day)} onClick={() => { const first = activitiesForDay(day)[0]; if (first) setSelected(first); }}>
            <span className="global-calendar-day-number">{day}</span>
            <div className="global-calendar-events">{activitiesForDay(day).slice(0,3).map(a => <span key={a.id} style={{ '--event-color': colorHex(a.color) }} onClick={e => { e.stopPropagation(); setSelected(a); }}><b>{new Date(a.fecha_inicio).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</b> {a.titulo}</span>)}{activitiesForDay(day).length > 3 && <small>+{activitiesForDay(day).length-3} más</small>}</div>
          </button> : <div key={idx} className="global-calendar-day is-empty" />)}
        </div>
      </section>

      <aside className="global-calendar-side">
        <article className="global-calendar-summary"><span>ESTE MES</span><strong>{monthActivities.length}</strong><small>actividades registradas</small></article>
        <article className="global-calendar-agenda"><div className="global-calendar-side-head"><div><span>PRÓXIMAMENTE</span><h2>Agenda del equipo</h2></div></div>{nextActivities.length ? nextActivities.map(a => <button type="button" key={a.id} className="global-agenda-item" onClick={() => setSelected(a)}><i style={{ background: colorHex(a.color) }} /><div><strong>{a.titulo}</strong><span>{prettyDate(a.fecha_inicio)}</span><small>{a.asignado_a ? `Asignado a ${a.asignado_a}` : 'Sin responsable'}{a.proyectos?.nombre ? ` · ${a.proyectos.nombre}` : ''}</small></div></button>) : <p className="empty-hint">No hay actividades próximas con estos filtros.</p>}</article>
      </aside>
    </div>

    {selected && <div className="modal-overlay" onClick={() => setSelected(null)}><article className="glass-card modal-card calendar-detail-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="calendar-type-pill" style={{ '--event-color': colorHex(selected.color) }}>{selected.tipo}</span><h4 className="panel-title">{selected.titulo}</h4></div><button className="modal-close-btn" onClick={() => setSelected(null)}>×</button></div><div className="calendar-detail-grid"><div><span>Fecha y hora</span><strong>{prettyDate(selected.fecha_inicio)}</strong></div><div><span>Asignado a</span><strong>{selected.asignado_a || 'Sin responsable'}</strong></div><div><span>Proyecto</span><strong>{selected.proyectos?.codigo ? `${selected.proyectos.codigo} · ` : ''}{selected.proyectos?.nombre || 'Sin proyecto'}</strong></div><div><span>Creado por</span><strong>{selected.created_by || '—'}</strong></div></div>{selected.descripcion && <p className="calendar-detail-notes">{selected.descripcion}</p>}<div className="modal-actions"><button type="button" className="btn-primary" onClick={() => openEdit(selected)}><FestosIcon name="Pencil" size={16}/> Editar</button><button type="button" className="btn-secondary" onClick={() => remove(selected)}><FestosIcon name="Trash2" size={16}/> Eliminar</button>{permisos.ver_proyectos && selected.proyecto_id && <button type="button" className="btn-muted" onClick={() => onNavigate('proyectos')}><FestosIcon name="FolderKanban" size={16}/> Abrir proyectos</button>}</div></article></div>}

    {modalOpen && <div className="modal-overlay" onClick={() => !saving && setModalOpen(false)}><form className="glass-card modal-card calendar-editor-modal" onSubmit={save} onClick={e => e.stopPropagation()}><div className="modal-head"><div><h4 className="panel-title"><FestosIcon name="CalendarDays" size={18}/> {editing ? 'Editar actividad' : 'Agregar actividad'}</h4><p className="panel-note">Crea una nota, entrega, reunión o recordatorio para todo el equipo.</p></div><button type="button" className="modal-close-btn" onClick={() => setModalOpen(false)}>×</button></div>
      <div className="form-row"><label>Título *</label><input value={form.titulo} onChange={e => setForm({...form,titulo:e.target.value})} placeholder="Ej. Entrega de módulos Xiaomi" required /></div>
      <div className="form-grid-2"><div className="form-row"><label>Tipo</label><select value={form.tipo} onChange={e => setForm({...form,tipo:e.target.value})}>{TYPES.map(x => <option key={x}>{x}</option>)}</select></div><div className="form-row"><label>Asignar a</label><select value={form.asignado_a} onChange={e => setForm({...form,asignado_a:e.target.value})}><option value="">Sin responsable</option>{team.map(x => <option key={x.usuario} value={String(x.usuario).toUpperCase()}>{x.nombre || x.usuario}</option>)}</select></div></div>
      <div className="form-row"><label>Proyecto relacionado</label><select value={form.proyecto_id} onChange={e => setForm({...form,proyecto_id:e.target.value})}><option value="">Sin proyecto</option>{projects.map(p => <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} · ` : ''}{p.nombre}</option>)}</select></div>
      <div className="form-grid-2"><div className="form-row"><label>Fecha y hora *</label><input type="datetime-local" value={form.fecha_inicio} onChange={e => setForm({...form,fecha_inicio:e.target.value})} required /></div><div className="form-row"><label>Finaliza</label><input type="datetime-local" value={form.fecha_fin} min={form.fecha_inicio || undefined} onChange={e => setForm({...form,fecha_fin:e.target.value})} /></div></div>
      <div className="form-row"><label>Color</label><div className="calendar-color-picker">{COLORS.map(c => <button key={c.id} type="button" className={form.color === c.id ? 'active' : ''} style={{ '--swatch': c.hex }} onClick={() => setForm({...form,color:c.id})}><i />{c.label}</button>)}</div></div>
      <div className="form-row"><label>Notas</label><textarea rows="4" value={form.descripcion} onChange={e => setForm({...form,descripcion:e.target.value})} placeholder="Detalles, dirección, indicaciones o información relevante..." /></div>
      <div className="modal-actions"><button className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear actividad'}</button><button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button></div>
    </form></div>}

    {loading && <div className="calendar-loading">Cargando calendario global…</div>}
  </div>;
}
