import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { jsPDF } from 'jspdf';

const IGV_RATE = 0.18;
const money = (v) => `S/. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0)}`;
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

const emptyClient = { nombre: '', ruc: '', tipo_documento: 'RUC', categoria: '', tipo_pago: 'CONTADO', plazo_dias: 0, estado: true };
const emptyClientContact = { telefono: '', nombre: '', cargo: '' };
const emptyProject = { nombre: '', descripcion: '', estado: 'EN PROCESO', client_id: '', ejecutivo: 'GONZALO', lob: 'Espacio de estructuras' };
const emptyProveedor = { categoria: '', nombre: '', productos: '', telefono: '', contacto_nombre: '', condicion_pago: 'CONTADO', plazo_dias: 0, observaciones: '', estado: true };
const CATEGORIAS_PROVEEDOR = ['Imprenta', 'Publicidad', 'Materiales', 'Transporte', 'Servicios', 'Equipamiento', 'Tecnología', 'Otros'];
const newItem = () => ({ id: id(), descripcion: '', cantidad: 1, valor_unitario: '', valor_total: '', costo: '' });

// Realtime: mantiene los directorios sincronizados sin recargar la página.
const suscribirTabla = (tabla, onChange) => {
  const channel = supabase
    .channel(`festos-${tabla}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: tabla }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};

const xmlEscape = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const excelCell = (value, style = 0, numeric = false) => {
  if (numeric && Number.isFinite(Number(value))) return `<c s="${style}"><v>${Number(value)}</v></c>`;
  return `<c s="${style}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
};

const excelRowsXml = rows => rows.map((row, rowIndex) => {
  const cells = row.map(cell => excelCell(cell.value, cell.style || 0, !!cell.numeric));
  return `<row r="${rowIndex + 1}">${cells.join('')}</row>`;
}).join('');

const crc32 = bytes => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const u16 = n => new Uint8Array([n & 255, (n >>> 8) & 255]);
const u32 = n => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
const concatBytes = arrays => { const total = arrays.reduce((n, a) => n + a.length, 0); const out = new Uint8Array(total); let offset = 0; arrays.forEach(a => { out.set(a, offset); offset += a.length; }); return out; };

// Genera un XLSX real, sin depender de librerías externas. Usa ZIP sin compresión,
// suficiente para archivos de cotización y evita que Excel muestre valores entre comillas.
const createXlsxBlob = async files => {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  files.forEach(file => {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = concatBytes([
      u32(0x04034b50), u16(20), u16(0x800), u16(0), u16(dosTime), u16(dosDate), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data
    ]);
    localParts.push(local);
    const central = concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0x800), u16(0), u16(dosTime), u16(dosDate), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name
    ]);
    centralParts.push(central);
    offset += local.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const localDirectory = concatBytes(localParts);
  const end = concatBytes([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralDirectory.length), u32(localDirectory.length), u16(0)]);
  return new Blob([localDirectory, centralDirectory, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

const buildSheetXml = (rows, widths = []) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${excelRowsXml(rows)}</sheetData><autoFilter ref="A1:${String.fromCharCode(64 + Math.max(1, widths.length))}${rows.length}"/></worksheet>`;

const xlsxStylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="4" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font><font><b/><sz val="11"/><color rgb="FF224248"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF224248"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F0F0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDEDEA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F5F5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE8CC"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD0DBDC"/></left><right style="thin"><color rgb="FFD0DBDC"/></right><top style="thin"><color rgb="FFD0DBDC"/></top><bottom style="thin"><color rgb="FFD0DBDC"/></bottom><diagonal/></border><border><left style="medium"><color rgb="FF224248"/></left><right style="medium"><color rgb="FF224248"/></right><top style="medium"><color rgb="FF224248"/></top><bottom style="medium"><color rgb="FF224248"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="2" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="4" fontId="0" fillId="3" borderId="1" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="165" fontId="2" fillId="3" borderId="1" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="5" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs></styleSheet>`;

const xlsxBaseFiles = (sheet1, sheet2) => [
  { name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
  { name: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
  { name: 'docProps/core.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Control Festos - Cotización</dc:title><dc:creator>Control Festos</dc:creator><dc:subject>Exportación de cotización</dc:subject></cp:coreProperties>` },
  { name: 'docProps/app.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Control Festos</Application></Properties>` },
  { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cotización" sheetId="1" r:id="rId1"/><sheet name="Ítems" sheetId="2" r:id="rId2"/></sheets></workbook>` },
  { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
  { name: 'xl/styles.xml', content: xlsxStylesXml },
  { name: 'xl/worksheets/sheet1.xml', content: sheet1 },
  { name: 'xl/worksheets/sheet2.xml', content: sheet2 }
];

export function Clientes({ onNotify, onAudit, puedeGestionar = true }) {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroPago, setFiltroPago] = useState('TODAS');
  const [form, setForm] = useState(emptyClient);
  const [editando, setEditando] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const [detalleAbierto, setDetalleAbierto] = useState(null);
  const [contactos, setContactos] = useState([]);
  const [contactoForm, setContactoForm] = useState(emptyClientContact);
  const [mostrarContactoForm, setMostrarContactoForm] = useState(false);

  const cargar = async () => {
    const { data, error } = await supabase.from('clientes').select('*').order('nombre');
    if (error) { console.error(error); return; }
    setClientes(data || []);
  };
  useEffect(() => { cargar(); const unsubscribe = suscribirTabla('clientes', () => cargar()); return unsubscribe; }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return clientes.filter(c => {
      const texto = `${c.nombre} ${c.ruc} ${c.tipo_documento} ${c.tipo_pago} ${c.plazo_dias}`.toLowerCase();
      const fecha = c.created_at ? c.created_at.slice(0, 10) : '';
      return (!q || texto.includes(q)) &&
        (!fechaDesde || (fecha && fecha >= fechaDesde)) &&
        (!fechaHasta || (fecha && fecha <= fechaHasta)) &&
        (filtroPago === 'TODAS' || String(c.tipo_pago || '').toUpperCase() === filtroPago); 
    });
  }, [clientes, busqueda, fechaDesde, fechaHasta, filtroPago]);

  const abrirNuevo = () => {
    setEditando(null); setForm(emptyClient); setContactos([]); setContactoForm(emptyClientContact); setMostrarContactoForm(false); setModalAbierto(true);
  };
  const editar = c => {
    if (!puedeGestionar) return;
    setMenuAbierto(null); setEditando(c); setForm({ ...emptyClient, ...c, tipo_pago: String(c.tipo_pago || 'CONTADO').toUpperCase() }); setContactos([]); setContactoForm(emptyClientContact); setMostrarContactoForm(false); setModalAbierto(true);
    (async () => { const { data } = await supabase.from('cliente_contactos').select('*').eq('cliente_id', c.id).order('created_at'); setContactos(data || []); })();
  };
  const guardar = async e => {
    e.preventDefault();
    if (!puedeGestionar) return;
    if (!form.nombre.trim() || !form.ruc.trim()) return alert('Completa el nombre y N° de documento.');
    if (form.tipo_pago === 'CREDITO' && num(form.plazo_dias) <= 0) return alert('Indica un plazo mayor a 0 días para crédito.');
    setCargando(true);
    try {
      const payload = { nombre: form.nombre.trim(), ruc: form.ruc.trim(), tipo_documento: form.tipo_documento, categoria: form.categoria.trim() || null, tipo_pago: form.tipo_pago, plazo_dias: form.tipo_pago === 'CONTADO' ? 0 : Math.trunc(num(form.plazo_dias)), estado: !!form.estado };
      let clienteId = editando?.id;
      const result = editando
        ? await supabase.from('clientes').update(payload).eq('id', editando.id)
        : await supabase.from('clientes').insert([{ ...payload, id: (clienteId = id()) }]);
      if (result.error) throw result.error;
      clienteId = clienteId || result.data?.[0]?.id;
      if (clienteId) { await supabase.from('cliente_contactos').delete().eq('cliente_id', clienteId); if (contactos.length) { const { error: contactError } = await supabase.from('cliente_contactos').insert(contactos.map(c => ({ id: c.id || id(), cliente_id: clienteId, telefono: c.telefono.trim(), nombre: c.nombre.trim(), cargo: c.cargo.trim() }))); if (contactError) throw contactError; } }
      onNotify(editando ? `Cliente actualizado: ${payload.nombre}` : `Nuevo cliente registrado: ${payload.nombre}`, editando ? 'edicion' : 'nuevo');
      onAudit(editando ? 'Edición' : 'Creación', `${editando ? 'Cliente actualizado' : 'Cliente creado'} · ${payload.nombre}`);
      setForm(emptyClient); setEditando(null); setContactos([]); setContactoForm(emptyClientContact); setMostrarContactoForm(false); setModalAbierto(false); await cargar();
    } catch (err) {
      console.error(err); alert(`No se pudo guardar el cliente. ${err?.message || ''}`);
    } finally { setCargando(false); }
  };
  const toggle = async c => {
    if (!puedeGestionar) return;
    const { error } = await supabase.from('clientes').update({ estado: !c.estado }).eq('id', c.id);
    if (error) return alert('No se pudo cambiar el estado.');
    setMenuAbierto(null);
    onAudit('Edición', `${c.nombre} · ${c.estado ? 'Desactivado' : 'Activado'}`);
    await cargar();
  };

  return <div onClick={() => menuAbierto && setMenuAbierto(null)}>
    <div className="section-header">
      <div><h3 className="section-title">👥 Clientes</h3><p className="panel-note">Directorio de clientes reutilizable en proyectos y cotizaciones.</p></div>
      {puedeGestionar && <button className="btn-primary" onClick={e => { e.stopPropagation(); abrirNuevo(); }}>+ Nuevo cliente</button>}
    </div>
    <div className="glass-card form-card business-toolbar">
      <div className="toolbar-search-row">
        <input className="search-input" placeholder="Buscar cliente o documento..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>
      <div className="toolbar-filter-row">
        <div className="date-filter-group"><label>Desde <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} /></label><label>Hasta <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} /></label></div>
        <select className="business-payment-filter" value={filtroPago} onChange={e => setFiltroPago(e.target.value)}><option value="TODAS">Condición de pago: Todas</option><option value="CONTADO">CONTADO</option><option value="CREDITO">CRÉDITO</option></select>
        <button type="button" className="btn-muted btn-filter-clear" onClick={() => { setBusqueda(''); setFechaDesde(''); setFechaHasta(''); setFiltroPago('TODAS'); }}>Limpiar filtros</button>
      </div>
    </div>
    <div className="business-record-list">
      {filtrados.length === 0 ? <p className="empty-hint">No hay clientes con los filtros actuales.</p> : filtrados.map(c => {
        const abierto = detalleAbierto === c.id;
        return <article className={`business-pro-card ${abierto ? 'is-open' : ''}`} key={c.id}>
          <div className="business-pro-main">
            <div className="business-identity">
              <span className={`business-status-dot ${c.estado ? 'status-active' : 'status-inactive'}`} />
              <div><div className="business-code">{c.codigo || 'CLIENTE'}</div><h4>{c.nombre}</h4><div className="business-subline"><span>{c.tipo_documento} {c.ruc}</span><span>•</span><span>{c.categoria || 'Sin categoría'}</span><span>•</span><span>{String(c.tipo_pago || '').toUpperCase()}{String(c.tipo_pago || '').toUpperCase() === 'CREDITO' ? ' · ' + String(c.plazo_dias || 0) + ' días' : ''}</span></div></div>
            </div>
            <div className="business-date-value"><span>Registro</span><strong>{c.created_at ? new Date(c.created_at).toLocaleDateString('es-PE') : '—'}</strong></div>
            <div className="business-menu-wrap">
              <button type="button" className="quote-more-btn" onClick={e => { e.stopPropagation(); setMenuAbierto(menuAbierto === c.id ? null : c.id); }}>⋮</button>
              {menuAbierto === c.id && <div className="quote-action-menu" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setMenuAbierto(null); setDetalleAbierto(abierto ? null : c.id); }}>⌄ <span>{abierto ? 'Ocultar detalle' : 'Ver detalle'}</span></button>
                {puedeGestionar && <button onClick={() => editar(c)}>✏️ <span>Editar cliente</span></button>}
                {puedeGestionar && <button className={c.estado ? 'danger' : ''} onClick={() => toggle(c)}>{c.estado ? '⏸' : '✓'} <span>{c.estado ? 'Desactivar cliente' : 'Activar cliente'}</span></button>}
              </div>}
            </div>
          </div>
          <button type="button" className="quote-expand-bar" onClick={() => setDetalleAbierto(abierto ? null : c.id)}><span>{abierto ? 'Ocultar detalle' : 'Ver detalle completo'}</span><span className={`quote-expand-chevron ${abierto ? 'open' : ''}`}>⌄</span></button>
          {abierto && <div className="business-detail-grid">
            <div><span>Documento</span><strong>{c.tipo_documento} {c.ruc}</strong></div><div><span>Categoría</span><strong>{c.categoria || 'Sin categoría'}</strong></div><div><span>Condición de pago</span><strong>{String(c.tipo_pago || '').toUpperCase()}</strong></div><div><span>Plazo</span><strong>{String(c.tipo_pago || '').toUpperCase() === 'CREDITO' ? `${c.plazo_dias} días` : 'Inmediato'}</strong></div><div><span>Estado</span><strong>{c.estado ? 'Activo' : 'Inactivo'}</strong></div><div><span>Fecha de registro</span><strong>{c.created_at ? new Date(c.created_at).toLocaleString('es-PE') : '—'}</strong></div>
          </div>}
        </article>;
      })}
    </div>
    {modalAbierto && <div className="modal-overlay" onClick={() => !cargando && setModalAbierto(false)}>
      <form onSubmit={guardar} className="glass-card modal-card business-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><h4 className="panel-title">{editando ? '✏️ Editar cliente' : '➕ Registrar cliente'}</h4><p className="panel-note">Completa la información del cliente.</p></div><button type="button" className="modal-close-btn" onClick={() => setModalAbierto(false)}>×</button></div>
        <div className="form-row"><label>Cliente / Razón Social *</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required /></div>
        <div className="form-row"><label>Categoría</label><input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="Ej. Corporativo, Retail, Gobierno..." /></div><div className="form-grid-2"><div className="form-row"><label>Tipo documento *</label><select value={form.tipo_documento} onChange={e => setForm({ ...form, tipo_documento: e.target.value })}><option>RUC</option><option>DNI</option></select></div><div className="form-row"><label>N° DOC *</label><input value={form.ruc} onChange={e => setForm({ ...form, ruc: e.target.value })} inputMode="numeric" required /></div></div>
        <div className="form-grid-2"><div className="form-row"><label>CONDICIÓN DE PAGO *</label><select value={form.tipo_pago} onChange={e => setForm({ ...form, tipo_pago: e.target.value, plazo_dias: e.target.value === 'CONTADO' ? 0 : form.plazo_dias })}><option value="CONTADO">CONTADO</option><option value="CREDITO">CRÉDITO</option></select></div><div className="form-row"><label>Plazo (días) *</label><input type="number" min="0" step="1" value={form.plazo_dias} disabled={form.tipo_pago === 'CONTADO'} onChange={e => setForm({ ...form, plazo_dias: e.target.value })} /></div></div><div className="contactos-section"><div className="contactos-head"><div><strong>Contactos</strong><small>Agrega los contactos del cliente.</small></div><button type="button" className="btn-muted" onClick={() => setMostrarContactoForm(v => !v)}>+ Agregar contacto</button></div>{mostrarContactoForm && <div className="contacto-editor"><input placeholder="Telefono:" value={contactoForm.telefono} onChange={e => setContactoForm({ ...contactoForm, telefono: e.target.value })} /><input placeholder="Nombre:" value={contactoForm.nombre} onChange={e => setContactoForm({ ...contactoForm, nombre: e.target.value })} /><input placeholder="Cargo:" value={contactoForm.cargo} onChange={e => setContactoForm({ ...contactoForm, cargo: e.target.value })} /><button type="button" className="btn-primary" onClick={() => { if (!contactoForm.telefono.trim() && !contactoForm.nombre.trim() && !contactoForm.cargo.trim()) return; setContactos(prev => [...prev, { ...contactoForm, id: id() }]); setContactoForm(emptyClientContact); setMostrarContactoForm(false); }}>Guardar contacto</button></div>}{contactos.length > 0 && <div className="contactos-list">{contactos.map((ct, i) => <div className="contacto-chip" key={ct.id || i}><div><strong>{ct.nombre || 'Contacto'}</strong><span>{ct.telefono || '—'} · {ct.cargo || '—'}</span></div><button type="button" onClick={() => setContactos(prev => prev.filter(x => x.id !== ct.id))}>×</button></div>)}</div>}</div>
        <label className="checkbox-label"><input type="checkbox" checked={!!form.estado} onChange={e => setForm({ ...form, estado: e.target.checked })} /> Cliente activo</label>
        <div className="modal-actions"><button className="btn-primary" disabled={cargando}>{cargando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar cliente'}</button><button type="button" className="btn-secondary" onClick={() => setModalAbierto(false)}>Cancelar</button></div>
      </form>
    </div>}
  </div>;
}


export function Proveedores({ onNotify, onAudit, puedeGestionar = true }) {
  const [proveedores, setProveedores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroPago, setFiltroPago] = useState('TODAS');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
  const [form, setForm] = useState(emptyProveedor);
  const [editando, setEditando] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const [detalleAbierto, setDetalleAbierto] = useState(null);
  const [contactos, setContactos] = useState([]);
  const [contactoForm, setContactoForm] = useState({ telefono: '', nombre: '' });
  const [mostrarContactoForm, setMostrarContactoForm] = useState(false);

  const cargar = async () => {
    const { data, error } = await supabase.from('proveedores').select('*').order('nombre');
    if (error) { console.error(error); return; }
    setProveedores(data || []);
  };

  useEffect(() => { cargar(); const unsubscribe = suscribirTabla('proveedores', () => cargar()); return unsubscribe; }, []);

  const categoriasDisponibles = useMemo(() => [...new Set([...CATEGORIAS_PROVEEDOR, ...proveedores.map(p => String(p.categoria || '').trim()).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'es')), [proveedores]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return proveedores.filter(p => {
      const texto = `${p.categoria} ${p.nombre} ${p.productos} ${p.telefono} ${p.observaciones || ''}`.toLowerCase();
      const fecha = p.created_at ? p.created_at.slice(0, 10) : '';
      return (!q || texto.includes(q)) &&
        (!fechaDesde || (fecha && fecha >= fechaDesde)) &&
        (!fechaHasta || (fecha && fecha <= fechaHasta)) &&
        (filtroPago === 'TODAS' || String(p.condicion_pago || '').toUpperCase() === filtroPago) &&
        (filtroCategoria === 'TODAS' || String(p.categoria || '').trim() === filtroCategoria);
    });
  }, [proveedores, busqueda, fechaDesde, fechaHasta, filtroPago, filtroCategoria]);

  const abrirNuevo = () => { setEditando(null); setForm(emptyProveedor); setContactos([]); setContactoForm({ telefono: '', nombre: '' }); setMostrarContactoForm(false); setModalAbierto(true); };
  const editar = p => { if (!puedeGestionar) return; setMenuAbierto(null); setEditando(p); setForm({ ...emptyProveedor, ...p, condicion_pago: String(p.condicion_pago || 'CONTADO').toUpperCase(), plazo_dias: Number(p.plazo_dias) || 0 }); setContactos([]); setContactoForm({ telefono: '', nombre: '' }); setMostrarContactoForm(false); setModalAbierto(true); (async () => { const { data } = await supabase.from('proveedor_contactos').select('*').eq('proveedor_id', p.id).order('created_at'); setContactos(data || []); })(); };
  const guardar = async e => {
    e.preventDefault(); if (!puedeGestionar) return;
    if (!form.categoria.trim() || !form.nombre.trim()) return alert('Completa la categoría y la razón social del proveedor.');
    if (!form.productos.trim()) return alert('Indica el producto/servicio que vende.');
    if (form.condicion_pago === 'CREDITO' && num(form.plazo_dias) <= 0) return alert('Indica un plazo mayor a 0 días para crédito.');
    setCargando(true);
    try {
      const payload = { categoria: form.categoria.trim(), nombre: form.nombre.trim(), productos: form.productos.trim(), telefono: form.telefono.trim() || null, contacto_nombre: form.contacto_nombre.trim() || null, condicion_pago: form.condicion_pago, plazo_dias: form.condicion_pago === 'CONTADO' ? 0 : Math.trunc(num(form.plazo_dias)), observaciones: form.observaciones.trim() || null, estado: !!form.estado };
      let proveedorId = editando?.id; if (!proveedorId) proveedorId = id(); const result = editando ? await supabase.from('proveedores').update(payload).eq('id', editando.id) : await supabase.from('proveedores').insert([{ ...payload, id: proveedorId }]);
      if (result.error) throw result.error;
      await supabase.from('proveedor_contactos').delete().eq('proveedor_id', proveedorId); if (contactos.length) { const { error: contactError } = await supabase.from('proveedor_contactos').insert(contactos.map(c => ({ id: c.id || id(), proveedor_id: proveedorId, telefono: c.telefono.trim(), nombre: c.nombre.trim() }))); if (contactError) throw contactError; }
      onNotify(editando ? `Proveedor actualizado: ${payload.nombre}` : `Nuevo proveedor registrado: ${payload.nombre}`, editando ? 'edicion' : 'nuevo');
      onAudit(editando ? 'Edición' : 'Creación', `${editando ? 'Proveedor actualizado' : 'Proveedor creado'} · ${payload.nombre}`);
      setForm(emptyProveedor); setEditando(null); setContactos([]); setContactoForm({ telefono: '', nombre: '' }); setMostrarContactoForm(false); setModalAbierto(false); await cargar();
    } catch (err) { console.error(err); alert(`No se pudo guardar el proveedor. ${err?.message || ''}`); }
    finally { setCargando(false); }
  };
  const toggle = async p => {
    if (!puedeGestionar) return;
    const { error } = await supabase.from('proveedores').update({ estado: !p.estado }).eq('id', p.id);
    if (error) return alert('No se pudo cambiar el estado.');
    setMenuAbierto(null); onAudit('Edición', `${p.nombre} · ${p.estado ? 'Desactivado' : 'Activado'}`); await cargar();
  };

  return <div onClick={() => menuAbierto && setMenuAbierto(null)}>
    <div className="section-header">
      <div><h3 className="section-title">🚚 Proveedores</h3><p className="panel-note">Directorio de proveedores por categoría, productos y contacto.</p></div>
      {puedeGestionar && <button className="btn-primary" onClick={e => { e.stopPropagation(); abrirNuevo(); }}>+ Nuevo proveedor</button>}
    </div>
    <div className="glass-card form-card business-toolbar">
      <div className="toolbar-search-row">
        <input className="search-input" placeholder="Buscar por nombre, categoría, producto o teléfono..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>
      <div className="toolbar-filter-row">
        <div className="date-filter-group"><label>Desde <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} /></label><label>Hasta <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} /></label></div>
        <select className="business-payment-filter" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}><option value="TODAS">Categoría: Todas</option>{categoriasDisponibles.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
        <select className="business-payment-filter" value={filtroPago} onChange={e => setFiltroPago(e.target.value)}><option value="TODAS">Condición de pago: Todas</option><option value="CONTADO">CONTADO</option><option value="CREDITO">CRÉDITO</option></select>
        <button type="button" className="btn-muted btn-filter-clear" onClick={() => { setBusqueda(''); setFechaDesde(''); setFechaHasta(''); setFiltroPago('TODAS'); setFiltroCategoria('TODAS'); }}>Limpiar filtros</button>
      </div>
    </div>
    <div className="business-record-list">
      {filtrados.length === 0 ? <p className="empty-hint">No hay proveedores con los filtros actuales.</p> : filtrados.map(p => {
        const abierto = detalleAbierto === p.id;
        return <article className={`business-pro-card ${abierto ? 'is-open' : ''}`} key={p.id}>
          <div className="business-pro-main">
            <div className="business-identity">
              <span className={`business-status-dot ${p.estado ? 'status-active' : 'status-inactive'}`} />
              <div><div className="business-code">{p.codigo || 'PROVEEDOR'}</div><h4>{p.nombre}</h4><div className="business-subline"><span>{p.categoria}</span><span>•</span><span>{p.telefono || 'Sin teléfono'}</span><span>•</span><span>{String(p.condicion_pago || 'CONTADO').toUpperCase()}</span>{String(p.condicion_pago || 'CONTADO').toUpperCase() === 'CREDITO' && <span className="payment-term-badge">📅 {Number(p.plazo_dias) || 0} días</span>}</div></div>
            </div>
            <div className="business-date-value"><span>Registro</span><strong>{p.created_at ? new Date(p.created_at).toLocaleDateString('es-PE') : '—'}</strong></div>
            <div className="business-menu-wrap">
              <button type="button" className="quote-more-btn" onClick={e => { e.stopPropagation(); setMenuAbierto(menuAbierto === p.id ? null : p.id); }}>⋮</button>
              {menuAbierto === p.id && <div className="quote-action-menu" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setMenuAbierto(null); setDetalleAbierto(abierto ? null : p.id); }}>⌄ <span>{abierto ? 'Ocultar detalle' : 'Ver detalle'}</span></button>
                {puedeGestionar && <button onClick={() => editar(p)}>✏️ <span>Editar proveedor</span></button>}
                {puedeGestionar && <button className={p.estado ? 'danger' : ''} onClick={() => toggle(p)}>{p.estado ? '⏸' : '✓'} <span>{p.estado ? 'Desactivar proveedor' : 'Activar proveedor'}</span></button>}
              </div>}
            </div>
          </div>
          <button type="button" className="quote-expand-bar" onClick={() => setDetalleAbierto(abierto ? null : p.id)}><span>{abierto ? 'Ocultar detalle' : 'Ver detalle completo'}</span><span className={`quote-expand-chevron ${abierto ? 'open' : ''}`}>⌄</span></button>
          {abierto && <div className="business-detail-grid">
            <div><span>Categoría</span><strong>{p.categoria || '—'}</strong></div><div><span>Productos</span><strong>{p.productos || '—'}</strong></div><div><span>Teléfono</span><strong>{p.telefono || '—'}</strong></div><div><span>Nombre de contacto</span><strong>{p.contacto_nombre || '—'}</strong></div><div><span>Condición de pago</span><strong>{String(p.condicion_pago || 'CONTADO').toUpperCase()}</strong></div><div><span>Plazo</span><strong>{String(p.condicion_pago || 'CONTADO').toUpperCase() === 'CREDITO' ? `${Number(p.plazo_dias) || 0} días` : 'Inmediato'}</strong></div><div><span>Estado</span><strong>{p.estado ? 'Activo' : 'Inactivo'}</strong></div><div><span>Fecha de registro</span><strong>{p.created_at ? new Date(p.created_at).toLocaleString('es-PE') : '—'}</strong></div>
            {p.observaciones && <div className="business-detail-wide"><span>Observaciones</span><strong>{p.observaciones}</strong></div>}
          </div>}
        </article>;
      })}
    </div>
    {modalAbierto && <div className="modal-overlay" onClick={() => !cargando && setModalAbierto(false)}>
      <form onSubmit={guardar} className="glass-card modal-card business-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><h4 className="panel-title">{editando ? '✏️ Editar proveedor' : '➕ Registrar proveedor'}</h4><p className="panel-note">Completa la información del proveedor.</p></div><button type="button" className="modal-close-btn" onClick={() => setModalAbierto(false)}>×</button></div>
        <div className="form-grid-2"><div className="form-row"><label>Categoría *</label><input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} list="categorias-proveedor" placeholder="Ej. Imprenta" required /><datalist id="categorias-proveedor">{CATEGORIAS_PROVEEDOR.map(c => <option key={c} value={c} />)}</datalist></div><div className="form-row"><label>RAZÓN SOCIAL *</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required /></div></div>
        <div className="form-row"><label>PRODUCTO/SERVICIO QUE VENDE *</label><input value={form.productos} onChange={e => setForm({ ...form, productos: e.target.value })} placeholder="Ej. Banners, tarjetas personalizadas..." required /></div>
        <div className="form-grid-2"><div className="form-row"><label>Teléfono</label><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+51 999 999 999" /></div><div className="form-row"><label>NOMBRE</label><input value={form.contacto_nombre} onChange={e => setForm({ ...form, contacto_nombre: e.target.value })} placeholder="Nombre del contacto principal" /></div></div><div className="form-grid-2"><div className="form-row"><label>CONDICIÓN DE PAGO *</label><select value={form.condicion_pago} onChange={e => setForm({ ...form, condicion_pago: e.target.value, plazo_dias: e.target.value === 'CONTADO' ? 0 : form.plazo_dias })}><option>CONTADO</option><option>CREDITO</option></select></div><div className="form-row"><label>Plazo (días) *</label><input type="number" min="0" step="1" value={form.plazo_dias} disabled={form.condicion_pago === 'CONTADO'} onChange={e => setForm({ ...form, plazo_dias: e.target.value })} /></div></div><div className="contactos-section"><div className="contactos-head"><div><strong>Contactos</strong><small>Agrega los contactos del proveedor.</small></div><button type="button" className="btn-muted" onClick={() => setMostrarContactoForm(v => !v)}>+ Agregar contacto</button></div>{mostrarContactoForm && <div className="contacto-editor provider-contact-editor"><input placeholder="TELEFONO" value={contactoForm.telefono} onChange={e => setContactoForm({ ...contactoForm, telefono: e.target.value })} /><input placeholder="NOMBRE" value={contactoForm.nombre} onChange={e => setContactoForm({ ...contactoForm, nombre: e.target.value })} /><button type="button" className="btn-primary" onClick={() => { if (!contactoForm.telefono.trim() && !contactoForm.nombre.trim()) return; setContactos(prev => [...prev, { ...contactoForm, id: id() }]); setContactoForm({ telefono: '', nombre: '' }); setMostrarContactoForm(false); }}>Guardar contacto</button></div>}{contactos.length > 0 && <div className="contactos-list">{contactos.map((ct, i) => <div className="contacto-chip" key={ct.id || i}><div><strong>{ct.nombre || 'Contacto'}</strong><span>{ct.telefono || '—'}</span></div><button type="button" onClick={() => setContactos(prev => prev.filter(x => x.id !== ct.id))}>×</button></div>)}</div>}</div><div className="form-row"><label>Observaciones</label><input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} placeholder="Notas adicionales" /></div>
        <label className="checkbox-label"><input type="checkbox" checked={!!form.estado} onChange={e => setForm({ ...form, estado: e.target.checked })} /> Proveedor activo</label>
        <div className="modal-actions"><button className="btn-primary" disabled={cargando}>{cargando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar proveedor'}</button><button type="button" className="btn-secondary" onClick={() => setModalAbierto(false)}>Cancelar</button></div>
      </form>
    </div>}
  </div>;
}


