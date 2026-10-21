import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import FestosIcon from '../FestosIcon';
import SearchableSelect from '../components/SearchableSelect';

const money = value => `S/. ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const norm = value => String(value || '').trim().toLowerCase();
const accountLabel = code => code === 'INTERBANK' ? 'CAJA IBK' : code === 'CAJA_CHICA' ? 'CAJA CHICA' : code;

export function CashModule({ usuario = '', initialAccount = 'INTERBANK', onNotify = () => {}, onAudit = () => {} }) {
  const [cuentas, setCuentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cuentaFiltro, setCuentaFiltro] = useState(initialAccount || 'TODAS');
  const [tipoFiltro, setTipoFiltro] = useState('TODOS');
  const [origenFiltro, setOrigenFiltro] = useState('TODOS');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(false);
  const [saldoModal, setSaldoModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fecha: today(), cuenta_codigo: initialAccount || 'INTERBANK', tipo: 'EGRESO', origen: 'COMPRA',
    monto: '', concepto: '', compra_id: '', proyecto_texto: '', tercero_nombre: '', documento: '', observaciones: '', destino_codigo: 'CAJA_CHICA'
  });

  useEffect(() => {
    if (initialAccount) {
      setCuentaFiltro(initialAccount);
      setForm(prev => ({ ...prev, cuenta_codigo: initialAccount, destino_codigo: initialAccount === 'INTERBANK' ? 'CAJA_CHICA' : 'INTERBANK' }));
    }
  }, [initialAccount]);

  const cargar = async () => {
    setLoading(true); setError('');
    const [cRes, mRes, coRes] = await Promise.all([
      supabase.from('caja_cuentas').select('*').eq('activo', true).order('orden').order('nombre'),
      supabase.from('caja_movimientos').select('*, caja_cuentas!caja_movimientos_cuenta_id_fkey(id,codigo,nombre), compras(id,codigo,descripcion,proveedor_nombre,monto,monto_base,project_id,proyecto_texto,proyectos(codigo,nombre))').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('compras').select('id,codigo,fecha_compra,descripcion,proveedor_nombre,monto,monto_base,project_id,proyecto_texto,proyectos(codigo,nombre)').order('fecha_compra', { ascending: false }).limit(1500)
    ]);
    if (cRes.error) setError(cRes.error.message); else setCuentas(cRes.data || []);
    if (mRes.error) setError(prev => prev || mRes.error.message); else setMovimientos(mRes.data || []);
    if (!coRes.error) setCompras(coRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    const ch = supabase.channel(`festos-caja-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caja_movimientos' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caja_cuentas' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const cuentaByCode = code => cuentas.find(c => c.codigo === code);
  const saldoCuenta = cuenta => Number(cuenta?.saldo_inicial || 0) + movimientos
    .filter(m => m.cuenta_id === cuenta?.id)
    .reduce((acc, m) => acc + (m.tipo === 'INGRESO' ? Number(m.monto || 0) : -Number(m.monto || 0)), 0);

  const resumen = useMemo(() => cuentas.map(c => {
    const movs = movimientos.filter(m => m.cuenta_id === c.id);
    const ingresos = movs.filter(m => m.tipo === 'INGRESO').reduce((s,m) => s + Number(m.monto || 0), 0);
    const egresos = movs.filter(m => m.tipo === 'EGRESO').reduce((s,m) => s + Number(m.monto || 0), 0);
    return { ...c, ingresos, egresos, saldo: Number(c.saldo_inicial || 0) + ingresos - egresos };
  }), [cuentas, movimientos]);

  const filtrados = useMemo(() => movimientos.filter(m => {
    const code = m.caja_cuentas?.codigo || cuentaByCode(m.cuenta_codigo)?.codigo || '';
    if (cuentaFiltro !== 'TODAS' && code !== cuentaFiltro) return false;
    if (tipoFiltro !== 'TODOS' && m.tipo !== tipoFiltro) return false;
    if (origenFiltro !== 'TODOS' && m.origen !== origenFiltro) return false;
    if (fechaDesde && String(m.fecha || '') < fechaDesde) return false;
    if (fechaHasta && String(m.fecha || '') > fechaHasta) return false;
    if (busqueda) {
      const hay = [m.concepto,m.tercero_nombre,m.documento,m.proyecto_texto,m.observaciones,m.compras?.codigo,m.compras?.descripcion].map(norm).join(' ');
      if (!hay.includes(norm(busqueda))) return false;
    }
    return true;
  }), [movimientos, cuentaFiltro, tipoFiltro, origenFiltro, fechaDesde, fechaHasta, busqueda, cuentas]);

  const totalesFiltrados = useMemo(() => ({
    ingresos: filtrados.filter(m => m.tipo === 'INGRESO').reduce((s,m) => s + Number(m.monto || 0), 0),
    egresos: filtrados.filter(m => m.tipo === 'EGRESO').reduce((s,m) => s + Number(m.monto || 0), 0)
  }), [filtrados]);

  const compraOpciones = useMemo(() => compras.map(c => ({
    value: c.id,
    label: `${c.codigo || 'COMPRA'} · ${c.proveedor_nombre || 'Sin proveedor'} · ${money(c.monto)} · ${c.descripcion || ''}`
  })), [compras]);

  const seleccionarCompra = id => {
    const c = compras.find(x => x.id === id);
    setForm(prev => ({
      ...prev,
      compra_id: id,
      tercero_nombre: c?.proveedor_nombre || prev.tercero_nombre,
      documento: c?.codigo || prev.documento,
      proyecto_texto: c?.proyectos ? `${c.proyectos.codigo || ''}${c.proyectos.codigo ? ' · ' : ''}${c.proyectos.nombre || ''}` : (c?.proyecto_texto || prev.proyecto_texto),
      concepto: prev.concepto || (c ? `Pago ${c.codigo || 'de compra'} · ${c.descripcion || ''}` : '')
    }));
  };

  const abrirNuevo = (code = cuentaFiltro !== 'TODAS' ? cuentaFiltro : 'INTERBANK') => {
    setForm({ fecha: today(), cuenta_codigo: code, tipo: 'EGRESO', origen: 'COMPRA', monto: '', concepto: '', compra_id: '', proyecto_texto: '', tercero_nombre: '', documento: '', observaciones: '', destino_codigo: code === 'INTERBANK' ? 'CAJA_CHICA' : 'INTERBANK' });
    setModal(true);
  };

  const guardarMovimiento = async e => {
    e.preventDefault();
    const monto = Number(form.monto || 0);
    if (!monto || monto <= 0) return setError('Ingresa un monto válido.');
    const cuenta = cuentaByCode(form.cuenta_codigo);
    if (!cuenta) return setError('No se encontró la caja seleccionada. Ejecuta primero el SQL del módulo Caja.');
    setSaving(true); setError('');

    if (form.origen === 'TRANSFERENCIA') {
      const destino = cuentaByCode(form.destino_codigo);
      if (!destino || destino.id === cuenta.id) { setSaving(false); return setError('Selecciona una caja destino diferente.'); }
      const { error: rpcError } = await supabase.rpc('registrar_transferencia_caja', {
        p_cuenta_origen: cuenta.id,
        p_cuenta_destino: destino.id,
        p_fecha: form.fecha,
        p_monto: monto,
        p_concepto: form.concepto || `Transferencia ${cuenta.nombre} → ${destino.nombre}`,
        p_observaciones: form.observaciones || null,
        p_registrado_por: usuario || null
      });
      if (rpcError) { setError(rpcError.message); setSaving(false); return; }
    } else {
      const payload = {
        cuenta_id: cuenta.id,
        fecha: form.fecha,
        tipo: form.tipo,
        origen: form.origen,
        monto,
        concepto: form.concepto.trim(),
        compra_id: form.origen === 'COMPRA' ? (form.compra_id || null) : null,
        tercero_nombre: form.tercero_nombre.trim() || null,
        proyecto_texto: form.proyecto_texto.trim() || null,
        documento: form.documento.trim() || null,
        observaciones: form.observaciones.trim() || null,
        registrado_por: usuario || null
      };
      const { error: insertError } = await supabase.from('caja_movimientos').insert([payload]);
      if (insertError) { setError(insertError.message); setSaving(false); return; }
    }
    onAudit?.('CAJA_MOVIMIENTO', `${form.origen} ${form.cuenta_codigo} ${money(monto)}`);
    onNotify?.('Movimiento de caja registrado correctamente.');
    setModal(false); setSaving(false); await cargar();
  };

  const guardarSaldoInicial = async e => {
    e.preventDefault();
    if (!saldoModal) return;
    const valor = Number(saldoModal.saldo_inicial || 0);
    setSaving(true);
    const { error: uError } = await supabase.from('caja_cuentas').update({ saldo_inicial: valor, fecha_saldo_inicial: saldoModal.fecha_saldo_inicial || today(), updated_at: new Date().toISOString() }).eq('id', saldoModal.id);
    if (uError) setError(uError.message); else { setSaldoModal(null); await cargar(); }
    setSaving(false);
  };

  const pagadoCompra = compraId => movimientos.filter(m => m.compra_id === compraId && m.tipo === 'EGRESO').reduce((s,m) => s + Number(m.monto || 0), 0);

  return <div className="cash-page">
    <div className="cash-hero">
      <div>
        <span className="cash-eyebrow">TESORERÍA · MOVIMIENTOS REALES</span>
        <h2>Caja</h2>
        <p>Controla de dónde sale y a dónde entra el dinero. Compra no significa pago; venta no significará cobro hasta que exista un movimiento.</p>
      </div>
      <button type="button" className="cash-primary" onClick={() => abrirNuevo()}><FestosIcon name="Plus" size={17}/> Nuevo movimiento</button>
    </div>

    {error && <div className="cash-error">{error}</div>}

    <section className="cash-accounts-grid">
      {resumen.map(c => <article key={c.id} className={`cash-account-card ${cuentaFiltro === c.codigo ? 'active' : ''}`} onClick={() => setCuentaFiltro(c.codigo)}>
        <div className="cash-account-top"><span><FestosIcon name="CreditCard" size={19}/>{accountLabel(c.codigo)}</span><button type="button" onClick={e => { e.stopPropagation(); setSaldoModal({ ...c }); }} title="Configurar saldo inicial"><FestosIcon name="Settings" size={16}/></button></div>
        <small>Saldo disponible</small><strong>{money(c.saldo)}</strong>
        <div className="cash-account-stats"><span><b>+ {money(c.ingresos)}</b><small>Ingresos</small></span><span><b>- {money(c.egresos)}</b><small>Egresos</small></span></div>
      </article>)}
    </section>

    <section className="cash-summary-strip">
      <div><small>INGRESOS FILTRADOS</small><strong>{money(totalesFiltrados.ingresos)}</strong></div>
      <div><small>EGRESOS FILTRADOS</small><strong>{money(totalesFiltrados.egresos)}</strong></div>
      <div><small>MOVIMIENTOS</small><strong>{filtrados.length}</strong></div>
      <div><small>NETO DEL FILTRO</small><strong>{money(totalesFiltrados.ingresos - totalesFiltrados.egresos)}</strong></div>
    </section>

    <section className="cash-panel">
      <div className="cash-panel-head"><div><span>HISTORIAL</span><h3>Movimientos de caja</h3></div><button type="button" className="cash-secondary" onClick={() => setCuentaFiltro('TODAS')}>Ver ambas cajas</button></div>
      <div className="cash-filters">
        <div className="cash-search"><FestosIcon name="Search" size={17}/><input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar concepto, proveedor, proyecto, documento..."/></div>
        <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}/>
        <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}/>
        <select value={cuentaFiltro} onChange={e => setCuentaFiltro(e.target.value)}><option value="TODAS">Todas las cajas</option><option value="INTERBANK">Caja IBK</option><option value="CAJA_CHICA">Caja Chica</option></select>
        <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}><option value="TODOS">Ingreso + Egreso</option><option value="INGRESO">Ingresos</option><option value="EGRESO">Egresos</option></select>
        <select value={origenFiltro} onChange={e => setOrigenFiltro(e.target.value)}><option value="TODOS">Todos los orígenes</option><option value="COMPRA">Compra</option><option value="VENTA">Venta</option><option value="TRANSFERENCIA">Transferencia</option><option value="REEMBOLSO">Reembolso</option><option value="AJUSTE">Ajuste</option><option value="OTRO">Otro</option></select>
      </div>

      <div className="cash-table-wrap">
        <table className="cash-table"><thead><tr><th>Fecha</th><th>Caja</th><th>Movimiento</th><th>Concepto</th><th>Relacionado</th><th>Ingreso</th><th>Egreso</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan="7" className="cash-empty">Cargando movimientos...</td></tr> : filtrados.length ? filtrados.map(m => {
          const compra = m.compras;
          return <tr key={m.id}><td>{m.fecha ? new Date(`${m.fecha}T12:00:00`).toLocaleDateString('es-PE') : '—'}</td><td><span className="cash-account-pill">{accountLabel(m.caja_cuentas?.codigo)}</span></td><td><span className={`cash-type ${m.tipo === 'INGRESO' ? 'in' : 'out'}`}>{m.tipo}</span></td><td><strong>{m.concepto}</strong><small>{m.tercero_nombre || m.proyecto_texto || ''}</small></td><td>{compra ? <span className="cash-linked">{compra.codigo || 'COMPRA'}<small>{compra.proveedor_nombre || ''}</small></span> : (m.documento || '—')}</td><td className="cash-money in">{m.tipo === 'INGRESO' ? money(m.monto) : '—'}</td><td className="cash-money out">{m.tipo === 'EGRESO' ? money(m.monto) : '—'}</td></tr>;
        }) : <tr><td colSpan="7" className="cash-empty"><strong>Sin movimientos todavía</strong><span>Registra el primer ingreso, egreso o transferencia de esta caja.</span></td></tr>}</tbody></table>
      </div>
    </section>

    <section className="cash-panel cash-purchase-panel">
      <div className="cash-panel-head"><div><span>COMPRAS</span><h3>Pagos asociados</h3></div><small>Vista rápida de compras con movimientos registrados en Caja.</small></div>
      <div className="cash-purchase-grid">{compras.filter(c => pagadoCompra(c.id) > 0).slice(0, 8).map(c => {
        const pagado = pagadoCompra(c.id); const total = Number(c.monto || 0); const pendiente = Math.max(0, total - pagado);
        return <article key={c.id}><span>{c.codigo || 'COMPRA'}</span><strong>{c.proveedor_nombre || 'Sin proveedor'}</strong><div><small>Precio compra</small><b>{money(total)}</b></div><div><small>Pagado en caja</small><b>{money(pagado)}</b></div><div><small>Pendiente</small><b>{money(pendiente)}</b></div></article>;
      })}{!compras.some(c => pagadoCompra(c.id) > 0) && <div className="cash-empty-card">Los pagos asociados a compras aparecerán aquí automáticamente.</div>}</div>
    </section>

    {modal && <div className="cash-modal-backdrop" onMouseDown={() => !saving && setModal(false)}><form className="cash-modal" onSubmit={guardarMovimiento} onMouseDown={e => e.stopPropagation()}>
      <div className="cash-modal-head"><div><span>NUEVO</span><h3>Movimiento de caja</h3></div><button type="button" onClick={() => setModal(false)}><FestosIcon name="X" size={19}/></button></div>
      <div className="cash-form-grid">
        <label>Fecha<input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required/></label>
        <label>Caja<select value={form.cuenta_codigo} onChange={e => setForm({ ...form, cuenta_codigo: e.target.value, destino_codigo: e.target.value === 'INTERBANK' ? 'CAJA_CHICA' : 'INTERBANK' })}><option value="INTERBANK">CAJA IBK</option><option value="CAJA_CHICA">CAJA CHICA</option></select></label>
        <label>Origen<select value={form.origen} onChange={e => setForm({ ...form, origen: e.target.value, tipo: e.target.value === 'COMPRA' ? 'EGRESO' : form.tipo })}><option value="COMPRA">Compra</option><option value="VENTA">Venta</option><option value="TRANSFERENCIA">Transferencia entre cajas</option><option value="REEMBOLSO">Reembolso</option><option value="AJUSTE">Ajuste manual</option><option value="OTRO">Otro</option></select></label>
        {form.origen !== 'TRANSFERENCIA' && <label>Tipo<select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="EGRESO">EGRESO</option><option value="INGRESO">INGRESO</option></select></label>}
        {form.origen === 'TRANSFERENCIA' && <label>Caja destino<select value={form.destino_codigo} onChange={e => setForm({ ...form, destino_codigo: e.target.value })}><option value={form.cuenta_codigo === 'INTERBANK' ? 'CAJA_CHICA' : 'INTERBANK'}>{form.cuenta_codigo === 'INTERBANK' ? 'CAJA CHICA' : 'CAJA IBK'}</option></select></label>}
        <label>Monto (S/.)<input type="number" min="0.01" step="0.01" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} required/></label>
        {form.origen === 'COMPRA' && <label className="cash-span-2">Compra asociada<SearchableSelect value={form.compra_id} onChange={seleccionarCompra} options={compraOpciones} placeholder="Buscar compra por código, proveedor o descripción..."/></label>}
        <label className="cash-span-2">Concepto<input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} placeholder="Ej. Pago parcial factura proveedor" required/></label>
        {form.origen !== 'TRANSFERENCIA' && <><label>Tercero / proveedor / cliente<input value={form.tercero_nombre} onChange={e => setForm({ ...form, tercero_nombre: e.target.value })}/></label><label>Documento / referencia<input value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })}/></label><label className="cash-span-2">Proyecto<input value={form.proyecto_texto} onChange={e => setForm({ ...form, proyecto_texto: e.target.value })}/></label></>}
        <label className="cash-span-2">Observaciones<textarea rows="3" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })}/></label>
      </div>
      <div className="cash-modal-actions"><button type="button" className="cash-secondary" onClick={() => setModal(false)}>Cancelar</button><button type="submit" className="cash-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar movimiento'}</button></div>
    </form></div>}

    {saldoModal && <div className="cash-modal-backdrop" onMouseDown={() => !saving && setSaldoModal(null)}><form className="cash-modal cash-modal-small" onSubmit={guardarSaldoInicial} onMouseDown={e => e.stopPropagation()}>
      <div className="cash-modal-head"><div><span>CONFIGURACIÓN</span><h3>Saldo inicial · {accountLabel(saldoModal.codigo)}</h3></div><button type="button" onClick={() => setSaldoModal(null)}><FestosIcon name="X" size={19}/></button></div>
      <div className="cash-form-grid"><label>Fecha de inicio<input type="date" value={saldoModal.fecha_saldo_inicial || today()} onChange={e => setSaldoModal({ ...saldoModal, fecha_saldo_inicial: e.target.value })}/></label><label>Saldo inicial (S/.)<input type="number" step="0.01" value={saldoModal.saldo_inicial ?? 0} onChange={e => setSaldoModal({ ...saldoModal, saldo_inicial: e.target.value })}/></label></div>
      <div className="cash-modal-actions"><button type="button" className="cash-secondary" onClick={() => setSaldoModal(null)}>Cancelar</button><button type="submit" className="cash-primary" disabled={saving}>Guardar saldo</button></div>
    </form></div>}
  </div>;
}

export default CashModule;
