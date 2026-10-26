import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { FestosIcon } from '../FestosIcon';

const EMPLEADOS_BASE = [
  {
    codigo: 'GONZALO',
    nombre: 'Gonzalo Villavicencio',
    cargo: 'Head Admin',
    modalidad_pago: 'PLANILLA',
    frecuencia_pago: 'MENSUAL',
    permite_comisiones: false,
    sueldo_base: null,
    correo: 'gonzalo@festosmkt.com',
    telefono: '',
    banco: '',
    cuenta_bancaria: '',
    cci: '',
    documento: '',
    ruc: '',
    fecha_ingreso: '',
    activo: true,
  },
  {
    codigo: 'JESUS',
    nombre: 'Jesus Jorge',
    cargo: 'Admin',
    modalidad_pago: 'RECIBO_HONORARIOS',
    frecuencia_pago: 'QUINCENAL',
    permite_comisiones: false,
    sueldo_base: null,
    correo: 'jesus@festosmkt.com',
    telefono: '',
    banco: '',
    cuenta_bancaria: '',
    cci: '',
    documento: '',
    ruc: '',
    fecha_ingreso: '',
    activo: true,
  },
  {
    codigo: 'MAR',
    nombre: 'Marjorie Muñoz',
    cargo: 'Operadora Comercial',
    modalidad_pago: 'RECIBO_HONORARIOS',
    frecuencia_pago: 'MENSUAL',
    permite_comisiones: true,
    sueldo_base: null,
    correo: 'mar@festosmkt.com',
    telefono: '',
    banco: '',
    cuenta_bancaria: '',
    cci: '',
    documento: '',
    ruc: '',
    fecha_ingreso: '',
    activo: true,
  },
  {
    codigo: 'RODRIGO',
    nombre: 'Rodrigo Zevallos',
    cargo: 'Desarrollador Software',
    modalidad_pago: 'RECIBO_HONORARIOS',
    frecuencia_pago: 'QUINCENAL',
    permite_comisiones: false,
    sueldo_base: null,
    correo: 'rodrigo@festosmkt.com',
    telefono: '',
    banco: '',
    cuenta_bancaria: '',
    cci: '',
    documento: '',
    ruc: '',
    fecha_ingreso: '',
    activo: true,
  },
];

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const RXH_BUCKET = 'planilla-rxh';

const periodoActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const periodoLabel = (p) => {
  const [y, m] = String(p || periodoActual()).split('-');
  return `${MESES[Math.max(0, Number(m) - 1)]} ${y}`;
};

