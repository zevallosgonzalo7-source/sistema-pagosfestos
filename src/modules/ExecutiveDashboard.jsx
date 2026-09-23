import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { FestosIcon } from '../FestosIcon';
import { CATEGORIAS_FESTOS, CATEGORIA_PENDIENTE, categoriaActual, categoriaDelProyecto } from '../categories';
import { dateKey, dashboardDate, dashboardPeriodBounds, isInDashboardRange, localDateKey } from '../dashboardPeriod';

const money = value => `S/. ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = value => Number(value || 0);
const norm = value => String(value || '').trim().toLowerCase();

function InfoTip({ text }) {
  return <span className="ui-tip" tabIndex="0" data-tip={text} aria-label={text}>i</span>;
}

function MiniTrend({ values }) {
  const clean = values.map(num);
  if (!clean.length) return null;
  const w = 260, h = 58, pad = 4;
  const max = Math.max(...clean, 1);
  const points = clean.map((v, i) => `${pad + (i / Math.max(clean.length - 1, 1)) * (w - pad * 2)},${h - pad - (v / max) * (h - pad * 2)}`).join(' ');
  return <svg className="ed-kpi-mini-trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none"/><path d={`M ${points.replaceAll(' ', ' L ')} L ${w-pad},${h-pad} L ${pad},${h-pad} Z`} /></svg>;
}

function MonthlyHeatmap({ items, onPick }) {
  const max = Math.max(...items.map(x => num(x.value)), 1);
  return <div className="ed-heatmap">
    {items.map(item => {
      const level = num(item.value) / max;
      return <button key={item.key} type="button" className="ed-heat-cell ed-month-clickable" title={`Ver proyectos de ${item.label}: ${money(item.value)}`} style={{ '--heat': Math.max(.08, level) }} onClick={() => onPick?.(item.key)}>
        <span>{item.label}</span><strong>{item.value > 0 ? money(item.value) : '—'}</strong>
      </button>;
    })}
  </div>;
}

function DashboardSkeleton() {
  return <div className="ed-skeleton-wrap" aria-label="Cargando dashboard">
    <div className="ed-skeleton-filter sk"/>
    <div className="ed-skeleton-kpis">{Array.from({length:5},(_,i)=><div key={i} className={`ed-skeleton-kpi sk ${i===0?'main':''}`}><i/><b/><span/></div>)}</div>
    <div className="ed-skeleton-charts"><div className="sk"/><div className="sk"/><div className="sk"/></div>
  </div>;
}

function MiniBars({ items, moneyValues = true, empty = 'Sin datos para mostrar', onPick }) {
  const max = Math.max(...items.map(i => num(i.value)), 1);
  if (!items.length) return <div className="ed-empty">{empty}</div>;
  return (
    <div className="ed-bars">
      {items.map((item, index) => {
        const value = num(item.value);
        return (
          <div className={`ed-bar-row ${onPick ? 'ed-bar-clickable' : ''}`} key={`${item.label}-${index}`} role={onPick ? 'button' : undefined} tabIndex={onPick ? 0 : undefined} onClick={onPick ? () => onPick(item.label) : undefined} onKeyDown={onPick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(item.label); } } : undefined} title={onPick ? `Ver proyectos: ${item.label}` : undefined}>
            <div className="ed-bar-head">
              <span title={item.label}>{item.label}</span>
              <strong>{item.count !== undefined ? `${item.count} ${item.count === 1 ? 'proyecto' : 'proyectos'} · ` : ''}{moneyValues ? money(value) : value.toLocaleString('es-PE')}</strong>
            </div>
            <div className="ed-bar-track"><span style={{ width: `${value > 0 ? Math.max(3, (value / max) * 100) : 0}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function ExecutiveDonut({ items, onPick }) {
  const positive = items.filter(item => num(item.value) > 0);
  if (!positive.length) return <div className="ed-empty">No hay proyectos con valor en el período seleccionado.</div>;
  const total = positive.reduce((sum, item) => sum + num(item.value), 0);
  const radius = 47;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const colors = { GONZALO: '#4675dd', MAR: '#26a578' };
  const fallback = ['#d19b49', '#9268bd', '#dc8076', '#5c9ca7'];
  return <div className="ed-executive-donut-wrap" aria-label="Participación porcentual del valor de proyectos por ejecutivo comercial">
    <svg className="ed-executive-donut" viewBox="0 0 140 140" role="group" aria-label={positive.map(item => `${item.label}: ${(num(item.value) / total * 100).toFixed(1)} por ciento`).join(', ')}>
      <circle cx="70" cy="70" r={radius} fill="none" stroke="#e9f0ef" strokeWidth="19" />
      {positive.map((item, index) => {
        const arc = (num(item.value) / total) * circumference;
        const color = colors[String(item.label).toUpperCase()] || fallback[index % fallback.length];
        const circle = <circle key={item.label} className={onPick ? 'ed-donut-clickable' : ''} role={onPick ? 'button' : undefined} tabIndex={onPick ? 0 : undefined} onClick={onPick ? () => onPick(item.label) : undefined} onKeyDown={onPick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(item.label); } } : undefined} cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="19" strokeDasharray={`${arc} ${circumference - arc}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" strokeLinecap="butt"><title>{item.label}: {(num(item.value) / total * 100).toFixed(1)}% · {money(item.value)}</title></circle>;
        offset += arc;
        return circle;
      })}
      <text x="70" y="68" textAnchor="middle" className="ed-exec-center-top">100%</text>
      <text x="70" y="83" textAnchor="middle" className="ed-exec-center-bottom">DEL VALOR</text>
    </svg>
    <div className="ed-executive-legend">
      {positive.map((item, index) => {
        const color = colors[String(item.label).toUpperCase()] || fallback[index % fallback.length];
        return <div className={`ed-executive-legend-row ${onPick ? 'ed-bar-clickable' : ''}`} key={item.label} role={onPick ? 'button' : undefined} tabIndex={onPick ? 0 : undefined} onClick={onPick ? () => onPick(item.label) : undefined} onKeyDown={onPick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(item.label); } } : undefined} title={onPick ? `Ver proyectos de ${item.label}` : undefined}>
          <span className="ed-exec-color" style={{ backgroundColor: color }} />
          <div className="ed-exec-description"><strong>{item.label}</strong><small>{money(item.value)} · Valor sin IGV</small></div>
          <b>{(num(item.value) / total * 100).toFixed(1)}%</b>
        </div>;
      })}
    </div>
  </div>;
}

function Sparkline({ items, label = 'Evolución', onPickMonth }) {
  const [hovered, setHovered] = useState(null);
  if (!items.length) return <div className="ed-empty">Sin historial suficiente.</div>;
  const values = items.map(item => num(item.value));
  const width = 520, height = 150, pad = 10;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const dots = values.map((v, i) => ({
    x: pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2),
    y: height - pad - ((v - min) / range) * (height - pad * 2)
  }));
  return <div className="ed-trend-interactive">
    <svg className="ed-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label} onMouseLeave={() => setHovered(null)}>
      <line x1="10" x2="510" y1="140" y2="140" className="ed-chart-grid" />
      <line x1="10" x2="510" y1="75" y2="75" className="ed-chart-grid" />
      <polyline points={dots.map(p => `${p.x},${p.y}`).join(' ')} fill="none" className="ed-line" />
      {dots.map((dot, i) => <g key={items[i].key ?? i}>
        {hovered === i && <circle cx={dot.x} cy={dot.y} r="3" className="ed-dot-active" pointerEvents="none" />}
        <circle cx={dot.x} cy={dot.y} r="14" className="ed-dot-hit" fill="transparent" stroke="none" tabIndex="0" role="button"
          aria-label={`Ver proyectos de ${items[i].label}: ${money(items[i].value)}`}
          onMouseEnter={() => setHovered(i)} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)}
          onClick={() => onPickMonth?.(items[i].key)} onTouchStart={() => setHovered(i)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickMonth?.(items[i].key); } }} />
      </g>)}
    </svg>
    {hovered !== null && <div className="ed-trend-tooltip" role="status" style={{ left: `${Math.max(7, Math.min(93, dots[hovered].x / width * 100))}%`, top: `${Math.max(5, dots[hovered].y / height * 100)}%` }}>{money(items[hovered].value)}</div>}
  </div>;
}

function Donut({ segments, total, caption, onPick }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="ed-donut-wrap">
      <svg viewBox="0 0 120 120" className="ed-donut" role="group">
        <circle cx="60" cy="60" r={radius} fill="none" className="ed-donut-track" strokeWidth="13" />
        {segments.map(segment => {
          const pct = total ? num(segment.value) / total : 0;
          const dash = pct * circumference;
          const node = <circle key={segment.label} className={onPick ? 'ed-donut-clickable' : ''} role={onPick ? 'button' : undefined} tabIndex={onPick ? 0 : undefined} onClick={onPick ? () => onPick(segment.label) : undefined} onKeyDown={onPick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(segment.label); } } : undefined} cx="60" cy="60" r={radius} fill="none" stroke={segment.color} strokeWidth="13" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />;
          offset += dash;
          return node;
        })}
        <text x="60" y="57" textAnchor="middle" className="ed-donut-total">{total}</text>
        <text x="60" y="71" textAnchor="middle" className="ed-donut-caption">{caption}</text>
      </svg>
      <div className="ed-legend">
        {segments.map(s => <button type="button" className="ed-legend-action" key={s.label} disabled={!onPick} onClick={() => onPick?.(s.label)} title={`Ver proyectos: ${s.label}`}><span style={{ background: s.color }} /><span>{s.label}</span><strong>{s.value}</strong></button>)}
      </div>
    </div>
  );
}

function SalesDashboardPrototype() {
  const placeholders = ['Venta neta', 'Ticket promedio', 'Clientes activos', 'Conversión', 'Margen comercial', 'Meta mensual'];
  return (
    <div className="ed-sales-prototype">
      <div className="ed-prototype-banner">
        <div>
          <span>DISEÑO PREPARADO</span>
          <strong>Dashboard ventas</strong>
          <p>Esta vista queda lista visualmente para una futura integración. Por ahora no consulta ni calcula datos de ninguna tabla.</p>
        </div>
        <span className="ed-prototype-status">SIN CONEXIÓN DE DATOS</span>
      </div>

      <section className="ed-kpi-grid">
        {placeholders.map((label, index) => (
          <article className={`ed-kpi ${index === 0 ? 'ed-kpi-main' : ''}`} key={label}>
            <span>{label.toUpperCase()}</span>
            <strong>—</strong>
            <small>Disponible en una futura etapa</small>
          </article>
        ))}
      </section>

      <section className="ed-main-grid">
        <article className="ed-card ed-wide">
          <div className="ed-card-head"><div><span>TENDENCIA COMERCIAL</span><h2>Evolución de ventas</h2></div><small>Sin datos vinculados</small></div>
          <div className="ed-prototype-chart"><span /><span /><span /><span /><span /><span /><span /><span /></div>
          <div className="ed-prototype-axis"><span>Ene</span><span>Feb</span><span>Mar</span><span>Abr</span><span>May</span><span>Jun</span><span>Jul</span><span>Ago</span></div>
        </article>
        <article className="ed-card">
          <div className="ed-card-head"><div><span>PIPELINE</span><h2>Embudo comercial</h2></div></div>
          <div className="ed-prototype-funnel"><span /><span /><span /><span /></div>
        </article>
      </section>

      <section className="ed-main-grid">
        <article className="ed-card"><div className="ed-card-head"><div><span>CLIENTES</span><h2>Top clientes por venta</h2></div></div><div className="ed-prototype-list">{[1,2,3,4,5].map(i => <div key={i}><span /><strong /></div>)}</div></article>
        <article className="ed-card"><div className="ed-card-head"><div><span>EJECUTIVOS COMERCIALES</span><h2>Venta por ejecutivo comercial</h2></div></div><div className="ed-prototype-list">{[1,2,3,4,5].map(i => <div key={i}><span /><strong /></div>)}</div></article>
        <article className="ed-card"><div className="ed-card-head"><div><span>CATEGORÍAS</span><h2>Distribución de ventas</h2></div></div><div className="ed-prototype-ring"><div><strong>—</strong><span>VENTAS</span></div></div></article>
      </section>
    </div>
  );
}

export function ExecutiveDashboard({ onOpenAI, onOpenProjects = () => {}, tipo = 'proyectos' }) {
  const dashboardActivo = tipo === 'ventas' ? 'ventas' : 'proyectos';
  const [data, setData] = useState({ quotes: [], projects: [], clients: [] });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [periodo, setPeriodo] = useState('year');
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState(() => new Date().getMonth() + 1);
  const [trimestre, setTrimestre] = useState(() => Math.floor(new Date().getMonth() / 3) + 1);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filtroEjecutivo, setFiltroEjecutivo] = useState('TODOS');
  const [filtroLob, setFiltroLob] = useState('TODOS');
  const [filtrosMovilAbiertos, setFiltrosMovilAbiertos] = useState(false);

  const cargar = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const [qRes, pRes, cRes] = await Promise.all([
        supabase.from('cotizaciones').select('*, clientes(nombre)').order('created_at', { ascending: true }),
        supabase.from('proyectos').select('*, clientes(nombre)').order('created_at', { ascending: true }),
        supabase.from('clientes').select('*').order('nombre'),
      ]);
      const firstError = [qRes, pRes, cRes].find(r => r.error);
      if (firstError?.error) throw firstError.error;
      setData({ quotes: qRes.data || [], projects: pRes.data || [], clients: cRes.data || [] });
    } catch (err) {
      console.error('Dashboard general:', err);
      setErrorMessage(err?.message || 'No se pudieron cargar los datos del Dashboard proyectos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dashboardActivo !== 'proyectos') { setLoading(false); return; }
    cargar();
    const channel = supabase.channel('festos-dashboard-categorias-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, () => cargar())
      .subscribe();
    const refrescarAlVolver = () => { if (!document.hidden) cargar(); };
    document.addEventListener('visibilitychange', refrescarAlVolver);
    window.addEventListener('focus', refrescarAlVolver);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', refrescarAlVolver);
      window.removeEventListener('focus', refrescarAlVolver);
    };
  }, [dashboardActivo]);

  const limites = useMemo(() => dashboardPeriodBounds(periodo, {
    year: anio, month: mes, quarter: trimestre, from: desde, to: hasta
  }), [periodo, anio, mes, trimestre, desde, hasta]);
  const enRango = date => isInDashboardRange(date, limites);
  const projectDate = dashboardDate;
  const aniosDisponibles = useMemo(() => [...new Set([
    new Date().getFullYear(),
    ...data.projects.map(p => Number(dateKey(dashboardDate(p)).slice(0, 4))).filter(y => Number.isInteger(y) && y >= 1900)
  ])].sort((a, b) => b - a), [data.projects]);

  const quotes = useMemo(() => data.quotes.filter(q =>
    enRango(q.created_at) &&
    (filtroEjecutivo === 'TODOS' || String(q.created_by || '').trim().toUpperCase() === filtroEjecutivo) &&
    (filtroLob === 'TODOS' || String(q.lob || '') === filtroLob)
  ), [data.quotes, limites, filtroEjecutivo, filtroLob]);

  const projects = useMemo(() => data.projects.filter(p =>
    enRango(projectDate(p)) &&
    (filtroEjecutivo === 'TODOS' || String(p.ejecutivo || p.created_by || '').trim().toUpperCase() === filtroEjecutivo) &&
    (filtroLob === 'TODOS' || categoriaDelProyecto(p) === filtroLob)
  ), [data.projects, limites, filtroEjecutivo, filtroLob]);

  const quoteForProject = project => data.quotes.find(q =>
    q.project_id === project.id ||
    (String(q.proyecto_nombre || '').trim().toLowerCase() && String(q.proyecto_nombre || '').trim().toLowerCase() === String(project.nombre || '').trim().toLowerCase())
  );

  const projectValue = project => {
    const valorBase = num(project.valor_base);
    if (valorBase > 0) return valorBase;
    const valorVenta = num(project.valor_venta);
    if (valorVenta > 0) return valorVenta;
    return num(quoteForProject(project)?.subtotal);
  };
  const projectCost = project => {
    const direct = num(project.costo_estimado);
    return direct > 0 ? direct : num(quoteForProject(project)?.costo_estimado);
  };
  const projectProfit = project => {
    const direct = num(project.utilidad_proyectada);
    if (direct !== 0) return direct;
    const quoteProfit = num(quoteForProject(project)?.ganancia_estimada);
    if (quoteProfit !== 0) return quoteProfit;
    return projectValue(project) - projectCost(project);
  };

  const approved = useMemo(() => quotes.filter(q => ['aprobado', 'aprobada'].includes(norm(q.estado))), [quotes]);
  const inReview = useMemo(() => quotes.filter(q => norm(q.estado).includes('revisi')), [quotes]);
  const drafts = useMemo(() => quotes.filter(q => norm(q.estado) === 'borrador'), [quotes]);

  const valorProyectos = useMemo(() => projects.reduce((s, p) => s + projectValue(p), 0), [projects, data.quotes]);
  const costoProyectos = useMemo(() => projects.reduce((s, p) => s + projectCost(p), 0), [projects, data.quotes]);
  const utilidadProyectos = useMemo(() => projects.reduce((s, p) => s + projectProfit(p), 0), [projects, data.quotes]);
  const margenProyectos = valorProyectos > 0 ? (utilidadProyectos / valorProyectos) * 100 : 0;

  const clienteIds = useMemo(() => new Set(projects.map(p => p.client_id).filter(Boolean)), [projects]);
  const clientesVinculados = clienteIds.size;
  // Alertas basadas SOLO en fechas de entrega realmente registradas.
  const entregaDisponible = data.projects.some(p => Object.prototype.hasOwnProperty.call(p, 'fecha_entrega'));
  const hoyEntrega = localDateKey(new Date());
  const dias7 = new Date(); dias7.setDate(dias7.getDate() + 7);
  const sieteEntrega = `${dias7.getFullYear()}-${String(dias7.getMonth() + 1).padStart(2,'0')}-${String(dias7.getDate()).padStart(2,'0')}`;
  const entregaActiva = projects.filter(p => !['FINALIZADO','FACTURADO'].includes(String(p.estado || '').toUpperCase()) && p.fecha_entrega);
  const vencidos = entregaActiva.filter(p => String(p.fecha_entrega).slice(0,10) < hoyEntrega);
  const proximos = entregaActiva.filter(p => String(p.fecha_entrega).slice(0,10) >= hoyEntrega && String(p.fecha_entrega).slice(0,10) <= sieteEntrega);


  const ejecutivos = useMemo(() => [...new Set(
    data.projects.map(p => String(p.ejecutivo || p.created_by || '').trim().toUpperCase()).filter(Boolean)
      .concat(data.quotes.map(q => String(q.created_by || '').trim().toUpperCase()).filter(Boolean))
  )].sort(), [data.projects, data.quotes]);

  const proyectosPorEjecutivo = useMemo(() => {
    const map = {};
    projects.forEach(p => {
      const key = String(p.ejecutivo || p.created_by || 'Sin registro').trim().toUpperCase();
      map[key] = (map[key] || 0) + projectValue(p);
    });
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [projects, data.quotes]);

  // 9 categorías comerciales canónicas. Los LOB históricos no se convierten
  // automáticamente: quedan señalados como pendientes de clasificar.
  const hayPendientes = data.projects.some(p => categoriaDelProyecto(p) === CATEGORIA_PENDIENTE);
  const categoriasFiltro = [...CATEGORIAS_FESTOS, ...(hayPendientes ? [CATEGORIA_PENDIENTE] : [])];
  const proyectosPorLob = useMemo(() => categoriasFiltro.map(label => ({
    label,
    value: projects.filter(p => categoriaDelProyecto(p) === label).reduce((s, p) => s + projectValue(p), 0),
    count: projects.filter(p => categoriaDelProyecto(p) === label).length
  })), [projects, data.quotes, hayPendientes]);

  const topClientes = useMemo(() => {
    const map = {};
    projects.forEach(p => {
      const label = p.clientes?.nombre || data.clients.find(c => c.id === p.client_id)?.nombre || 'Cliente sin nombre';
      map[label] = (map[label] || 0) + projectValue(p);
    });
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [projects, data.clients, data.quotes]);

  const topProyectos = useMemo(() => projects.map(p => {
    const venta = projectValue(p);
    const costo = projectCost(p);
    const utilidad = projectProfit(p);
    return {
      label: p.nombre || p.codigo || 'Proyecto',
      codigo: p.codigo || '—',
      venta,
      costo,
      utilidad,
      margen: venta > 0 ? (utilidad / venta) * 100 : 0,
    };
  }).sort((a, b) => b.venta - a.venta).slice(0, 8), [projects, data.quotes]);

  // La evolución siempre presenta los 12 meses del año seleccionado (aun si
  // los indicadores superiores usan trimestre/mes/historial). Esto garantiza
  // que al pulsar un mes se abra exactamente el conjunto representado.
  const monthly = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({ key: i, label: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][i], value: 0 }));
    data.projects.forEach(p => {
      const fecha = dateKey(projectDate(p));
      if (!fecha.startsWith(`${anio}-`) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
      if (filtroEjecutivo !== 'TODOS' && String(p.ejecutivo || p.created_by || '').trim().toUpperCase() !== filtroEjecutivo) return;
      if (filtroLob !== 'TODOS' && categoriaDelProyecto(p) !== filtroLob) return;
      const m = Number(fecha.slice(5, 7)) - 1;
      if (m >= 0 && m < 12) months[m].value += projectValue(p);
    });
    return months;
  }, [data.projects, data.quotes, anio, filtroEjecutivo, filtroLob]);
  const valorAnualGrafico = monthly.reduce((s, item) => s + item.value, 0);

  const projectStatus = useMemo(() => {
    const normalizeProjectStatus = value => {
      const state = String(value || '').trim().toUpperCase();
      if (state === 'FINALIZADO') return 'Finalizados';
      if (state === 'FACTURADO') return 'Facturados';
      return 'En proceso';
    };
    const map = { 'En proceso': 0, Finalizados: 0, Facturados: 0 };
    projects.forEach(p => { map[normalizeProjectStatus(p.estado)] += 1; });
    return [
      { label: 'En proceso', value: map['En proceso'], color: '#224248' },
      { label: 'Finalizados', value: map.Finalizados, color: '#54757a' },
      { label: 'Facturados', value: map.Facturados, color: '#c99a38' },
    ];
  }, [projects]);

  const quoteSegments = [
    { label: 'Aprobadas', value: approved.length, color: '#224248' },
    { label: 'En revisión', value: inReview.length, color: '#c99a38' },
    { label: 'Borradores', value: drafts.length, color: '#9ba9ab' },
  ];

  // Pasamos el período actual a la lista, para que el enlace conserve el contexto visual.
  const irAProyectos = filtro => onOpenProjects({
    desde: limites.desde || '',
    hasta: limites.hasta || '',
    ejecutivo: filtroEjecutivo,
    categoria: filtroLob,
    ...filtro
  });

  // La fecha de pedido determina el mes. Se conservan categoría y ejecutivo,
  // pero se reemplaza el rango anterior por el mes pulsado (inclusive).
  const abrirMes = indice => {
    if (!Number.isInteger(indice) || indice < 0 || indice > 11) return;
    const mesElegido = indice + 1;
    const rangoMes = dashboardPeriodBounds('month', { year: anio, month: mesElegido });
    irAProyectos({ desde: rangoMes.desde, hasta: rangoMes.hasta });
  };

  const limpiar = () => {
    setPeriodo('year');
    setAnio(new Date().getFullYear());
    setMes(new Date().getMonth() + 1);
    setTrimestre(Math.floor(new Date().getMonth() / 3) + 1);
    setDesde('');
    setHasta('');
    setFiltroEjecutivo('TODOS');
    setFiltroLob('TODOS');
  };

  return (
    <div className="ed-page">
      <div className="ed-hero ed-general-hero">
        <div>
          <span className="ed-kicker">FESTOS · CONTROL Y VISIBILIDAD</span>
          <h1>{dashboardActivo === 'ventas' ? 'Dashboard ventas' : 'Dashboard proyectos'}</h1>
          <p>Indicadores de proyectos, cotizaciones y clientes, según la fecha de pedido comercial. Dashboard ventas permanece sin datos conectados.</p>
        </div>
        <div className="ed-hero-actions">
          
          {dashboardActivo === 'proyectos' && <button className="ed-refresh" type="button" onClick={cargar}><FestosIcon name="RefreshCw" size={16} /> Actualizar</button>}
        </div>
      </div>

      {dashboardActivo === 'ventas' ? <SalesDashboardPrototype /> : (
        <>
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              {errorMessage && <div className="ed-alert"><FestosIcon name="AlertTriangle" size={17} /> {errorMessage}</div>}

              <section className={`ed-filter-card ${filtrosMovilAbiertos ? "ed-filters-open" : "ed-filters-collapsed"}`}>
                <div className="ed-filter-title"><span>FILTROS DEL DASHBOARD</span><strong>Proyectos y cotizaciones</strong></div>
                <button type="button" className="ed-mobile-filter-toggle" aria-expanded={filtrosMovilAbiertos} onClick={() => setFiltrosMovilAbiertos(v => !v)}>{filtrosMovilAbiertos ? "Ocultar filtros" : "Ajustar filtros"} <FestosIcon name="ChevronDown" size={17} /></button>
                <div className="ed-filter-controls">
                  <select aria-label="Período del Dashboard" value={periodo} onChange={e => setPeriodo(e.target.value)}><option value="month">Por mes</option><option value="quarter">Por trimestre</option><option value="year">Por año</option><option value="all">Todo el historial</option><option value="custom">Personalizado</option></select>
                  {<select aria-label={['all', 'custom'].includes(periodo) ? 'Año del gráfico mensual' : 'Año'} value={anio} onChange={e => setAnio(Number(e.target.value))}>{aniosDisponibles.map(y => <option key={y} value={y}>{y}</option>)}</select>}
                  {periodo === 'month' && <select aria-label="Mes" value={mes} onChange={e => setMes(Number(e.target.value))}>{['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((nombre, i) => <option key={nombre} value={i+1}>{nombre}</option>)}</select>}
                  {periodo === 'quarter' && <select aria-label="Trimestre" value={trimestre} onChange={e => setTrimestre(Number(e.target.value))}>{[1,2,3,4].map(q => <option key={q} value={q}>Trimestre {q}</option>)}</select>}
                  {periodo === 'custom' && <><label className="ed-date-control">Desde <input aria-label="Desde" type="date" max={hasta || undefined} value={desde} onChange={e => setDesde(e.target.value)} /></label><label className="ed-date-control">Hasta <input aria-label="Hasta" type="date" min={desde || undefined} value={hasta} onChange={e => setHasta(e.target.value)} /></label></>}
                  <select aria-label="Ejecutivo comercial" value={filtroEjecutivo} onChange={e => setFiltroEjecutivo(e.target.value)}><option value="TODOS">Todos los ejecutivos comerciales</option>{ejecutivos.map(x => <option key={x} value={x}>{x}</option>)}</select>
                  <select aria-label="Categoría de proyecto" value={filtroLob} onChange={e => setFiltroLob(e.target.value)}><option value="TODOS">Todas las categorías</option>{categoriasFiltro.map(x => <option key={x} value={x}>{x}</option>)}</select>
                  <button type="button" onClick={limpiar}>Limpiar filtros</button>
                </div>
                <div className="ed-period-context">{periodo === 'all' ? 'Todo el historial disponible' : periodo === 'custom' && !desde && !hasta ? 'Sin límite de fechas' : `${limites.desde || 'Sin fecha inicial'} → ${limites.hasta || 'Hoy'}`} · Fecha de pedido del proyecto{periodo === 'custom' && desde && hasta && desde > hasta ? ' · La fecha inicial debe ser anterior a la final' : ''}</div>
              </section>
              {projects.length === 0 && data.projects.length > 0 && <div className="ed-period-empty" role="status">No hay proyectos con estos filtros. Comprueba las fechas de pedido o selecciona «Todo el historial» para ver todos los registros.</div>}

              <section className="ed-kpi-grid ed-summary-band">
                <article className="ed-kpi ed-kpi-main">
                  <div className="ed-kpi-label"><span>VALOR DE PROYECTOS</span><InfoTip text="Suma del valor sin IGV de todos los proyectos que cumplen los filtros actuales." /></div>
                  <strong>{money(valorProyectos)}</strong><small>Valor sin IGV · {projects.length} proyectos filtrados</small>
                </article>
                <article className="ed-kpi"><div className="ed-kpi-label"><span>UTILIDAD PROYECTADA</span><InfoTip text="Utilidad estimada de los proyectos dentro del período seleccionado." /></div><strong>{money(utilidadProyectos)}</strong><small>Margen estimado {margenProyectos.toFixed(1)}%</small></article>
                <article className="ed-kpi"><div className="ed-kpi-label"><span>COSTO ESTIMADO</span><InfoTip text="Costo estimado acumulado de los proyectos filtrados." /></div><strong>{money(costoProyectos)}</strong><small>Proyectos dentro del filtro</small></article>
                <article className="ed-kpi"><div className="ed-kpi-label"><span>PROYECTOS</span><InfoTip text="Cantidad de proyectos que cumplen fecha de pedido, ejecutivo comercial y categoría seleccionados." /></div><strong>{projects.length}</strong><small>Registros del período seleccionado</small></article>
                <article className="ed-kpi"><div className="ed-kpi-label"><span>CLIENTES VINCULADOS</span><InfoTip text="Clientes únicos presentes en los proyectos filtrados." /></div><strong>{clientesVinculados}</strong><small>Clientes presentes en los proyectos</small></article>
              </section>

              <section className="ed-operational-alerts" aria-label="Seguimiento de fechas de proyectos">
                <div><span>SEGUIMIENTO DE PROYECTOS</span><h2>Entregas y vencimientos</h2><small>{entregaDisponible ? 'Alertas calculadas con fechas de entrega registradas.' : 'No hay fechas de entrega configuradas. Las fechas de registro no se usan como vencimientos.'}</small></div>
                <button className="ed-alert-link" type="button" disabled={!entregaDisponible} onClick={() => irAProyectos({ entrega: 'VENCIDOS' })}><strong>{entregaDisponible ? vencidos.length : '—'}</strong><span>Proyectos vencidos ↗</span></button>
                <button className="ed-alert-link" type="button" disabled={!entregaDisponible} onClick={() => irAProyectos({ entrega: 'PROXIMOS_7' })}><strong>{entregaDisponible ? proximos.length : '—'}</strong><span>Próximos 7 días ↗</span></button>
              </section>

              <section className="ed-main-grid">
                <article className="ed-card ed-wide">
                  <div className="ed-card-head"><div><span>EVOLUCIÓN DE PROYECTOS · {anio}</span><h2>Valor de proyectos por mes</h2><small>Selecciona un mes o un punto para ver sus proyectos</small></div><strong>{money(valorAnualGrafico)}</strong></div>
                  <Sparkline items={monthly} label={`Valor de proyectos por mes de ${anio}`} onPickMonth={abrirMes} />
                  <div className="ed-month-labels" aria-label={`Meses de ${anio}`}>{monthly.map(m => <button key={m.key} type="button" className="ed-month-link" onClick={() => abrirMes(m.key)} title={`Ver proyectos de ${m.label} de ${anio}`}>{m.label}</button>)}</div>
                </article>
                <article className="ed-card">
                  <div className="ed-card-head"><div><span>OPERACIÓN</span><h2>Estado de proyectos</h2></div></div>
                  <Donut segments={projectStatus} total={projects.length} caption="PROYECTOS" onPick={label => irAProyectos({ estado: ({ 'En proceso': 'EN PROCESO', Finalizados: 'FINALIZADO', Facturados: 'FACTURADO' })[label] })} />
                </article>
              </section>

              {/* Columnas independientes: la altura del gráfico de categorías no deja huecos bajo ejecutivos. */}
              <section className="ed-dashboard-columns" aria-label="Participación, categorías y principales proyectos">
                <div className="ed-dashboard-column">
                  <article className="ed-card ed-executive-card"><div className="ed-card-head"><div><span>EJECUTIVOS COMERCIALES</span><h2>Participación por ejecutivo comercial</h2></div><small>Porcentaje del valor sin IGV</small></div><ExecutiveDonut items={proyectosPorEjecutivo} onPick={ejecutivo => irAProyectos({ ejecutivo })} /></article>
                  <article className="ed-card">
                    <div className="ed-card-head"><div><span>PROYECTOS</span><h2>Principales proyectos por valor</h2></div><small>Valor sin IGV</small></div>
                    <div className="ed-project-table">
                      <div className="ed-project-row ed-project-head"><span>Proyecto</span><span>Valor proyecto</span><span>Costo</span><span>Utilidad</span><span>Margen</span></div>
                      {topProyectos.length ? topProyectos.map((p, i) => <div className="ed-project-row" key={`${p.codigo}-${i}`}><strong title={`${p.codigo} · ${p.label}`}>{p.label}</strong><span>{money(p.venta)}</span><span>{money(p.costo)}</span><span className="ed-profit">{money(p.utilidad)}</span><span className="ed-margin">{p.margen.toFixed(1)}%</span></div>) : <div className="ed-empty">No hay proyectos en el filtro actual.</div>}
                    </div>
                  </article>
                </div>
                <div className="ed-dashboard-column">
                  <article className="ed-card"><div className="ed-card-head"><div><span>CATEGORÍAS</span><h2>Valor por categoría</h2></div><small>Ocho categorías comerciales · Los proyectos históricos sin categoría quedan por separado</small></div><MiniBars items={proyectosPorLob} onPick={categoria => irAProyectos({ categoria })} /></article>
                  <article className="ed-card"><div className="ed-card-head"><div><span>CLIENTES</span><h2>Top clientes por proyectos</h2></div></div><MiniBars items={topClientes} /></article>
                </div>
              </section>

              <section className="ed-main-grid ed-bottom-grid">

                <article className="ed-card ed-heatmap-card">
                  <div className="ed-card-head"><div><span>INTENSIDAD MENSUAL</span><h2>Mapa de proyectos</h2></div><small>Más oscuro = mayor valor</small></div>
                  <MonthlyHeatmap items={monthly} onPick={abrirMes} />
                </article>

              </section>

              <div className="ed-footnote">Dashboard proyectos consulta Cotizaciones, Proyectos y Clientes. Los filtros de fecha se basan en la fecha de pedido; cuando no existe se utiliza la fecha de creación como respaldo. Los importes se presentan sin IGV.</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
