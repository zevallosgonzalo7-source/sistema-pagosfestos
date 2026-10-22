import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { FestosIcon } from '../FestosIcon';
import { nombreCompletoUsuario } from '../teamDirectory';

function saludoPorHora() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function fechaCorta(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const esHoy = d.toDateString() === hoy.toDateString();
  return esHoy
    ? `Hoy, ${d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

export function HomeModule({ usuario, perfil, permisos, onNavigate, onNewQuote, onNewProject }) {
  const [stats, setStats] = useState({ cotizaciones: 0, compras: 0, proveedores: 0, proyectos: 0 });
  const [actividad, setActividad] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let active = true;
    const cargar = async () => {
      setCargando(true);
      try {
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);

        const [quotes, purchases, suppliers, projects, recentPurchases, recentQuotes, recentProjects] = await Promise.all([
          permisos?.ver_cotizaciones ? supabase.from('cotizaciones').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
          supabase.from('compras').select('id', { count: 'exact', head: true }).gte('fecha_compra', inicioMes.toISOString().slice(0, 10)),
          permisos?.ver_proveedores ? supabase.from('proveedores').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
          permisos?.ver_proyectos ? supabase.from('proyectos').select('id', { count: 'exact', head: true }).neq('estado', 'FINALIZADO') : Promise.resolve({ count: 0 }),
          supabase.from('compras').select('id,codigo,numero_documento,proveedor_nombre,created_at,fecha_compra').order('created_at', { ascending: false }).limit(4),
          permisos?.ver_cotizaciones ? supabase.from('cotizaciones').select('id,codigo,proyecto_nombre,estado,created_at').order('created_at', { ascending: false }).limit(3) : Promise.resolve({ data: [] }),
          permisos?.ver_proyectos ? supabase.from('proyectos').select('id,codigo,nombre,estado,created_at').order('created_at', { ascending: false }).limit(3) : Promise.resolve({ data: [] }),
        ]);
        if (!active) return;
        setStats({
          cotizaciones: quotes.count || 0,
          compras: purchases.count || 0,
          proveedores: suppliers.count || 0,
          proyectos: projects.count || 0,
        });
        const eventos = [
          ...(recentPurchases.data || []).map(x => ({ id: `c-${x.id}`, tipo: 'Compra registrada', detalle: `${x.proveedor_nombre || 'Proveedor'}${x.numero_documento ? ` · ${x.numero_documento}` : ''}`, fecha: x.created_at || x.fecha_compra, icono: 'ClipboardList', tone: 'green', destino: 'compras' })),
          ...(recentQuotes.data || []).map(x => ({ id: `q-${x.id}`, tipo: `Cotización ${String(x.estado || '').toLowerCase() === 'aprobado' ? 'aprobada' : 'actualizada'}`, detalle: `${x.codigo || 'Cotización'}${x.proyecto_nombre ? ` · ${x.proyecto_nombre}` : ''}`, fecha: x.created_at, icono: 'FileText', tone: 'blue', destino: 'cotizaciones' })),
          ...(recentProjects.data || []).map(x => ({ id: `p-${x.id}`, tipo: 'Proyecto actualizado', detalle: `${x.codigo || ''}${x.nombre ? ` · ${x.nombre}` : ''}`, fecha: x.created_at, icono: 'FolderKanban', tone: 'purple', destino: 'proyectos' })),
        ].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)).slice(0, 5);
        setActividad(eventos);
      } catch (err) {
        console.warn('Inicio FESTOS: no se pudieron cargar todos los indicadores.', err);
      } finally {
        if (active) setCargando(false);
      }
    };
    cargar();
    return () => { active = false; };
  }, [permisos]);

  const nombre = nombreCompletoUsuario(perfil?.nombre || usuario, usuario);
  const cargo = perfil?.rol_label || 'Usuario FESTOS';

  const cards = useMemo(() => ([
    { key: 'cotizaciones', label: 'Cotizaciones', value: stats.cotizaciones, caption: 'visibles en el sistema', icon: 'FileText', tone: 'green', visible: permisos?.ver_cotizaciones, target: 'cotizaciones' },
    { key: 'compras', label: 'Compras', value: stats.compras, caption: 'este mes', icon: 'ClipboardList', tone: 'blue', visible: true, target: 'compras' },
    { key: 'proveedores', label: 'Proveedores', value: stats.proveedores, caption: 'registrados', icon: 'Truck', tone: 'amber', visible: permisos?.ver_proveedores, target: 'proveedores' },
    { key: 'proyectos', label: 'Proyectos', value: stats.proyectos, caption: 'activos', icon: 'FolderKanban', tone: 'purple', visible: permisos?.ver_proyectos, target: 'proyectos' },
  ].filter(x => x.visible !== false)), [stats, permisos]);

  const quick = [
    permisos?.gestionar_cotizaciones && permisos?.ver_cotizaciones && { label: 'Nueva Cotización', icon: 'FileText', tone: 'green', onClick: onNewQuote },
    { label: 'Registrar Compra', icon: 'ClipboardList', tone: 'blue', onClick: () => onNavigate('compras') },
    permisos?.gestionar_proyectos && permisos?.ver_proyectos && { label: 'Nuevo Proyecto', icon: 'FolderKanban', tone: 'amber', onClick: onNewProject },
    permisos?.ver_clientes && { label: 'Clientes', icon: 'Users', tone: 'purple', onClick: () => onNavigate('clientes') },
    permisos?.ver_proveedores && { label: 'Proveedores', icon: 'Building2', tone: 'teal', onClick: () => onNavigate('proveedores') },
    { label: 'Dashboard', icon: 'ChartNoAxesColumnIncreasing', tone: 'gray', onClick: () => onNavigate('analisis') },
  ].filter(Boolean);

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="home-eyebrow">{saludoPorHora()}</span>
          <h1>Bienvenid@ a<br/><strong>FESTOS Gestión</strong></h1>
          <h2>{nombre}</h2>
          <span className="home-role-pill"><FestosIcon name="ShieldCheck" size={15}/>{cargo}</span>
          <span className="home-ai-voice-disclosure">Voz de bienvenida generada por IA</span>
          <p>Tu espacio de trabajo está listo.<br/>Aquí puedes gestionar cotizaciones, compras, proveedores y hacer seguimiento de la rentabilidad de tus proyectos.</p>
        </div>
        <div className="home-hero-art" aria-hidden="true">
          <div className="home-art-sheet home-art-sheet-back"><span/><span/><span/></div>
          <div className="home-art-sheet home-art-sheet-front">
            <div className="home-art-bars"><i/><i/><i/><i/></div>
            <div className="home-art-checks"><b>✓</b><b>✓</b><b>✓</b></div>
          </div>
          <div className="home-art-trend"><FestosIcon name="ChartNoAxesColumnIncreasing" size={34}/></div>
          <blockquote>“Operaciones más simples,<br/>resultados más grandes.”</blockquote>
        </div>
      </section>

      <section className="home-stat-grid">
        {cards.map(card => <button key={card.key} type="button" className="home-stat-card" onClick={() => onNavigate(card.target)}>
          <span className={`home-icon tone-${card.tone}`}><FestosIcon name={card.icon} size={23}/></span>
          <span className="home-stat-copy"><small>{card.label}</small><strong>{cargando ? '—' : card.value}</strong><em>{card.caption}</em></span>
          <FestosIcon name="ChevronRight" size={18}/>
        </button>)}
      </section>

      <section className="home-lower-grid">
        <div className="home-panel">
          <div className="home-panel-head"><h3><FestosIcon name="FileText" size={20}/> Accesos rápidos</h3><button type="button" onClick={() => onNavigate('analisis')}>Ver todo <FestosIcon name="ChevronRight" size={15}/></button></div>
          <div className="home-quick-grid">
            {quick.map((item, idx) => <button key={`${item.label}-${idx}`} type="button" className={`home-quick-card tone-${item.tone}`} onClick={item.onClick}>
              <span><FestosIcon name={item.icon} size={24}/></span><strong>{item.label}</strong><FestosIcon name="ChevronRight" size={17}/>
            </button>)}
          </div>
        </div>

        <div className="home-panel home-activity-panel">
          <div className="home-panel-head"><h3><FestosIcon name="Clock3" size={20}/> Actividad reciente</h3><button type="button" onClick={() => onNavigate('compras')}>Ver todo <FestosIcon name="ChevronRight" size={15}/></button></div>
          <div className="home-activity-list">
            {!actividad.length && <p className="home-empty">{cargando ? 'Cargando actividad...' : 'Todavía no hay actividad reciente para mostrar.'}</p>}
            {actividad.map(item => <button key={item.id} type="button" onClick={() => onNavigate(item.destino)} className="home-activity-row">
              <span className={`home-activity-icon tone-${item.tone}`}><FestosIcon name={item.icono} size={17}/></span>
              <span><strong>{item.tipo}</strong><small>{item.detalle}</small></span>
              <time>{fechaCorta(item.fecha)}</time>
            </button>)}
          </div>
        </div>
      </section>
    </div>
  );
}