const money = (value) => value == null || value === '' ? 'Por confirmar' : `S/ ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const modalidadLabel = (value) => value === 'PLANILLA' ? 'Planilla' : 'Recibo por honorarios';
const frecuenciaLabel = (value) => value === 'QUINCENAL' ? 'Quincenal · cada 15 días' : 'Mensual';
const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const limpiezaNombre = (text) => String(text || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/gi, '_');
const formatoFecha = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin definir';
const periodoInputToDate = (periodo) => `${periodo || periodoActual()}-01`;

function normalizeEmpleado(empleado = {}) {
  return {
    codigo: empleado.codigo || '',
    nombre: empleado.nombre || '',
    cargo: empleado.cargo || '',
    modalidad_pago: empleado.modalidad_pago || 'RECIBO_HONORARIOS',
    frecuencia_pago: empleado.frecuencia_pago || 'MENSUAL',
    permite_comisiones: empleado.codigo === 'MAR' || !!empleado.permite_comisiones,
    sueldo_base: empleado.sueldo_base ?? '',
    correo: empleado.correo || '',
    telefono: empleado.telefono || '',
    banco: empleado.banco || '',
    cuenta_bancaria: empleado.cuenta_bancaria || '',
    cci: empleado.cci || '',
    documento: empleado.documento || '',
    ruc: empleado.ruc || '',
    fecha_ingreso: empleado.fecha_ingreso || '',
    activo: empleado.activo !== false,
    orden: empleado.orden ?? 0,
  };
}

function ModalEmpleado({ empleado, onClose, onSaved }) {
  const [form, setForm] = useState(normalizeEmpleado(empleado));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(normalizeEmpleado(empleado));
  }, [empleado]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        codigo: form.codigo,
        nombre: form.nombre,
        cargo: form.cargo,
        modalidad_pago: form.modalidad_pago,
        frecuencia_pago: form.frecuencia_pago,
        permite_comisiones: form.codigo === 'MAR',
        sueldo_base: form.sueldo_base === '' ? null : Number(form.sueldo_base),
        correo: form.correo || null,
        telefono: form.telefono || null,
        banco: form.banco || null,
        cuenta_bancaria: form.cuenta_bancaria || null,
        cci: form.cci || null,
        documento: form.documento || null,
        ruc: form.ruc || null,
        fecha_ingreso: form.fecha_ingreso || null,
        activo: !!form.activo,
        orden: form.orden ?? 0,
      };
      const { error } = await supabase.from('planilla_empleados').upsert(payload, { onConflict: 'codigo' });
      if (error) throw error;
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(`No se pudo guardar el empleado. ${err?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="payroll-modal-backdrop" onClick={onClose}>
      <form className="payroll-modal payroll-modal-large" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <div className="payroll-modal-head">
          <div>
            <small>Planilla · Empleado</small>
            <h3>{form.nombre || 'Empleado'}</h3>
          </div>
          <button type="button" onClick={onClose}><FestosIcon name="X" size={18} /></button>
        </div>

        <div className="payroll-form-grid payroll-form-grid-3">
          <label>
            <span>Nombre completo</span>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </label>
          <label>
            <span>Cargo</span>
            <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
          </label>
          <label>
            <span>Código</span>
            <input value={form.codigo} disabled />
          </label>

          <label>
            <span>Correo</span>
            <input type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} placeholder="correo@festos.com" />
          </label>
          <label>
            <span>Número / teléfono</span>
            <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Ej. +51 987 654 321" />
          </label>
          <label>
            <span>Fecha de ingreso</span>
            <input type="date" value={form.fecha_ingreso || ''} onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} />
          </label>

          <label>
            <span>Modalidad de pago</span>
            <select value={form.modalidad_pago} onChange={(e) => setForm({ ...form, modalidad_pago: e.target.value })}>
              <option value="PLANILLA">Planilla</option>
              <option value="RECIBO_HONORARIOS">Recibo por honorarios</option>
            </select>
          </label>
          <label>
            <span>Frecuencia de pago</span>
            <select value={form.frecuencia_pago} onChange={(e) => setForm({ ...form, frecuencia_pago: e.target.value })}>
              <option value="MENSUAL">Mensual</option>
              <option value="QUINCENAL">Quincenal · cada 15 días</option>
            </select>
          </label>
          <label>
            <span>Monto base</span>
            <input type="number" min="0" step="0.01" placeholder="Pendiente por confirmar" value={form.sueldo_base} onChange={(e) => setForm({ ...form, sueldo_base: e.target.value })} />
          </label>

          <label>
            <span>Banco</span>
            <input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="Ej. Interbank" />
          </label>
          <label>
            <span>Cuenta bancaria</span>
            <input value={form.cuenta_bancaria} onChange={(e) => setForm({ ...form, cuenta_bancaria: e.target.value })} placeholder="Cuenta de abono" />
          </label>
          <label>
            <span>CCI</span>
            <input value={form.cci} onChange={(e) => setForm({ ...form, cci: e.target.value })} placeholder="Cuenta interbancaria" />
          </label>

          <label>
            <span>DNI / documento</span>
            <input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
          </label>
          <label>
            <span>RUC</span>
            <input value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
          </label>
          <label className="payroll-checkbox-label">
            <span>Activo</span>
            <select value={form.activo ? 'SI' : 'NO'} onChange={(e) => setForm({ ...form, activo: e.target.value === 'SI' })}>
              <option value="SI">Sí</option>
              <option value="NO">No</option>
            </select>
          </label>
        </div>

        <div className="payroll-rule-note">
          <FestosIcon name="CircleHelp" size={17} />
          <span>{form.codigo === 'MAR' ? 'Mar es la única colaboradora con comisiones habilitadas.' : 'Las comisiones están deshabilitadas para este colaborador.'}</span>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </form>
    </div>
  );
}