export function Proyectos({ usuario, onNotify, onAudit, puedeGestionar = true }) {
  const [clientes, setClientes] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [cotizacionesProyecto, setCotizacionesProyecto] = useState([]);
  const [form, setForm] = useState(emptyProject);
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [filtroCargador, setFiltroCargador] = useState('TODOS');
  const [filtroLob, setFiltroLob] = useState('TODOS');
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const [detalleAbierto, setDetalleAbierto] = useState(null);

  const estadosProyecto = ['EN PROCESO', 'FINALIZADO', 'FACTURADO'];
  const normalizarEstado = estado => {
    const value = String(estado || '').trim().toUpperCase();
    if (value === 'ACTIVO' || value === 'EN PAUSA' || value === 'EN PROCESO') return 'EN PROCESO';
    if (value === 'FINALIZADO') return 'FINALIZADO';
    if (value === 'FACTURADO') return 'FACTURADO';
    return 'EN PROCESO';
  };

  const cargar = async () => {
    const [{ data: c, error: ce }, { data: p, error: pe }, { data: q, error: qe }] = await Promise.all([
      supabase.from('clientes').select('id,nombre,estado').order('nombre'),
      supabase.from('proyectos').select('*, clientes(nombre)').order('created_at', { ascending: false }),
      supabase.from('cotizaciones').select('id,codigo,project_id,proyecto_nombre,subtotal,igv,total,estado,descripcion,created_at,client_id,created_by,lob').order('created_at', { ascending: false })
    ]);
    if (ce || pe || qe) { console.error(ce || pe || qe); return; }
    setClientes(c || []); setProyectos(p || []); setCotizacionesProyecto(q || []);
  };
  useEffect(() => {
    cargar();
    const unsubProyectos = suscribirTabla('proyectos', () => cargar());
    const unsubCotizaciones = suscribirTabla('cotizaciones', () => cargar());
    return () => { unsubProyectos(); unsubCotizaciones(); };
  }, []);

  const quoteForProject = p => cotizacionesProyecto.find(q =>
    q.project_id === p.id || (q.proyecto_nombre || '').trim().toLowerCase() === (p.nombre || '').trim().toLowerCase()
  );
  const valorVenta = p => num(quoteForProject(p)?.subtotal);
  const ejecutivoProyecto = p => String(p.ejecutivo || p.created_by || quoteForProject(p)?.created_by || '').trim() || 'Sin registro';

  const filtrados = useMemo(() => proyectos.filter(p => {
    const q = quoteForProject(p);
    const texto = `${p.nombre} ${p.descripcion || ''} ${p.clientes?.nombre || ''} ${ejecutivoProyecto(p)}`.toLowerCase();
    const fecha = p.created_at ? p.created_at.slice(0, 10) : '';
    const estado = normalizarEstado(p.estado);
    return texto.includes(busqueda.trim().toLowerCase()) &&
      (!fechaDesde || (fecha && fecha >= fechaDesde)) &&
      (!fechaHasta || (fecha && fecha <= fechaHasta)) &&
      (filtroEstado === 'TODOS' || estado === filtroEstado) &&
      (filtroCargador === 'TODOS' || ejecutivoProyecto(p) === filtroCargador) &&
      (filtroLob === 'TODOS' || String(p.lob || q?.lob || '').trim() === filtroLob);
  }), [proyectos, cotizacionesProyecto, busqueda, fechaDesde, fechaHasta, filtroEstado, filtroCargador, filtroLob]);

  const subtotalFiltrado = useMemo(() => filtrados.reduce((sum, p) => sum + valorVenta(p), 0), [filtrados, cotizacionesProyecto]);
  const cargadores = useMemo(() => [...new Set(proyectos.map(ejecutivoProyecto).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [proyectos, cotizacionesProyecto]);
  const lobsProyecto = ['Espacio de estructuras', 'Producción gráfica', 'Producción 360'];

  const abrirNuevo = () => { setEditando(null); setForm(emptyProject); setModalAbierto(true); };
  const editar = p => { if (!puedeGestionar) return; setMenuAbierto(null); setEditando(p); setForm({ nombre: p.nombre, descripcion: p.descripcion || '', estado: normalizarEstado(p.estado), client_id: p.client_id || '', ejecutivo: p.ejecutivo || p.created_by || quoteForProject(p)?.created_by || 'GONZALO', lob: p.lob || quoteForProject(p)?.lob || 'Espacio de estructuras' }); setModalAbierto(true); };
  const puedeEliminarProyecto = String(usuario || '').trim().toLowerCase() === 'gonzalo';
  const eliminarProyecto = async p => {
    if (!puedeEliminarProyecto) return alert('Solo GONZALO puede eliminar proyectos.');
    const ok = window.confirm(`¿Eliminar el proyecto ${p.nombre}?\n\nEsta acción no se puede deshacer.`);
    if (!ok) return;
    setMenuAbierto(null); setCargando(true);
    try { const { error } = await supabase.rpc('eliminar_proyecto_gonzalo', { p_project_id: p.id, p_usuario: usuario }); if (error) throw error; onNotify(`Proyecto eliminado: ${p.nombre}`, 'edicion'); onAudit('Eliminación', `Proyecto eliminado · ${p.nombre}`); await cargar(); } catch (err) { console.error(err); alert(`No se pudo eliminar el proyecto. ${err?.message || ''}`); } finally { setCargando(false); }
  };
  const guardar = async e => {
    e.preventDefault(); if (!puedeGestionar) return;
    if (!form.nombre.trim() || !form.client_id) return alert('Completa el cliente y el nombre del proyecto.');
    setCargando(true);
    try {
      const payload = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, estado: normalizarEstado(form.estado), client_id: form.client_id, ejecutivo: form.ejecutivo || 'GONZALO', lob: form.lob || 'Espacio de estructuras', created_by: editando ? (editando.created_by || quoteForProject(editando)?.created_by || form.ejecutivo || null) : (usuario || form.ejecutivo || null) };
      const result = editando ? await supabase.from('proyectos').update(payload).eq('id', editando.id) : await supabase.from('proyectos').insert([{ ...payload, id: id() }]);
      if (result.error) throw result.error;
      onNotify(editando ? `Proyecto actualizado: ${payload.nombre}` : `Nuevo proyecto registrado: ${payload.nombre}`, editando ? 'edicion' : 'nuevo');
      onAudit(editando ? 'Edición' : 'Creación', `${editando ? 'Proyecto actualizado' : 'Proyecto creado'} · ${payload.nombre}`);
      setForm(emptyProject); setEditando(null); setModalAbierto(false); await cargar();
    } catch (err) { console.error(err); alert(`No se pudo guardar el proyecto. ${err?.message || ''}`); }
    finally { setCargando(false); }
  };

  return <div onClick={() => menuAbierto && setMenuAbierto(null)}>
    <div className="section-header">
      <div><h3 className="section-title">📁 Proyectos</h3><p className="panel-note">Proyectos con cliente, valor de venta, estado y usuario que los cargó.</p></div>
      {puedeGestionar && <button className="btn-primary" onClick={e => { e.stopPropagation(); abrirNuevo(); }}>+ Nuevo proyecto</button>}
    </div>
    <div className="glass-card form-card business-toolbar">
      <div className="toolbar-search-row">
        <input className="search-input" placeholder="Buscar proyecto, cliente o usuario..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>
      <div className="toolbar-filter-row project-filter-row">
        <div className="date-filter-group"><label>Desde <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} /></label><label>Hasta <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} /></label></div>
        <select className="business-payment-filter" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}><option value="TODOS">Estado: Todos</option>{estadosProyecto.map(estado => <option key={estado} value={estado}>{estado}</option>)}</select>
        <select className="business-payment-filter" value={filtroCargador} onChange={e => setFiltroCargador(e.target.value)}><option value="TODOS">Ejecutivo: Todos</option>{cargadores.map(persona => <option key={persona} value={persona}>{persona}</option>)}</select>
        <select className="business-payment-filter" value={filtroLob} onChange={e => setFiltroLob(e.target.value)}><option value="TODOS">LOB: Todos</option>{lobsProyecto.map(lob => <option key={lob} value={lob}>{lob}</option>)}</select>
        <button type="button" className="btn-muted btn-filter-clear" onClick={() => { setBusqueda(''); setFechaDesde(''); setFechaHasta(''); setFiltroEstado('TODOS'); setFiltroCargador('TODOS'); setFiltroLob('TODOS'); }}>Limpiar filtros</button>
      </div>
      <div className="project-filter-subtotal-row"><div className="project-filter-total"><span>Subtotal filtrado</span><strong>{money(subtotalFiltrado)}</strong></div></div>
    </div>
    <div className="business-record-list">
      {filtrados.length === 0 ? <p className="empty-hint">No hay proyectos con los filtros actuales.</p> : filtrados.map(p => {
        const abierto = detalleAbierto === p.id;
        const q = quoteForProject(p);
        const venta = valorVenta(p);
        const estado = normalizarEstado(p.estado);
        const ejecutivo = ejecutivoProyecto(p);
        const lobProyecto = p.lob || q?.lob || 'Sin LOB';
        return <article className={`business-pro-card project-pro-card project-status-${estado.toLowerCase().replace(/\s+/g, '-')} ${abierto ? 'is-open' : ''}`} key={p.id}>
          <div className="business-pro-main">
            <div className="business-identity">
              <span className={`business-status-dot project-dot-${estado.toLowerCase().replace(/\s+/g, '-')}`} />
              <div><div className="business-code">{p.codigo || 'PROYECTO'}</div><h4>{p.nombre}</h4><div className="business-subline"><span>Cliente · {p.clientes?.nombre || 'Sin cliente'}</span><span>•</span><span>{estado}</span><span>•</span><span>Ejecutivo · {ejecutivo}</span></div></div>
            </div>
            <div className="business-date-value"><span>Valor venta</span><strong>{money(venta)}</strong><small>{p.created_at ? new Date(p.created_at).toLocaleDateString('es-PE') : '—'}</small></div>
            <div className="business-menu-wrap">
              <button type="button" className="quote-more-btn" onClick={e => { e.stopPropagation(); setMenuAbierto(menuAbierto === p.id ? null : p.id); }}>⋮</button>
              {menuAbierto === p.id && <div className="quote-action-menu" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setMenuAbierto(null); setDetalleAbierto(abierto ? null : p.id); }}>⌄ <span>{abierto ? 'Ocultar detalle' : 'Ver detalle completo'}</span></button>
                {puedeGestionar && <button onClick={() => editar(p)}>✏️ <span>Editar proyecto</span></button>}
                {puedeEliminarProyecto && <button className="danger" onClick={() => eliminarProyecto(p)}>🗑 <span>Eliminar proyecto</span></button>}
              </div>}
            </div>
          </div>
          <button type="button" className="quote-expand-bar" onClick={() => setDetalleAbierto(abierto ? null : p.id)}><span>{abierto ? 'Ocultar detalle' : 'Ver detalle completo'}</span><span className={`quote-expand-chevron ${abierto ? 'open' : ''}`}>⌄</span></button>
          {abierto && <div className="business-detail-grid">
            <div><span>Cliente</span><strong>{p.clientes?.nombre || '—'}</strong></div><div><span>Estado</span><strong>{estado}</strong></div><div><span>LOB</span><strong>{lobProyecto}</strong></div><div><span>Valor venta</span><strong>{money(venta)}</strong></div><div><span>Ejecutivo</span><strong>{ejecutivo}</strong></div><div><span>Fecha de registro</span><strong>{p.created_at ? new Date(p.created_at).toLocaleString('es-PE') : '—'}</strong></div>
            <div className="business-detail-wide"><span>Descripción</span><strong>{p.descripcion || 'Sin descripción registrada.'}</strong></div>
            {q && <div className="business-detail-wide project-quote-summary"><span>Cotización vinculada</span><strong>{q.codigo} · {q.estado} · LOB: {q.lob || '—'} · Precio total {money(q.total)}</strong><small>{q.descripcion || 'Sin notas adicionales.'}</small></div>}
          </div>}
        </article>;
      })}
    </div>
    {modalAbierto && <div className="modal-overlay" onClick={() => !cargando && setModalAbierto(false)}>
      <form onSubmit={guardar} className="glass-card modal-card business-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><h4 className="panel-title">{editando ? '✏️ Editar proyecto' : '➕ Registrar proyecto'}</h4><p className="panel-note">Asocia el proyecto a un cliente.</p></div><button type="button" className="modal-close-btn" onClick={() => setModalAbierto(false)}>×</button></div>
        <div className="form-row"><label>Cliente *</label><select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} required><option value="">Selecciona un cliente...</option>{clientes.filter(c => c.estado).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
        <div className="form-row"><label>Nombre del proyecto *</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required /></div>
        <div className="form-row"><label>Descripción</label><textarea rows="3" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></div>
        <div className="form-grid-2"><div className="form-row"><label>Estado</label><select value={normalizarEstado(form.estado)} onChange={e => setForm({ ...form, estado: e.target.value })}>{estadosProyecto.map(estado => <option key={estado}>{estado}</option>)}</select></div><div className="form-row"><label>Ejecutivo *</label><select value={form.ejecutivo || 'GONZALO'} onChange={e => setForm({ ...form, ejecutivo: e.target.value })} required><option value="MAR">MAR</option><option value="GONZALO">GONZALO</option></select></div></div><div className="form-row"><label>LOB *</label><select value={form.lob || 'Espacio de estructuras'} onChange={e => setForm({ ...form, lob: e.target.value })} required>{lobsProyecto.map(lob => <option key={lob} value={lob}>{lob}</option>)}</select></div>
        <div className="modal-actions"><button className="btn-primary" disabled={cargando}>{cargando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar proyecto'}</button><button type="button" className="btn-secondary" onClick={() => setModalAbierto(false)}>Cancelar</button></div>
      </form>
    </div>}
  </div>;
}


