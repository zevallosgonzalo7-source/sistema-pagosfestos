import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import FestosIcon from '../FestosIcon';
import SearchableSelect from '../components/SearchableSelect';

const money = value => `S/. ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = value => Number(value || 0);
const norm = value => String(value || '').trim().toLowerCase();
const hasAttachment = c => !!(c?.pdf_factura_path || c?.xml_factura_path || c?.ctz_path);
const requiresAttachment = c => ['FACTURA', 'RECIBO POR HONORARIOS'].includes(String(c?.tipo_comprobante || '').toUpperCase());
const missingRequiredAttachment = c => requiresAttachment(c) && !hasAttachment(c);
const purchaseValue = c => num(c?.monto_base ?? c?.monto ?? 0);
const normalizeProjectKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function DonutCeCo({ items, total, onPick }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const colors = ['#224248','#5e7d82','#86a2a6','#b2c4c7','#d8e1e3','#8f9fa2'];

  return <div className="pdb-donut-layout">
    <div className="pdb-donut-wrap">
      <svg className="pdb-donut" viewBox="0 0 140 140" role="img" aria-label="Distribución de compras por CeCo">
        <circle cx="70" cy="70" r={radius} className="pdb-donut-track"/>
        {items.map(([label, value], i) => {
          const fraction = total > 0 ? value / total : 0;
          const dash = fraction * circumference;
          const current = offset;
          offset += dash;
          return <circle
            key={label}
            cx="70" cy="70" r={radius}
            className="pdb-donut-segment"
            style={{
              stroke: colors[i % colors.length],
              strokeDasharray: `${dash} ${Math.max(0, circumference - dash)}`,
              strokeDashoffset: -current
            }}
          >
            <title>{`${label}: ${money(value)} · ${(fraction * 100).toFixed(1)}%`}</title>
          </circle>;
        })}
      </svg>
      <div className="pdb-donut-center"><span>CeCo</span><strong>{money(total)}</strong><small>Total filtrado</small></div>
    </div>
    <div className="pdb-donut-legend">
      {items.length ? items.map(([label, value], i) => {
        const pct = total > 0 ? (value / total) * 100 : 0;
        return <button type="button" key={label} onClick={() => onPick(label)} title={`Filtrar por ${label}`}>
          <i style={{ background: colors[i % colors.length] }}/>
          <span>{label}</span>
          <strong>{pct.toFixed(1)}%</strong>
          <small>{money(value)}</small>
        </button>;
      }) : <div className="pdb-empty-chart"><div><strong>0 compras</strong><span>La distribución por CeCo aparecerá cuando registres compras.</span></div></div>}
    </div>
  </div>;
}

function BarList({ items, onPick, empty = 'Todavía no hay compras registradas.' }) {
  const max = Math.max(1, ...items.map(x => x[1]));
  return <div className="pdb-bars">
    {items.length ? items.map(([label, value]) => <button type="button" className="pdb-bar-row" key={label} onClick={() => onPick?.(label)}>
      <div><span>{label}</span><strong>{money(value)}</strong></div>
      <i><b style={{ width: `${Math.max(3, (value / max) * 100)}%` }}/></i>
    </button>) : <div className="pdb-empty-chart"><div><strong>S/. 0.00</strong><span>{empty}</span><div className="pdb-zero-bars"><i/><i/><i/></div></div></div>}
  </div>;
}

export function PurchaseDashboard({ onOpenPurchases = () => {} }) {
  const [compras, setCompras] = useState([]);
  const [proyectosCatalogo, setProyectosCatalogo] = useState([]);
  const [proyectosGenerales, setProyectosGenerales] = useState([]);
  const [proveedoresCatalogo, setProveedoresCatalogo] = useState([]);
  const [cecoCatalogo, setCecoCatalogo] = useState([]);
  const [lobCatalogo, setLobCatalogo] = useState([]);
  const [categoriaCatalogo, setCategoriaCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroProyecto, setFiltroProyecto] = useState('TODOS');
  const [filtroProveedor, setFiltroProveedor] = useState('TODOS');
  const [filtroCeCo, setFiltroCeCo] = useState('TODOS');
  const [filtroLob, setFiltroLob] = useState('TODOS');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
  const [filtroComprobante, setFiltroComprobante] = useState('TODOS');
  const [filtroAdjunto, setFiltroAdjunto] = useState('TODOS');

  const cargar = async () => {
    setLoading(true);
    setError('');
    const [comprasRes, proyectosRes, generalesRes, proveedoresRes, cecoRes, lobRes, categoriaRes] = await Promise.all([
      supabase.from('compras').select('*, proyectos(id,codigo,nombre,lob), proveedores(id,nombre,nombre_comercial,ruc_documento)').order('fecha_compra', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('proyectos').select('id,codigo,nombre,estado').order('created_at', { ascending: false }),
      supabase.from('compras_proyectos_generales').select('id,nombre,activo').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('id,nombre,nombre_comercial,ruc_documento,estado').order('nombre'),
      supabase.from('compras_ceco_catalogo').select('nombre,orden').eq('activo', true).order('orden').order('nombre'),
      supabase.from('compras_lob_catalogo').select('nombre,orden').eq('activo', true).order('orden').order('nombre'),
      supabase.from('compras_categoria_gasto_catalogo').select('nombre,orden').eq('activo', true).order('orden').order('nombre')
    ]);
    if (comprasRes.error) setError(comprasRes.error.message); else setCompras(comprasRes.data || []);
    if (!proyectosRes.error) setProyectosCatalogo(proyectosRes.data || []);
    if (!generalesRes.error) setProyectosGenerales(generalesRes.data || []);
    if (!proveedoresRes.error) setProveedoresCatalogo(proveedoresRes.data || []);
    if (!cecoRes.error) setCecoCatalogo((cecoRes.data || []).map(x => x.nombre));
    if (!lobRes.error) setLobCatalogo((lobRes.data || []).map(x => x.nombre));
    if (!categoriaRes.error) setCategoriaCatalogo((categoriaRes.data || []).map(x => x.nombre));
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    const ch = supabase.channel(`festos-dashboard-compras-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compras' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const proyectos = useMemo(() => proyectosCatalogo.map(p => [String(p.id), `${p.codigo || 'PRY'} · ${p.nombre || 'Proyecto'}`]), [proyectosCatalogo]);
  const proyectosGeneralesOpciones = useMemo(() => proyectosGenerales.map(p => [`GENERAL:${p.nombre}`, p.nombre]), [proyectosGenerales]);
  const proveedores = useMemo(() => proveedoresCatalogo.filter(p => p.estado !== false).map(p => [String(p.id), p.nombre_comercial ? `${p.nombre_comercial} · ${p.nombre}` : p.nombre]), [proveedoresCatalogo]);
  const unique = key => [...new Set(compras.map(c => String(c[key] || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
  const cecos = useMemo(() => cecoCatalogo.length ? cecoCatalogo : unique('ceco'), [compras, cecoCatalogo]);
  const lobs = useMemo(() => lobCatalogo.length ? lobCatalogo : unique('lob'), [compras, lobCatalogo]);
  const categorias = useMemo(() => categoriaCatalogo.length ? categoriaCatalogo : unique('categoria_gasto'), [compras, categoriaCatalogo]);
  const comprobantes = useMemo(() => unique('tipo_comprobante'), [compras]);

  const filtradas = useMemo(() => compras.filter(c => {
    const fecha = String(c.fecha_compra || '').slice(0,10);
    const projectKey = c.project_id ? String(c.project_id) : (c.proyecto_texto ? `GENERAL:${c.proyecto_texto}` : 'SIN_PROYECTO');
    const providerKey = c.proveedor_id ? String(c.proveedor_id) : `TXT:${c.proveedor_nombre || ''}`;
    const adj = hasAttachment(c);
    return (!fechaDesde || fecha >= fechaDesde) &&
      (!fechaHasta || fecha <= fechaHasta) &&
      (filtroProyecto === 'TODOS' || (String(filtroProyecto).startsWith('GENERAL:') ? normalizeProjectKey(projectKey) === normalizeProjectKey(filtroProyecto) : projectKey === filtroProyecto) || (filtroProyecto === 'SIN_PROYECTO' && projectKey === 'SIN_PROYECTO')) &&
      (filtroProveedor === 'TODOS' || providerKey === filtroProveedor) &&
      (filtroCeCo === 'TODOS' || String(c.ceco || '') === filtroCeCo) &&
      (filtroLob === 'TODOS' || String(c.lob || '') === filtroLob) &&
      (filtroCategoria === 'TODAS' || String(c.categoria_gasto || '') === filtroCategoria) &&
      (filtroComprobante === 'TODOS' || String(c.tipo_comprobante || '') === filtroComprobante) &&
      (filtroAdjunto === 'TODOS' || (filtroAdjunto === 'CON' ? adj : missingRequiredAttachment(c)));
  }), [compras, fechaDesde, fechaHasta, filtroProyecto, filtroProveedor, filtroCeCo, filtroLob, filtroCategoria, filtroComprobante, filtroAdjunto]);

  const resumen = useMemo(() => {
    const valor = filtradas.reduce((s,c) => s + purchaseValue(c), 0);
    const credito = filtradas.reduce((s,c) => s + (c.genera_credito_fiscal ? num(c.igv_monto) : 0), 0);
    const precio = filtradas.reduce((s,c) => s + num(c.monto), 0);
    return {
      valor,
      credito,
      precio,
      cantidad: filtradas.length,
      sinAdjunto: filtradas.filter(missingRequiredAttachment).length,
      proveedores: new Set(filtradas.map(c => c.proveedor_id || c.proveedor_nombre).filter(Boolean)).size
    };
  }, [filtradas]);

  const aggregate = (key, fallback = 'Sin clasificar') => {
    const map = new Map();
    filtradas.forEach(c => {
      const label = String(c[key] || '').trim() || fallback;
      map.set(label, (map.get(label) || 0) + purchaseValue(c));
    });
    return [...map.entries()].sort((a,b) => b[1] - a[1]);
  };

  const categoriaData = aggregate('categoria_gasto').slice(0,8);
  const cecoData = aggregate('ceco', 'Sin CeCo');
  const lobData = aggregate('lob', 'Sin LOB').slice(0,8);

  const proveedorData = useMemo(() => {
    const map = new Map();
    filtradas.forEach(c => {
      const label = c.proveedores?.nombre || c.proveedor_nombre || 'Sin proveedor';
      const current = map.get(label) || { value: 0, count: 0 };
      current.value += purchaseValue(c);
      current.count += 1;
      map.set(label, current);
    });
    return [...map.entries()].sort((a,b) => b[1].value - a[1].value).slice(0,7);
  }, [filtradas]);

  const monthlyData = useMemo(() => {
    const map = new Map();
    filtradas.forEach(c => {
      const key = String(c.fecha_compra || '').slice(0,7);
      if (!key) return;
      map.set(key, (map.get(key) || 0) + purchaseValue(c));
    });
    return [...map.entries()].sort((a,b) => a[0].localeCompare(b[0])).slice(-12);
  }, [filtradas]);
  const maxMonth = Math.max(1, ...monthlyData.map(x => x[1]));

  const recent = filtradas.slice(0,6);

  const limpiar = () => {
    setFechaDesde(''); setFechaHasta('');
    setFiltroProyecto('TODOS'); setFiltroProveedor('TODOS');
    setFiltroCeCo('TODOS'); setFiltroLob('TODOS');
    setFiltroCategoria('TODAS'); setFiltroComprobante('TODOS');
    setFiltroAdjunto('TODOS');
  };

  return <div className="purchase-dashboard ed-page">
    <div className="ed-hero ed-general-hero">
      <div>
        <span className="ed-kicker">FESTOS · COMPRAS Y CONTROL</span>
        <h1>Dashboard compras</h1>
        <p>Control financiero, documental y operativo del Registro de Compras.</p>
      </div>
      <div className="ed-hero-actions">
        <button className="ed-dashboard-export" type="button" onClick={() => onOpenPurchases({})}><FestosIcon name="ClipboardList" size={16}/> Registro de compras</button>
        <button className="ed-refresh" type="button" onClick={cargar}><FestosIcon name="RefreshCw" size={16}/> Actualizar</button>
      </div>
    </div>

    <section className="ed-filter-card pdb-filter-card">
      <div className="ed-filter-title"><span>FILTROS DEL DASHBOARD</span><strong>Registro de compras</strong></div>
      <div className="ed-filter-controls pdb-filter-controls">
        <label className="ed-date-control">Desde <input type="date" value={fechaDesde} max={fechaHasta || undefined} onChange={e => setFechaDesde(e.target.value)}/></label>
        <label className="ed-date-control">Hasta <input type="date" value={fechaHasta} min={fechaDesde || undefined} onChange={e => setFechaHasta(e.target.value)}/></label>

        <SearchableSelect value={filtroCeCo} onChange={setFiltroCeCo} ariaLabel="CeCo" options={[{value:'TODOS',label:'Todos los CeCo'},...cecos.map(x => ({value:x,label:x}))]}/>
        <SearchableSelect value={filtroCategoria} onChange={value => { setFiltroCategoria(value); setFiltroProyecto('TODOS'); }} ariaLabel="Categoría de gasto" options={[{value:'TODAS',label:'Todas las categorías de gasto'},...categorias.map(x => ({value:x,label:x}))]}/>
        <SearchableSelect value={filtroLob} onChange={setFiltroLob} ariaLabel="LOB" options={[{value:'TODOS',label:'Todos los LOB'},...lobs.map(x => ({value:x,label:x}))]}/>
        <SearchableSelect value={filtroProyecto} onChange={setFiltroProyecto} ariaLabel="Proyecto" options={[
          {value:'TODOS',label:normalizeProjectKey(filtroCategoria) === 'costos directos' ? 'Todos los PRY' : 'Todos los proyectos generales'},
          {value:'SIN_PROYECTO',label:'Sin proyecto'},
          ...(normalizeProjectKey(filtroCategoria) === 'costos directos' ? proyectos : proyectosGeneralesOpciones).map(([value,label]) => ({value,label}))
        ]}/>
        <SearchableSelect value={filtroProveedor} onChange={setFiltroProveedor} ariaLabel="Proveedor" options={[{value:'TODOS',label:'Todos los proveedores'},...proveedores.map(([value,label]) => ({value,label}))]}/>

        <select aria-label="Tipo de comprobante" value={filtroComprobante} onChange={e => setFiltroComprobante(e.target.value)}><option value="TODOS">Todos los comprobantes</option>{comprobantes.map(x => <option key={x} value={x}>{x}</option>)}</select>
        <select aria-label="Adjuntos" value={filtroAdjunto} onChange={e => setFiltroAdjunto(e.target.value)}><option value="TODOS">Todos los adjuntos</option><option value="CON">Con adjunto</option><option value="SIN">Sin adjunto obligatorio</option></select>

        <button type="button" onClick={limpiar}>Limpiar filtros</button>
      </div>
      <div className="ed-period-context">{filtradas.length} compras visibles · Los indicadores y gráficos responden a estos filtros.</div>
    </section>

    {error && <div className="ed-alert"><FestosIcon name="AlertTriangle" size={17}/> {error}</div>}
    {loading ? <div className="glass-card purchase-dashboard-loading">Cargando compras…</div> : <>
      <section className="pdb-section-intro">
        <div><span>RESUMEN EJECUTIVO</span><h2>Indicadores de compras</h2></div>
        <small>Vista consolidada según los filtros seleccionados</small>
      </section>

      <section className="pdb-executive-panel">
        <article className="pdb-executive-main">
          <div className="pdb-executive-value">
            <div className="ed-kpi-label"><span>VALOR COMPRA</span></div>
            <strong>{money(resumen.valor)}</strong>
            <small>Base sin IGV · {resumen.cantidad} compras filtradas</small>
          </div>

          <div className="pdb-executive-metrics">
            <div className="pdb-executive-metric">
              <span>CRÉDITO FISCAL</span>
              <strong>{money(resumen.credito)}</strong>
              <small>Solo comprobantes que generan crédito fiscal</small>
            </div>
            <div className="pdb-executive-metric">
              <span>PRECIO DE COMPRA</span>
              <strong>{money(resumen.precio)}</strong>
              <small>Total final registrado</small>
            </div>
            <div className="pdb-executive-metric">
              <span>COMPRAS</span>
              <strong>{resumen.cantidad}</strong>
              <small>Registros dentro del filtro</small>
            </div>
          </div>

          <button type="button" className="pdb-primary-warning" onClick={() => { setFiltroAdjunto('SIN'); onOpenPurchases({ sinAdjunto: true }); }}>
            <span className="pdb-warning-icon"><FestosIcon name="AlertTriangle" size={17}/></span>
            <span className="pdb-warning-copy"><b>Sin adjunto</b><small>Factura / recibo por honorarios</small></span>
            <strong>{resumen.sinAdjunto}</strong>
          </button>
        </article>
      </section>

      <section className="pdb-section-intro pdb-analysis-title">
        <div><span>ANÁLISIS DE COMPRAS</span><h2>Distribución y comportamiento</h2></div>
        <small>Haz clic en los gráficos para filtrar la información</small>
      </section>

      <section className="ed-main-grid pdb-main-grid">
        <article className="ed-card pdb-card">
          <div className="ed-card-head"><div><span className="pdb-card-kicker">DISTRIBUCIÓN</span><h2>Compras por CeCo</h2></div><strong>{money(resumen.valor)}</strong></div>
          <DonutCeCo items={cecoData} total={resumen.valor} onPick={label => setFiltroCeCo(label === 'Sin CeCo' ? 'TODOS' : label)}/>
        </article>

        <article className="ed-card pdb-card">
          <div className="ed-card-head"><div><span className="pdb-card-kicker">CATEGORÍA DE GASTO</span><h2>¿Dónde se concentra la compra?</h2></div></div>
          <BarList items={categoriaData} onPick={setFiltroCategoria}/>
        </article>

        <article className="ed-card pdb-card">
          <div className="ed-card-head"><div><span className="pdb-card-kicker">LÍNEA DE NEGOCIO</span><h2>Valor por LOB</h2></div></div>
          <BarList items={lobData} onPick={label => setFiltroLob(label === 'Sin LOB' ? 'TODOS' : label)}/>
        </article>

        <article className="ed-card pdb-card">
          <div className="ed-card-head"><div><span className="pdb-card-kicker">PROVEEDORES</span><h2>Top proveedores</h2></div></div>
          <div className="pdb-provider-list">
            {proveedorData.length ? proveedorData.map(([label, data], i) => <div className="pdb-provider-row" key={label}>
              <span className="pdb-rank">{String(i+1).padStart(2,'0')}</span>
              <div><strong>{label}</strong><small>{data.count} compra{data.count === 1 ? '' : 's'}</small></div>
              <b>{money(data.value)}</b>
            </div>) : <div className="pdb-empty-chart"><div><strong>0 proveedores</strong><span>Aquí aparecerán los proveedores utilizados.</span></div></div>}
          </div>
        </article>

        <article className="ed-card ed-wide pdb-card pdb-month-card">
          <div className="ed-card-head"><div><span className="pdb-card-kicker">EVOLUCIÓN</span><h2>Valor de compra por mes</h2></div><strong>Últimos 12 meses con actividad</strong></div>
          <div className="pdb-month-bars">
            {monthlyData.length ? monthlyData.map(([month,value]) => {
              const [y,m] = month.split('-');
              const label = new Intl.DateTimeFormat('es-PE',{month:'short'}).format(new Date(Number(y), Number(m)-1, 1)).replace('.','');
              return <button type="button" key={month} title={`${month}: ${money(value)}`} onClick={() => { setFechaDesde(`${month}-01`); const last = new Date(Number(y), Number(m), 0).getDate(); setFechaHasta(`${month}-${String(last).padStart(2,'0')}`); }}>
                <i style={{height:`${Math.max(6,(value/maxMonth)*100)}%`}}/><span>{label}</span><small>{money(value)}</small>
              </button>;
            }) : <div className="pdb-empty-chart"><div><strong>S/. 0.00</strong><span>La evolución mensual aparecerá cuando registres la primera compra.</span></div></div>}
          </div>
        </article>

        <article className="ed-card ed-wide pdb-card">
          <div className="ed-card-head"><div><span className="pdb-card-kicker">ACTIVIDAD RECIENTE</span><h2>Últimas compras</h2></div><button type="button" className="pdb-link-button" onClick={() => onOpenPurchases({})}>Ver registro completo</button></div>
          <div className="pdb-recent-table">
            {recent.length ? recent.map(c => <div className="pdb-recent-row" key={c.id}>
              <div><strong>{c.codigo || 'COMPRA'}</strong><span>{c.descripcion || 'Sin descripción'}</span></div>
              <div><span>{c.proveedores?.nombre || c.proveedor_nombre || 'Sin proveedor'}</span><small>{c.categoria_gasto || 'Sin categoría de gasto'}</small></div>
              <div><b>{money(purchaseValue(c))}</b><small>{c.fecha_compra || '—'}</small></div>
            </div>) : <div className="pdb-empty-chart"><div><strong>0 compras registradas</strong><span>Las compras recientes aparecerán aquí automáticamente.</span></div></div>}
          </div>
        </article>
      </section>
    </>}
  </div>;
}