function ModalComision({ empleado, periodo, onClose, onSaved }) {
  const [form, setForm] = useState({ origen: 'COTIZACION', referencia: '', descripcion: '', monto: '' });
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!form.monto) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('planilla_comisiones').insert({
        empleado_codigo: empleado.codigo,
        periodo,
        origen: form.origen,
        referencia: form.referencia || null,
        descripcion: form.descripcion || null,
        monto: Number(form.monto),
        estado: 'PENDIENTE',
      });
      if (error) throw error;
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(`No se pudo registrar la comisión. ${err?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="payroll-modal-backdrop" onClick={onClose}>
      <form className="payroll-modal payroll-modal-small" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <div className="payroll-modal-head">
          <div>
            <small>Comisión · {periodoLabel(periodo)}</small>
            <h3>{empleado.nombre}</h3>
          </div>
          <button type="button" onClick={onClose}><FestosIcon name="X" size={18} /></button>
        </div>
        <div className="payroll-form-grid">
          <label>
            <span>Origen</span>
            <select value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}>
              <option value="COTIZACION">Cotización</option>
              <option value="PROYECTO">Proyecto</option>
              <option value="VENTA">Reg. de Ventas (futuro)</option>
              <option value="OTRO">Otro</option>
            </select>
          </label>
          <label>
            <span>Referencia</span>
            <input placeholder="Ej. COT-2026-0045" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
          </label>
          <label className="payroll-field-wide">
            <span>Descripción</span>
            <input placeholder="Detalle de la comisión" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </label>
          <label className="payroll-field-wide">
            <span>Monto (S/)</span>
            <input type="number" min="0" step="0.01" required value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Registrar comisión'}</button>
        </div>
      </form>
    </div>
  );
}

function DocumentoRow({ documento, onDownload }) {
  const tipoLabel = documento?.tipo === 'RXH' ? 'Recibo por honorarios' : documento?.tipo || 'Documento';
  return (
    <div className="payroll-doc-row">
      <div className="payroll-doc-icon"><FestosIcon name="FileText" size={18} /></div>
      <div className="payroll-doc-meta">
        <strong>{documento.nombre_archivo}</strong>
        <small>{tipoLabel}{documento.periodo ? ` · ${periodoLabel(documento.periodo)}` : ''}</small>
      </div>
      <button type="button" className="btn-icon-soft" onClick={() => onDownload(documento)}>
        <FestosIcon name="Download" size={17} />
      </button>
    </div>
  );
}

export function PayrollModule({ usuario, puedeGestionar = false }) {
  const [empleados, setEmpleados] = useState(EMPLEADOS_BASE);
  const [comisiones, setComisiones] = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [periodo, setPeriodo] = useState(periodoActual());
  const [selected, setSelected] = useState(null);
  const [editando, setEditando] = useState(null);
  const [nuevaComision, setNuevaComision] = useState(false);
  const [dbReady, setDbReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [subiendoDocumento, setSubiendoDocumento] = useState(false);
  const [docForm, setDocForm] = useState({ tipo: 'RXH', periodo: periodoActual(), file: null });

  const cargar = async () => {
    setLoading(true);
    try {
      const [e, c, l, d] = await Promise.all([
        supabase.from('planilla_empleados').select('*').order('orden'),
        supabase.from('planilla_comisiones').select('*').eq('periodo', periodo).order('created_at', { ascending: false }),
        supabase.from('planilla_liquidaciones').select('*').eq('periodo', periodo),
        supabase.from('planilla_documentos').select('*').order('created_at', { ascending: false }),
      ]);
      if (e.error) throw e.error;
      setDbReady(true);
      setEmpleados(e.data?.length ? e.data : EMPLEADOS_BASE);
      setComisiones(c.error ? [] : (c.data || []));
      setLiquidaciones(l.error ? [] : (l.data || []));
      setDocumentos(d.error ? [] : (d.data || []));
    } catch (err) {
      console.warn('Planilla pendiente de SQL:', err);
      setDbReady(false);
      setEmpleados(EMPLEADOS_BASE);
      setComisiones([]);
      setLiquidaciones([]);
      setDocumentos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  const mar = empleados.find((e) => e.codigo === 'MAR');
  const comisionesMar = useMemo(() => comisiones.filter((c) => c.empleado_codigo === 'MAR'), [comisiones]);
  const totalComisiones = comisionesMar.reduce((a, c) => a + Number(c.monto || 0), 0);
  const totalBases = empleados.reduce((a, e) => a + (e.sueldo_base == null ? 0 : Number(e.sueldo_base || 0)), 0);
  const basesConfirmadas = empleados.filter((e) => e.sueldo_base != null).length;
  const totalPorPagar = liquidaciones.reduce((a, l) => a + (l.total_pagar == null ? 0 : Number(l.total_pagar || 0)), 0);

  const liquidacionDe = (codigo) => liquidaciones.find((x) => x.empleado_codigo === codigo);

  const openDetail = (emp) => {
    setSelected(emp);
    setDocForm({ tipo: 'RXH', periodo, file: null });
  };

  const closeDetail = () => setSelected(null);

  const selectedComisiones = selected?.codigo === 'MAR' ? comisionesMar : [];
  const selectedLiq = selected ? liquidacionDe(selected.codigo) : null;
  const selectedDocs = selected ? documentos.filter((doc) => doc.empleado_codigo === selected.codigo) : [];

  const generarLiquidaciones = async () => {
    if (!dbReady) return alert('Primero ejecuta FESTOS_V29_39_PLANILLA.sql en Supabase.');
    const rows = empleados.filter((e) => e.activo).map((e) => {
      const com = e.codigo === 'MAR' ? totalComisiones : 0;
      const base = e.sueldo_base == null ? null : Number(e.sueldo_base);
      return {
        periodo,
        empleado_codigo: e.codigo,
        sueldo_base: base,
        comisiones: com,
        bonos: 0,
        descuentos: 0,
        total_pagar: base == null ? null : base + com,
        estado: 'PENDIENTE',
        frecuencia_pago: e.frecuencia_pago,
        fecha_pago: periodoInputToDate(periodo),
        medio_pago: e.modalidad_pago === 'PLANILLA' ? 'Planilla' : 'Transferencia bancaria',
      };
    });
    const { error } = await supabase.from('planilla_liquidaciones').upsert(rows, { onConflict: 'periodo,empleado_codigo' });
    if (error) return alert(`No se pudo generar la liquidación. ${error.message}`);
    await cargar();
  };

  const subirDocumento = async () => {
    if (!selected || !docForm.file) return;
    if (!dbReady) return alert('Primero ejecuta el SQL del módulo Planilla para activar adjuntos.');
    setSubiendoDocumento(true);
    try {
      const safeName = `${Date.now()}_${limpiezaNombre(docForm.file.name)}`;
      const path = `${selected.codigo}/${docForm.periodo || periodo}/${safeName}`;
      const { error: uploadError } = await supabase.storage.from(RXH_BUCKET).upload(path, docForm.file, { upsert: true });
      if (uploadError) throw uploadError;
      const { error: docError } = await supabase.from('planilla_documentos').insert({
        empleado_codigo: selected.codigo,
        periodo: docForm.periodo || periodo,
        tipo: docForm.tipo,
        nombre_archivo: docForm.file.name,
        storage_path: path,
      });
      if (docError) throw docError;
      setDocForm({ tipo: 'RXH', periodo, file: null });
      await cargar();
    } catch (err) {
      alert(`No se pudo subir el documento. ${err?.message || ''}`);
    } finally {
      setSubiendoDocumento(false);
    }
  };

  const descargarDocumento = async (documento) => {
    try {
      const { data, error } = await supabase.storage.from(RXH_BUCKET).download(documento.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = documento.nombre_archivo || 'documento';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`No se pudo descargar el adjunto. ${err?.message || ''}`);
    }
  };

  const refrescarEmpleadoSeleccionado = async (codigo) => {
    await cargar();
    const { data } = await supabase.from('planilla_empleados').select('*').eq('codigo', codigo).maybeSingle();
    if (data) setSelected(data);
  };

  const liquidacionesPendientes = liquidaciones.filter((item) => item.estado !== 'PAGADO').length;

  return (
    <div className="payroll-page payroll-page-expanded">
      <section className="payroll-hero payroll-hero-expanded">
        <div className="payroll-hero-copy">
          <span className="payroll-eyebrow">BUENOS DÍAS</span>
          <h2>Planilla</h2>
          <h3>Gestión de empleados, pagos y comisiones</h3>
          <p>Administra a tu equipo, define modalidad y frecuencia de pago, controla comisiones y mantén un almacén de recibos por honorarios y comprobantes por cada colaborador.</p>
        </div>
        <div className="payroll-hero-art payroll-hero-art-expanded">
          <div className="payroll-hero-stack payroll-hero-stack-front">
            <div className="payroll-hero-stack-icon"><FestosIcon name="UserRound" size={30} /></div>
            <div className="payroll-hero-stack-lines">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="payroll-hero-stack payroll-hero-stack-back">
            <div className="payroll-hero-stack-lines alt">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="payroll-art-coin"><FestosIcon name="CircleDollarSign" size={32} /></div>
          <div className="payroll-art-chart"><FestosIcon name="ChartNoAxesColumnIncreasing" size={30} /></div>
        </div>
        <blockquote>“Un equipo bien administrado,<br />impulsa grandes resultados.”</blockquote>
      </section>

      {!dbReady && (
        <div className="payroll-setup-alert">
          <FestosIcon name="AlertTriangle" size={19} />
          <div>
            <strong>Planilla está en modo demostración.</strong>
            <span>Ejecuta <b>supabase/FESTOS_V29_39_PLANILLA.sql</b> para guardar empleados, comisiones, liquidaciones y almacenar RXH por persona.</span>
          </div>
        </div>
      )}

      <section className="payroll-kpis payroll-kpis-expanded">
        <article>
          <i className="green"><FestosIcon name="Users" /></i>
          <div><small>Empleados activos</small><strong>{empleados.filter((e) => e.activo).length}</strong><span>equipo FESTOS</span></div>
        </article>
        <article>
          <i className="blue"><FestosIcon name="CreditCard" /></i>
          <div><small>Total sueldos/base</small><strong>{basesConfirmadas === empleados.length ? money(totalBases) : 'Por confirmar'}</strong><span>{basesConfirmadas}/{empleados.length} montos confirmados</span></div>
        </article>
        <article>
          <i className="orange"><FestosIcon name="CircleDollarSign" /></i>
          <div><small>Comisiones · solo Mar</small><strong>{totalComisiones ? money(totalComisiones) : 'S/ 0.00'}</strong><span>{comisionesMar.length} registros del período</span></div>
        </article>
        <article>
          <i className="purple"><FestosIcon name="FolderKanban" /></i>
          <div><small>Total por pagar</small><strong>{liquidaciones.some((l) => l.total_pagar == null) || !liquidaciones.length ? 'Por confirmar' : money(totalPorPagar)}</strong><span>{periodoLabel(periodo)}</span></div>
        </article>
      </section>

      <div className="payroll-layout payroll-layout-expanded">
        <div className="payroll-main">
          <section className="payroll-panel payroll-panel-team">
            <div className="payroll-panel-head">
              <div>
                <h3><FestosIcon name="Users" /> Nuestro equipo</h3>
                <p>Modalidad, frecuencia de pago y reglas vigentes.</p>
              </div>
            </div>

            <div className="payroll-team-grid payroll-team-grid-expanded">
              {empleados.map((e, idx) => (
                <button key={e.codigo} type="button" className="payroll-employee-card payroll-employee-card-expanded" onClick={() => openDetail(e)}>
                  <div className={`payroll-avatar av-${idx + 1}`}>{initials(e.nombre)}</div>
                  <div className="payroll-person">
                    <strong>{e.nombre.split(' ')[0]}</strong>
                    <span>{e.cargo}</span>
                  </div>
                  <em>{e.activo ? 'Activo' : 'Inactivo'}</em>

                  <dl>
                    <div><dt>Modalidad</dt><dd>{modalidadLabel(e.modalidad_pago)}</dd></div>
                    <div><dt>Frecuencia</dt><dd>{frecuenciaLabel(e.frecuencia_pago)}</dd></div>
                    <div><dt>Monto base</dt><dd>{money(e.sueldo_base)}</dd></div>
                    <div><dt>Comisiones</dt><dd>{e.permite_comisiones ? (totalComisiones ? money(totalComisiones) : 'Habilitadas') : 'No aplica'}</dd></div>
                  </dl>
                  <span className="payroll-card-arrow"><FestosIcon name="ChevronRight" size={17} /></span>
                </button>
              ))}
            </div>
          </section>

          <section className="payroll-panel payroll-liquidation">
            <div className="payroll-panel-head">
              <div>
                <h3><FestosIcon name="FileText" /> Liquidación mensual</h3>
                <p>Los montos pueden mantenerse pendientes hasta ser confirmados.</p>
              </div>
              <div className="payroll-period-actions">
                <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
                {puedeGestionar && <button className="btn-primary" onClick={generarLiquidaciones}><FestosIcon name="FileText" size={16} /> Generar liquidación</button>}
              </div>
            </div>
            <div className="payroll-table-wrap">
              <table className="payroll-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Modalidad</th>
                    <th>Frecuencia</th>
                    <th>Sueldo base</th>
                    <th>Comisiones</th>
                    <th>Total a pagar</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((e) => {
                    const liq = liquidacionDe(e.codigo);
                    const com = e.codigo === 'MAR' ? totalComisiones : 0;
                    const total = liq?.total_pagar ?? (e.sueldo_base == null ? null : Number(e.sueldo_base) + com);
                    return (
                      <tr key={e.codigo} onClick={() => openDetail(e)}>
                        <td><span className="payroll-mini-avatar">{initials(e.nombre)}</span><div><strong>{e.nombre.split(' ')[0]}</strong><small>{e.cargo}</small></div></td>
                        <td>{modalidadLabel(e.modalidad_pago)}</td>
                        <td>{e.frecuencia_pago === 'QUINCENAL' ? 'Cada 15 días' : 'Mensual'}</td>
                        <td>{money(liq?.sueldo_base ?? e.sueldo_base)}</td>
                        <td>{e.codigo === 'MAR' ? money(com) : 'No aplica'}</td>
                        <td><b>{money(total)}</b></td>
                        <td><span className={`payroll-status ${(liq?.estado || 'PENDIENTE').toLowerCase()}`}>{liq?.estado === 'PAGADO' ? 'Pagado' : liq?.estado === 'POR_PAGAR' ? 'Por pagar' : 'Pendiente'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="payroll-integrations payroll-panel">
          <div className="payroll-panel-head">
            <div>
              <h3><FestosIcon name="ExternalLink" /> Integración con módulos</h3>
              <p>Flujo previsto dentro de FESTOS.</p>
            </div>
          </div>
          <div className="payroll-integration-list">
            <div><i className="green"><FestosIcon name="FileText" /></i><span><strong>Cotizaciones</strong><small>Origen de comisiones comerciales para Mar.</small></span><FestosIcon name="ChevronRight" /></div>
            <div><i className="purple"><FestosIcon name="FolderKanban" /></i><span><strong>Proyectos</strong><small>Referencia para comisiones e hitos aprobados.</small></span><FestosIcon name="ChevronRight" /></div>
            <div><i className="blue"><FestosIcon name="CreditCard" /></i><span><strong>Caja</strong><small>Registrará la salida cuando un pago sea confirmado.</small></span><FestosIcon name="ChevronRight" /></div>
            <div><i className="green"><FestosIcon name="Upload" /></i><span><strong>Adjuntos / Storage</strong><small>Guarda RXH, constancias y otros comprobantes por cada persona.</small></span><FestosIcon name="ChevronRight" /></div>
            <div className="pending"><i className="orange"><FestosIcon name="ChartNoAxesColumnIncreasing" /></i><span><strong>Reg. de Ventas <em>Próximamente</em></strong><small>Automatizará el cálculo de comisiones de Mar.</small></span></div>
          </div>
        </aside>
      </div>

      {selected && (
        <div className="payroll-detail-backdrop" onClick={closeDetail}>
          <section className="payroll-detail payroll-detail-expanded" onClick={(e) => e.stopPropagation()}>
            <header>
              <div className="payroll-detail-person-wrap">
                <div className="payroll-detail-person">
                  <div className="payroll-avatar av-detail">{initials(selected.nombre)}</div>
                  <div>
                    <small>Detalle de planilla</small>
                    <h2>{selected.nombre}</h2>
                    <p>{selected.cargo}</p>
                  </div>
                </div>
                <div className="payroll-detail-contactline">
                  <span><FestosIcon name="Mail" size={14} /> {selected.correo || 'Sin correo'}</span>
                  <span><FestosIcon name="Users" size={14} /> {selected.telefono || 'Sin número'}</span>
                  <span><FestosIcon name="CreditCard" size={14} /> {selected.modalidad_pago === 'PLANILLA' ? 'Planilla' : 'RxH'}</span>
                </div>
              </div>
              <div className="payroll-detail-header-actions">
                {puedeGestionar && <button type="button" className="btn-secondary" onClick={() => setEditando(selected)}><FestosIcon name="Pencil" size={15} /> Editar empleado</button>}
                <button type="button" onClick={closeDetail}><FestosIcon name="X" /></button>
              </div>
            </header>

            <div className="payroll-detail-tags">
              <span>{modalidadLabel(selected.modalidad_pago)}</span>
              <span>{frecuenciaLabel(selected.frecuencia_pago)}</span>
              <span>{selected.activo ? 'Activo' : 'Inactivo'}</span>
              {selected.permite_comisiones && <span className="commission">Comisiones habilitadas</span>}
            </div>

            <div className="payroll-detail-summary-grid">
              <article>
                <small>Monto base</small>
                <strong>{money(selectedLiq?.sueldo_base ?? selected.sueldo_base)}</strong>
                <p>Se puede editar y dejar pendiente hasta confirmar el monto real.</p>
              </article>
              <article>
                <small>Comisiones del período</small>
                <strong>{selected.codigo === 'MAR' ? money(totalComisiones) : 'No aplica'}</strong>
                <p>{selected.codigo === 'MAR' ? 'Vinculadas con cotizaciones y proyectos.' : 'Este colaborador no recibe comisiones.'}</p>
              </article>
              <article>
                <small>Total a pagar</small>
                <strong>{money(selectedLiq?.total_pagar)}</strong>
                <p>{periodoLabel(periodo)}</p>
              </article>
              <article>
                <small>Estado</small>
                <strong>{selectedLiq?.estado === 'PAGADO' ? 'Pagado' : selectedLiq?.estado === 'POR_PAGAR' ? 'Por pagar' : 'Pendiente'}</strong>
                <p>{selectedLiq?.fecha_pago ? `Fecha de pago: ${formatoFecha(selectedLiq.fecha_pago)}` : 'Sin fecha registrada.'}</p>
              </article>
            </div>

            <div className="payroll-detail-grid-2">
              <section className="payroll-info-card">
                <div className="payroll-info-card-head">
                  <h3><FestosIcon name="ClipboardList" size={18} /> Datos del colaborador</h3>
                </div>
                <div className="payroll-info-list">
                  <div><small>Correo</small><strong>{selected.correo || 'Sin registrar'}</strong></div>
                  <div><small>Número</small><strong>{selected.telefono || 'Sin registrar'}</strong></div>
                  <div><small>Banco</small><strong>{selected.banco || 'Sin registrar'}</strong></div>
                  <div><small>Cuenta bancaria</small><strong>{selected.cuenta_bancaria || 'Sin registrar'}</strong></div>
                  <div><small>CCI</small><strong>{selected.cci || 'Sin registrar'}</strong></div>
                  <div><small>DNI / documento</small><strong>{selected.documento || 'Sin registrar'}</strong></div>
                  <div><small>RUC</small><strong>{selected.ruc || 'Sin registrar'}</strong></div>
                  <div><small>Ingreso</small><strong>{formatoFecha(selected.fecha_ingreso)}</strong></div>
                </div>
              </section>

              <section className="payroll-info-card">
                <div className="payroll-info-card-head">
                  <h3><FestosIcon name="CreditCard" size={18} /> Pagos y liquidación</h3>
                </div>
                <div className="payroll-info-list">
                  <div><small>Periodo</small><strong>{periodoLabel(periodo)}</strong></div>
                  <div><small>Frecuencia</small><strong>{frecuenciaLabel(selected.frecuencia_pago)}</strong></div>
                  <div><small>Modalidad</small><strong>{modalidadLabel(selected.modalidad_pago)}</strong></div>
                  <div><small>Medio de pago</small><strong>{selectedLiq?.medio_pago || 'Transferencia bancaria'}</strong></div>
                  <div><small>Fecha de pago</small><strong>{selectedLiq?.fecha_pago ? formatoFecha(selectedLiq.fecha_pago) : 'Pendiente'}</strong></div>
                  <div><small>Bonos</small><strong>{money(selectedLiq?.bonos ?? 0)}</strong></div>
                  <div><small>Descuentos</small><strong>{money(selectedLiq?.descuentos ?? 0)}</strong></div>
                  <div><small>Total final</small><strong>{money(selectedLiq?.total_pagar)}</strong></div>
                </div>
              </section>
            </div>

            {selected.codigo === 'MAR' && (
              <div className="payroll-commissions">
                <div className="payroll-panel-head">
                  <div>
                    <h3>Comisiones vinculadas</h3>
                    <p>Cotizaciones y proyectos del período.</p>
                  </div>
                  {puedeGestionar && <button className="btn-primary" onClick={() => setNuevaComision(true)}><FestosIcon name="Plus" size={15} /> Nueva comisión</button>}
                </div>
                {selectedComisiones.length ? selectedComisiones.map((c) => (
                  <div className="payroll-commission-row" key={c.id}>
                    <i><FestosIcon name={c.origen === 'PROYECTO' ? 'FolderKanban' : 'FileText'} size={18} /></i>
                    <span><strong>{c.origen}</strong><small>{c.referencia || c.descripcion || 'Sin referencia'}</small></span>
                    <b>{money(c.monto)}</b>
                  </div>
                )) : <p className="payroll-empty">Todavía no hay comisiones registradas para este período.</p>}
              </div>
            )}

            <section className="payroll-info-card payroll-doc-section">
              <div className="payroll-info-card-head">
                <div>
                  <h3><FestosIcon name="Upload" size={18} /> Almacén de RXH y adjuntos</h3>
                  <p>Recibos por honorarios, constancias y comprobantes por persona.</p>
                </div>
              </div>

              {puedeGestionar && (
                <div className="payroll-upload-box">
                  <div className="payroll-form-grid payroll-form-grid-3 compact">
                    <label>
                      <span>Tipo</span>
                      <select value={docForm.tipo} onChange={(e) => setDocForm({ ...docForm, tipo: e.target.value })}>
                        <option value="RXH">Recibo por honorarios</option>
                        <option value="CONSTANCIA">Constancia</option>
                        <option value="CONTRATO">Contrato</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </label>
                    <label>
                      <span>Periodo</span>
                      <input type="month" value={docForm.periodo} onChange={(e) => setDocForm({ ...docForm, periodo: e.target.value })} />
                    </label>
                    <label>
                      <span>Archivo</span>
                      <input type="file" onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })} />
                    </label>
                  </div>
                  <div className="payroll-upload-actions">
                    <button type="button" className="btn-primary" onClick={subirDocumento} disabled={subiendoDocumento || !docForm.file}>
                      <FestosIcon name="Upload" size={15} /> {subiendoDocumento ? 'Subiendo...' : 'Subir adjunto'}
                    </button>
                  </div>
                </div>
              )}

              <div className="payroll-doc-list">
                {selectedDocs.length ? selectedDocs.map((doc) => <DocumentoRow key={doc.id} documento={doc} onDownload={descargarDocumento} />) : <p className="payroll-empty">Todavía no hay RXH ni adjuntos cargados para este colaborador.</p>}
              </div>
            </section>
          </section>
        </div>
      )}

      {editando && (
        <ModalEmpleado
          empleado={editando}
          onClose={() => setEditando(null)}
          onSaved={async () => {
            await refrescarEmpleadoSeleccionado(editando.codigo);
            setEditando(null);
          }}
        />
      )}

      {nuevaComision && mar && <ModalComision empleado={mar} periodo={periodo} onClose={() => setNuevaComision(false)} onSaved={cargar} />}

      {loading && <div className="payroll-loading-inline">Cargando información de planilla...</div>}
      {!loading && !empleados.length && <div className="payroll-loading-inline">No hay empleados registrados todavía.</div>}
      {!loading && liquidacionesPendientes > 0 ? null : null}
    </div>
  );
}