export function Cotizaciones({ usuario, onNotify, onAudit, puedeAprobar = true }) {
  const [clientes, setClientes] = useState([]); const [proyectos, setProyectos] = useState([]); const [cotizaciones, setCotizaciones] = useState([]); const [vista, setVista] = useState('lista'); const [filtro, setFiltro] = useState('todas'); const [busqueda, setBusqueda] = useState(''); const [fechaDesde, setFechaDesde] = useState(''); const [fechaHasta, setFechaHasta] = useState(''); const [editando, setEditando] = useState(null); const [form, setForm] = useState({ client_id: '', proyecto_nombre: '', project_id: '', lob: 'Espacio de estructuras', descripcion: '', aplicar_igv: true, descuento: 0, modo: 'detallado', items: [newItem()] }); const [cargando, setCargando] = useState(false); const [nuevoCliente, setNuevoCliente] = useState(false); const [itemsEditando, setItemsEditando] = useState(() => new Set()); const [itemsColapsados, setItemsColapsados] = useState(() => new Set()); const [valorVentaDirecto, setValorVentaDirecto] = useState(0); const [clienteRapido, setClienteRapido] = useState(emptyClient); const [menuAbierto, setMenuAbierto] = useState(null); const [detalleAbierto, setDetalleAbierto] = useState(null); const [detalleItems, setDetalleItems] = useState({});
  const cargarDatos = async () => {
    const { data: c, error: ce } = await supabase.from('clientes').select('*').eq('estado', true).order('nombre');
    if (ce) { console.error('Error cargando clientes:', ce); setClientes([]); } else { setClientes(c || []); }

    const { data: p, error: pe } = await supabase.from('proyectos').select('*, clientes(nombre)').order('nombre');
    if (pe) { console.error('Error cargando proyectos:', pe); setProyectos([]); } else { setProyectos(p || []); }

    const { data: q, error: qe } = await supabase.from('cotizaciones').select('*, clientes(nombre), proyectos(nombre)').order('created_at', { ascending: false });
    if (qe) { console.error('Error cargando cotizaciones:', qe); setCotizaciones([]); } else { setCotizaciones(q || []); }
  };
  useEffect(() => {
    cargarDatos();
    const unsubClientes = suscribirTabla('clientes', () => cargarDatos());
    const unsubProyectos = suscribirTabla('proyectos', () => cargarDatos());
    const unsubCotizaciones = suscribirTabla('cotizaciones', () => cargarDatos());
    return () => { unsubClientes(); unsubProyectos(); unsubCotizaciones(); };
  }, []);
  const proyectosDisponibles = form.client_id ? proyectos.filter(p => p.client_id === form.client_id && p.estado !== 'Finalizado') : [];
  const itemTotal = item => num(item.cantidad) * num(item.valor_unitario);
  const subtotalItems = form.items.reduce((s, i) => s + itemTotal(i), 0); const subtotal = form.modo === 'directo' ? num(valorVentaDirecto) : subtotalItems; const descuento = 0; const base = subtotal; const igv = base * IGV_RATE; const total = base + igv; const costo = form.items.reduce((s, i) => s + (num(i.costo_unitario ?? i.costo) * num(i.cantidad)), 0); const ganancia = base - costo; const margen = base > 0 ? (ganancia / base) * 100 : 0;
  const reset = () => { setForm({ client_id: '', proyecto_nombre: '', project_id: '', lob: 'Espacio de estructuras', descripcion: '', aplicar_igv: true, descuento: 0, modo: 'detallado', items: [newItem()] }); setValorVentaDirecto(0); setEditando(null); setItemsEditando(new Set()); setItemsColapsados(new Set()); setVista('lista'); };
  const nuevaCotizacion = () => { const item = newItem(); setEditando(null); setForm({ client_id: '', proyecto_nombre: '', project_id: '', lob: 'Espacio de estructuras', descripcion: '', aplicar_igv: true, descuento: 0, modo: 'detallado', items: [item] }); setValorVentaDirecto(0); setItemsEditando(new Set([item.id])); setItemsColapsados(new Set()); setNuevoCliente(false); setVista('form'); };
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
  const guardar = async (estado = 'Borrador') => { if (estado === 'Aprobado' && !puedeAprobar) return alert('No tienes permiso para aprobar cotizaciones.'); if (!form.client_id) return alert('Selecciona un cliente.'); if (!form.proyecto_nombre.trim()) return alert('Escribe el nombre del proyecto. La cotización no puede guardarse sin proyecto.'); if (!form.items.some(i => i.descripcion.trim() && itemTotal(i) > 0)) return alert('Agrega al menos un ítem con descripción y valor.'); setCargando(true); try { const codigo = editando?.codigo || `COT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`; const payload = { client_id: form.client_id, project_id: editando?.project_id || null, proyecto_nombre: form.proyecto_nombre.trim(), lob: form.lob, codigo, descripcion: form.descripcion.trim() || null, estado, aplicar_igv: true, igv_rate: IGV_RATE, subtotal, descuento: 0, igv, total, costo_estimado: costo, ganancia_estimada: ganancia, margen, updated_by: usuario }; let quoteId = editando?.id; let error; if (editando) { ({ error } = await supabase.from('cotizaciones').update(payload).eq('id', editando.id)); if (!error) { const del = await supabase.from('cotizacion_items').delete().eq('quote_id', editando.id); if (del.error) throw del.error; } } else { quoteId = id(); ({ error } = await supabase.from('cotizaciones').insert([{ ...payload, id: quoteId, created_by: usuario }])); } if (error) throw error; const itemsPayload = form.items.filter(i => i.descripcion.trim()).map((i, index) => ({ id: id(), quote_id: quoteId, orden: index + 1, descripcion: i.descripcion.trim(), modo: form.modo, cantidad: num(i.cantidad), valor_unitario: num(i.valor_unitario), valor_total: itemTotal(i), costo: num(i.costo_unitario ?? i.costo) * num(i.cantidad), margen: itemTotal(i) > 0 ? ((itemTotal(i) - (num(i.costo_unitario ?? i.costo) * num(i.cantidad))) / itemTotal(i)) * 100 : 0 })); const itemsResult = await supabase.from('cotizacion_items').insert(itemsPayload); if (itemsResult.error) throw itemsResult.error;
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
  const editar = async q => { const { data: items, error } = await supabase.from('cotizacion_items').select('*').eq('quote_id', q.id).order('orden'); if (error) return alert('No se pudieron cargar los ítems.'); const modo = items?.[0]?.modo || 'detallado'; setEditando(q); setItemsEditando(new Set((items || []).map(i => i.id))); setItemsColapsados(new Set()); setValorVentaDirecto(num(q.subtotal)); setForm({ client_id: q.client_id, proyecto_nombre: q.proyecto_nombre || q.proyectos?.nombre || '', project_id: q.project_id || '', lob: q.lob || 'Espacio de estructuras', descripcion: q.descripcion || '', aplicar_igv: true, descuento: 0, modo, items: (items || []).map(i => ({ id: i.id || id(), descripcion: i.descripcion || '', cantidad: i.cantidad ?? 1, valor_unitario: i.valor_unitario ?? '', valor_total: i.valor_total ?? '', costo: i.costo ?? '', costo_unitario: i.costo_unitario ?? (num(i.cantidad) > 0 ? num(i.costo) / num(i.cantidad) : 0) })) .concat((items || []).length ? [] : [newItem()]) }); setVista('form'); };
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
  const descargarExcel = async q => {
    setMenuAbierto(null);
    try {
      const { data: items, error } = await supabase.from('cotizacion_items').select('*').eq('quote_id', q.id).order('orden');
      if (error) throw error;
      const cliente = q.clientes || {};
      const proyecto = q.proyectos || {};
      const fecha = q.created_at ? new Date(q.created_at).toLocaleString('es-PE') : '';
      const updated = q.updated_at ? new Date(q.updated_at).toLocaleString('es-PE') : '';
      const detailRows = [
        [{ value: 'CONTROL FESTOS · COTIZACIÓN', style: 1 }, { value: '' }, { value: '' }, { value: '' }],
        [{ value: 'DATOS DE LA COTIZACIÓN', style: 5 }, { value: '' }, { value: '' }, { value: '' }],
        [{ value: 'Código', style: 2 }, { value: q.codigo }, { value: 'Estado', style: 2 }, { value: q.estado }],
        [{ value: 'Fecha de creación', style: 2 }, { value: fecha }, { value: 'Última actualización', style: 2 }, { value: updated }],
        [{ value: 'Cliente', style: 2 }, { value: cliente.nombre || '' }, { value: 'Documento', style: 2 }, { value: cliente.ruc || '' }],
        [{ value: 'Tipo documento', style: 2 }, { value: cliente.tipo_documento || '' }, { value: 'Condición de pago', style: 2 }, { value: cliente.tipo_pago || cliente.condicion_pago || '' }],
        [{ value: 'Plazo de pago (días)', style: 2 }, { value: num(cliente.plazo_dias), numeric: true, style: 3 }, { value: 'Categoría cliente', style: 2 }, { value: cliente.categoria || '' }],
        [{ value: 'Proyecto', style: 2 }, { value: q.proyecto_nombre || proyecto.nombre || '' }, { value: 'Proyecto ID', style: 2 }, { value: q.project_id || proyecto.id || '' }],
        [{ value: 'LOB', style: 2 }, { value: q.lob || '' }, { value: 'Modo', style: 2 }, { value: q.modo || ((items || [])[0]?.modo) || '' }],
        [{ value: 'Descripción / alcance', style: 2 }, { value: q.descripcion || '' }, { value: 'Creado por', style: 2 }, { value: q.created_by || '' }],
        [{ value: 'Actualizado por', style: 2 }, { value: q.updated_by || '' }, { value: 'Aplicar IGV', style: 2 }, { value: q.aplicar_igv ? 'Sí' : 'No' }],
        [{ value: 'Valor de venta / Subtotal', style: 2 }, { value: num(q.subtotal), numeric: true, style: 7 }, { value: 'Descuento', style: 2 }, { value: num(q.descuento), numeric: true, style: 7 }],
        [{ value: 'IGV', style: 2 }, { value: num(q.igv), numeric: true, style: 7 }, { value: 'Precio total', style: 2 }, { value: num(q.total), numeric: true, style: 7 }],
        [{ value: 'Costo estimado', style: 2 }, { value: num(q.costo_estimado), numeric: true, style: 7 }, { value: 'Ganancia / Utilidad estimada', style: 2 }, { value: num(q.ganancia_estimada), numeric: true, style: 7 }],
        [{ value: 'Margen global (%)', style: 2 }, { value: num(q.margen), numeric: true, style: 3 }, { value: '', style: 2 }, { value: '' }],
        [{ value: '' }, { value: '' }, { value: '' }, { value: '' }],
        [{ value: 'Ítems incluidos', style: 5 }, { value: '' }, { value: '' }, { value: '' }]
      ];
      const itemRows = [
        [{ value: 'N°', style: 1 }, { value: 'Descripción', style: 1 }, { value: 'Modo', style: 1 }, { value: 'Cantidad', style: 1 }, { value: 'Valor unitario', style: 1 }, { value: 'Valor total', style: 1 }, { value: 'Costo unitario', style: 1 }, { value: 'Costo total', style: 1 }, { value: 'Margen (%)', style: 1 }],
        ...(items || []).map((it, idx) => [{ value: idx + 1, numeric: true, style: 4 }, { value: it.descripcion || '', style: 4 }, { value: it.modo || '', style: 4 }, { value: num(it.cantidad), numeric: true, style: 4 }, { value: num(it.valor_unitario), numeric: true, style: 3 }, { value: num(it.valor_total), numeric: true, style: 3 }, { value: num(it.costo_unitario ?? (num(it.cantidad) ? num(it.costo) / num(it.cantidad) : 0)), numeric: true, style: 3 }, { value: num(it.costo), numeric: true, style: 3 }, { value: num(it.margen), numeric: true, style: 3 }])
      ];
      const xmlHeader = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
      const sheet1 = `${xmlHeader}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="25" customWidth="1"/><col min="2" max="2" width="42" customWidth="1"/><col min="3" max="3" width="25" customWidth="1"/><col min="4" max="4" width="42" customWidth="1"/></cols><sheetData>${excelRowsXml([...detailRows, ...itemRows])}</sheetData><mergeCells count="3"><mergeCell ref="A1:D1"/><mergeCell ref="A2:D2"/><mergeCell ref="A17:D17"/></mergeCells></worksheet>`;
      const itemTotalRow = [{ value: 'TOTAL', style: 5 }, { value: '' }, { value: '' }, { value: '' }, { value: '' }, { value: num(q.subtotal), numeric: true, style: 7 }, { value: '' }, { value: num(q.costo_estimado), numeric: true, style: 7 }, { value: num(q.margen), numeric: true, style: 7 }];
      itemRows.push(itemTotalRow);
      const sheet2Base = buildSheetXml(itemRows, [8, 44, 18, 12, 18, 18, 18, 18, 14]);
      const sheet2 = sheet2Base.replace('<sheetData>', '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>');
      const blob = await createXlsxBlob(xlsxBaseFiles(sheet1, sheet2));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${q.codigo || 'cotizacion'}-Festos.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      onNotify(`Excel generado: ${q.codigo}`, 'nuevo');
      onAudit('Exportación', `${q.codigo} · Excel descargado`);
    } catch (error) {
      console.error(error);
      alert(`No se pudo generar el Excel. ${error?.message || ''}`);
    }
  };
  const guardarClienteRapido = async e => { e.preventDefault(); if (!clienteRapido.nombre.trim() || !clienteRapido.ruc.trim()) return; const payload = { ...clienteRapido, nombre: clienteRapido.nombre.trim(), ruc: clienteRapido.ruc.trim(), plazo_dias: clienteRapido.tipo_pago === 'Contado' ? 0 : Math.trunc(num(clienteRapido.plazo_dias)), id: id() }; const { error } = await supabase.from('clientes').insert([payload]); if (error) return alert(`No se pudo registrar el cliente. ${error.message}`); onNotify(`Nuevo cliente registrado: ${payload.nombre}`, 'nuevo'); onAudit('Creación', `Cliente creado desde Cotizaciones · ${payload.nombre}`); setNuevoCliente(false); setClienteRapido(emptyClient); await cargarDatos(); setForm(prev => ({ ...prev, client_id: payload.id })); };
  const filtradas = cotizaciones.filter(q => { if (filtro !== 'todas' && q.estado !== filtro) return false; const text = `${q.codigo} ${q.clientes?.nombre || ''} ${q.proyectos?.nombre || ''} ${q.proyecto_nombre || ''} ${q.descripcion || ''}`.toLowerCase(); const fecha = q.created_at ? q.created_at.slice(0, 10) : ''; return (!busqueda.trim() || text.includes(busqueda.toLowerCase())) && (!fechaDesde || (fecha && fecha >= fechaDesde)) && (!fechaHasta || (fecha && fecha <= fechaHasta)); });
  const badge = estado => estado === 'En Revisión' ? 'tag-paid' : estado === 'Aprobado' ? 'tag-approval' : 'tag-pending';
  if (vista === 'form') return <div><div className="section-header"><div><h3 className="section-title">{editando ? '✏️ Editar Cotización' : '📑 Nueva Cotización'}</h3><p className="panel-note">Cliente, proyecto obligatorio, ítems y control de rentabilidad.</p></div><button className="btn-secondary" onClick={reset}>← Volver</button></div><div className="glass-card form-card"><div className="form-grid-2"><div className="form-row"><label>Cliente *</label><div className="select-with-action"><select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value, project_id: '' })} required><option value="">Selecciona un cliente...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} · {c.ruc}</option>)}</select><button type="button" className="btn-muted" onClick={() => setNuevoCliente(v => !v)}>+ Cliente</button></div></div><div className="form-row"><label>Proyecto</label><div className="select-with-action"><select value={form.project_id} disabled={!form.usar_proyecto || !form.client_id} onChange={e => setForm({ ...form, project_id: e.target.value })}><option value="">{form.usar_proyecto ? (form.client_id ? 'Selecciona un proyecto...' : 'Primero selecciona cliente') : 'Proyecto no asociado'}</option>{proyectosDisponibles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div></div><div className="form-row"><label>LOB *</label><select value={form.lob} onChange={e => setForm({ ...form, lob: e.target.value })} required><option value="Espacio de estructuras">Espacio de estructuras</option><option value="Producción gráfica">Producción gráfica</option><option value="Producción 360">Producción 360</option></select></div></div>{nuevoCliente && <form onSubmit={guardarClienteRapido} className="quick-client-card"><div className="quick-client-head"><strong>Registrar cliente sin salir de Cotizaciones</strong><button type="button" className="btn-muted" onClick={() => setNuevoCliente(false)}>Cerrar</button></div><div className="form-grid-2"><div className="form-row"><label>Razón social *</label><input value={clienteRapido.nombre} onChange={e => setClienteRapido({ ...clienteRapido, nombre: e.target.value })} required /></div><div className="form-row"><label>N° DOC *</label><input value={clienteRapido.ruc} onChange={e => setClienteRapido({ ...clienteRapido, ruc: e.target.value })} required /></div></div><div className="form-grid-2"><div className="form-row"><label>Tipo documento</label><select value={clienteRapido.tipo_documento} onChange={e => setClienteRapido({ ...clienteRapido, tipo_documento: e.target.value })}><option>RUC</option><option>DNI</option></select></div><div className="form-row"><label>CONDICIÓN DE PAGO</label><select value={clienteRapido.tipo_pago} onChange={e => setClienteRapido({ ...clienteRapido, tipo_pago: e.target.value })}><option>Contado</option><option>Crédito</option></select></div></div><div className="form-row quick-client-plazo"><label>Plazo (días)</label><input type="number" min="0" value={clienteRapido.plazo_dias} disabled={clienteRapido.tipo_pago === 'Contado'} onChange={e => setClienteRapido({ ...clienteRapido, plazo_dias: e.target.value })} /></div><button className="btn-primary btn-small">Registrar y seleccionar cliente</button></form>}<div className="form-row quote-project-required"><label>Proyecto *</label><input value={form.proyecto_nombre} onChange={e => setForm({ ...form, proyecto_nombre: e.target.value })} required placeholder="Escribe el nombre del proyecto..." /><small>El proyecto se creará automáticamente en Proyectos cuando la cotización sea aprobada.</small></div><div className="form-row"><label>Descripción / alcance</label><textarea rows="3" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Alcance, condiciones o notas de la cotización..." /></div><div className="quote-items-head"><div><h4 className="panel-title" style={{ margin: 0 }}>🧾 Ítems</h4><span className="panel-note">El modo Detallado / Directo se aplica a toda la cotización.</span></div><button type="button" className="btn-primary" onClick={addItem}>+ Agregar Ítem</button></div><div className="quote-items-list">{form.items.map((item, index) => {
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
  return <div onClick={() => menuAbierto && setMenuAbierto(null)}><div className="section-header"><div><h3 className="section-title">📑 Cotizaciones</h3><p className="panel-note">Propuestas comerciales, seguimiento de estados y rentabilidad en un solo lugar.</p></div><button className="btn-primary" onClick={nuevaCotizacion}>+ Nueva Cotización</button></div><div className="glass-card form-card quote-list-shell"><div className="toolbar-search-row"><input className="search-input" placeholder="Buscar por código, cliente, proyecto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div><div className="toolbar-filter-row quote-filter-row"><div className="date-filter-group"><label>Desde <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} /></label><label>Hasta <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} /></label></div><div className="quote-filters">{[['todas','Todas'],['Aprobado','Aprobadas'],['En Revisión','En Revisión'],['Borrador','Borradores']].map(([v,l]) => <button key={v} type="button" className={filtro === v ? 'active' : ''} onClick={() => setFiltro(v)}>{l}</button>)}</div><button type="button" className="btn-muted btn-filter-clear" onClick={() => { setBusqueda(''); setFechaDesde(''); setFechaHasta(''); setFiltro('todas'); }}>Limpiar filtros</button></div>{filtradas.length === 0 ? <p className="empty-hint">No hay cotizaciones con los filtros actuales.</p> : <div className="quote-record-list">{filtradas.map(q => { const items = detalleItems[q.id] || []; const abierto = detalleAbierto === q.id; return <article className={`quote-record-pro quote-status-${q.estado === 'Aprobado' ? 'aprobado' : q.estado === 'En Revisión' ? 'revision' : 'borrador'} ${abierto ? 'is-open' : ''}`} key={q.id}><div className="quote-record-main"><div className="quote-record-identity"><span className={`quote-status-dot ${badge(q.estado)}`} /> <div><div className="quote-record-code">{q.codigo}</div><h4>{q.clientes?.nombre || 'Cliente sin nombre'}</h4><div className="quote-record-subline"><span>{`Proyecto · ${q.proyecto_nombre || q.proyectos?.nombre || 'Sin nombre'}`}</span><span>•</span><span>{q.lob || 'Sin LOB'}</span><span>•</span><span>{q.modo === 'directo' ? 'Valoración directa' : 'Valorización detallada'}</span></div></div></div><div className="quote-record-finance"><span>Precio total</span><strong>{money(q.total)}</strong><small>Margen {num(q.margen).toFixed(1)}%</small></div><div className="quote-record-status"><span className={`code-tag ${badge(q.estado)}`}>{q.estado}</span></div><div className="quote-record-menu-wrap"><button type="button" className="quote-more-btn" aria-label="Opciones de cotización" onClick={e => { e.stopPropagation(); setMenuAbierto(menuAbierto === q.id ? null : q.id); }}>⋮</button>{menuAbierto === q.id && <div className="quote-action-menu" onClick={e => e.stopPropagation()}><button onClick={() => toggleDetalle(q)}>⌄ <span>{abierto ? 'Ocultar detalle' : 'Ver detalle'}</span></button><button onClick={() => { setMenuAbierto(null); editar(q); }}>✏️ <span>Editar cotización</span></button>{q.estado === 'Borrador' && <button onClick={() => cambiarEstado(q, 'En Revisión')}>◷ <span>Enviar a revisión</span></button>}{puedeAprobar && q.estado !== 'Aprobado' && <button onClick={() => cambiarEstado(q, 'Aprobado')}>✓ <span>Aprobar cotización</span></button>}<button onClick={() => { setMenuAbierto(null); descargarPDF(q); }}>📄 <span>Descargar PDF</span></button><button className="excel-export-action" onClick={() => descargarExcel(q)}>📊 <span>Exportar Excel</span></button><div className="quote-menu-separator" /><button className="danger" onClick={() => eliminarCotizacion(q)}>🗑 <span>Eliminar cotización</span></button></div>}</div></div><button type="button" className="quote-expand-bar" onClick={() => toggleDetalle(q)}><span>{abierto ? 'Ocultar detalle' : 'Ver detalle completo'}</span><span className={`quote-expand-chevron ${abierto ? 'open' : ''}`}>⌄</span></button>{abierto && <div className="quote-record-detail"><div className="quote-detail-grid"><div><span>Cliente</span><strong>{q.clientes?.nombre || '—'}</strong></div><div><span>Proyecto</span><strong>{q.proyecto_nombre || q.proyectos?.nombre || '—'}</strong></div><div><span>LOB</span><strong>{q.lob || '—'}</strong></div><div><span>Valor venta</span><strong>{money(q.subtotal)}</strong></div><div><span>IGV 18%</span><strong>{money(q.igv)}</strong></div><div><span>Precio total</span><strong>{money(q.total)}</strong></div><div className="quote-detail-margin"><span>Margen global</span><strong>{num(q.margen).toFixed(1)}%</strong></div></div>{q.descripcion && <div className="quote-detail-description"><span>Alcance / notas</span><p>{q.descripcion}</p></div>}<div className="quote-detail-items-head"><strong>Ítems de la cotización</strong><span>{items.length} {items.length === 1 ? 'ítem' : 'ítems'}</span></div>{items.length === 0 ? <p className="empty-hint">No hay ítems registrados.</p> : <div className="quote-detail-items">{items.map((i, idx) => <div className="quote-detail-item" key={i.id || idx}><div className="quote-detail-item-num">{String(idx + 1).padStart(2, '0')}</div><div className="quote-detail-item-name"><strong>{i.descripcion}</strong><small>{num(i.cantidad)} × {money(i.valor_unitario)} · {i.modo === 'directo' ? 'Directo' : 'Detallado'}</small></div><div><span>Venta</span><strong>{money(i.valor_total)}</strong></div><div className="quote-detail-item-margin"><span>Margen</span><strong>{num(i.margen).toFixed(1)}%</strong></div></div>)}</div>}</div>}</article>; })}</div>}</div></div>;
}