import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { FestosIcon } from '../FestosIcon';
import { nombreCompletoUsuario } from '../teamDirectory';
import SearchableSelect from '../components/SearchableSelect';
import MultiSearchableSelect from '../components/MultiSearchableSelect';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const IGV_RATE = 0.18;
const money = value => `S/. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
const id = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const TIPOS_COMPROBANTE = ['SIN COMPROBANTE','FACTURA','BOLETA','RECIBO POR HONORARIOS','OTRO'];
const emptyProveedorRapido = { nombre: '', nombre_comercial: '', ruc_documento: '', productos: '', contactos: [{ nombre: '', telefono: '' }], condicion_pago: 'CONTADO', plazo_dias: 0 };
const emptyFiles = { pdf: null, xml: null, ctz: null };
const emptyForm = {
  fecha_compra: new Date().toISOString().slice(0, 10),
  fecha_control: '',
  ceco: '',
  lob: '',
  categoria_gasto: '',
  project_id: '',
  proyecto_texto: '',
  descripcion: '',
  proveedor_id: '',
  proveedor_nombre: '',
  monto_base: '',
  tipo_comprobante: 'SIN COMPROBANTE',
  numero_documento: '',
  observaciones: '',
  pdf_factura_path: '',
  xml_factura_path: '',
  ctz_path: ''
};

const normalizeText = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const esCostoDirecto = value => normalizeText(value) === 'costos directos';

const sanitizeFileName = name => String(name || 'archivo')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/-+/g, '-');

export function PurchaseRegister({ usuario, onNotify = () => {}, onAudit = () => {} }) {
  const [compras, setCompras] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [lobCatalogo, setLobCatalogo] = useState([]);
  const [cecoCatalogo, setCecoCatalogo] = useState([]);
  const [categoriaGastoCatalogo, setCategoriaGastoCatalogo] = useState([]);
  const [proyectosGenerales, setProyectosGenerales] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [archivos, setArchivos] = useState(emptyFiles);
  const [editando, setEditando] = useState(null);
  const [modal, setModal] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroProyectos, setFiltroProyectos] = useState([]);
  const [filtroProveedor, setFiltroProveedor] = useState('TODOS');
  const [filtroCategoriaGasto, setFiltroCategoriaGasto] = useState('TODAS');
  const [filtroLob, setFiltroLob] = useState('TODOS');
  const [filtroCeCo, setFiltroCeCo] = useState('TODOS');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroSinAdjunto, setFiltroSinAdjunto] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [mostrarNuevoProveedor, setMostrarNuevoProveedor] = useState(false);
  const [proveedorRapido, setProveedorRapido] = useState(emptyProveedorRapido);
  const [guardandoProveedor, setGuardandoProveedor] = useState(false);
  const [procesandoPdf, setProcesandoPdf] = useState(false);
  const [estadoLecturaPdf, setEstadoLecturaPdf] = useState('');

  const cargar = async () => {
    const [c, p, pr, lobRes, cecoRes, gastoRes, generalRes] = await Promise.all([
      supabase.from('compras').select('*, proyectos(id,codigo,nombre,lob), proveedores(id,nombre,nombre_comercial,ruc_documento)').order('fecha_compra', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('proyectos').select('id,codigo,nombre,estado,lob').order('created_at', { ascending: false }),
      supabase.from('proveedores').select('id,nombre,nombre_comercial,ruc_documento,estado,productos,telefono,contacto_nombre,condicion_pago,plazo_dias').order('nombre'),
      supabase.from('compras_lob_catalogo').select('nombre,orden').eq('activo', true).order('orden').order('nombre'),
      supabase.from('compras_ceco_catalogo').select('nombre,orden').eq('activo', true).order('orden').order('nombre'),
      supabase.from('compras_categoria_gasto_catalogo').select('nombre,orden').eq('activo', true).order('orden').order('nombre'),
      supabase.from('compras_proyectos_generales').select('id,nombre,activo').eq('activo', true).order('nombre')
    ]);
    if (c.error) console.error('Compras:', c.error); else setCompras(c.data || []);
    if (p.error) console.error('Proyectos:', p.error); else setProyectos(p.data || []);
    if (pr.error) console.error('Proveedores:', pr.error); else setProveedores(pr.data || []);
    if (lobRes.error) console.error('Catálogo LOB:', lobRes.error); else setLobCatalogo((lobRes.data || []).map(x => x.nombre));
    if (cecoRes.error) console.error('Catálogo CeCo:', cecoRes.error); else setCecoCatalogo((cecoRes.data || []).map(x => x.nombre));
    if (gastoRes.error) console.error('Catálogo categoría de gasto:', gastoRes.error); else setCategoriaGastoCatalogo((gastoRes.data || []).map(x => x.nombre));
    if (generalRes.error) console.error('Proyectos generales:', generalRes.error); else setProyectosGenerales(generalRes.data || []);
  };

  useEffect(() => {
    cargar();
    const channel = supabase.channel(`festos-compras-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compras' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const tieneAlgunAdjunto = c => !!(c?.pdf_factura_path || c?.xml_factura_path || c?.ctz_path);
  const requiereAdjunto = c => ['FACTURA', 'RECIBO POR HONORARIOS'].includes(String(c?.tipo_comprobante || '').toUpperCase());
  const faltaAdjuntoObligatorio = c => requiereAdjunto(c) && !tieneAlgunAdjunto(c);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return compras.filter(c => {
      const fecha = c.fecha_compra || '';
      const texto = `${c.codigo || ''} ${c.descripcion || ''} ${c.proveedor_nombre || c.proveedores?.nombre || ''} ${c.proyectos?.codigo || ''} ${c.proyectos?.nombre || ''} ${c.proyecto_texto || ''} ${c.lob || ''} ${c.ceco || ''}`.toLowerCase();
      return (!q || texto.includes(q)) &&
        (!filtroProyectos.length || filtroProyectos.some(v => {
          if (v === 'SIN_PROYECTO') return !c.project_id && !c.proyecto_texto;
          if (String(v).startsWith('GENERAL:')) return !c.project_id && normalizeText(c.proyecto_texto) === normalizeText(String(v).slice(8));
          return String(c.project_id) === String(v);
        })) &&
        (filtroProveedor === 'TODOS' || String(c.proveedor_id || '') === String(filtroProveedor)) &&
        (filtroCategoriaGasto === 'TODAS' || c.categoria_gasto === filtroCategoriaGasto) &&
        (filtroLob === 'TODOS' || String(c.lob || '') === filtroLob) &&
        (filtroCeCo === 'TODOS' || String(c.ceco || '') === filtroCeCo) &&
        (!fechaDesde || fecha >= fechaDesde) && (!fechaHasta || fecha <= fechaHasta) &&
        (!filtroSinAdjunto || faltaAdjuntoObligatorio(c));
    });
  }, [compras, busqueda, filtroProyectos, filtroProveedor, filtroCategoriaGasto, filtroLob, filtroCeCo, fechaDesde, fechaHasta, filtroSinAdjunto]);

  const resumen = useMemo(() => ({
    valorCompra: filtradas.reduce((s, c) => s + Number(c.monto_base ?? c.monto ?? 0), 0),
    creditoFiscal: filtradas.reduce((s, c) => s + ((c.genera_credito_fiscal ?? (c.tipo_comprobante === 'FACTURA')) ? Number(c.igv_monto || 0) : 0), 0),
    precioCompra: filtradas.reduce((s, c) => s + Number(c.monto || 0), 0),
    sinAdjunto: filtradas.filter(faltaAdjuntoObligatorio).length
  }), [filtradas]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ ...emptyForm, fecha_compra: new Date().toISOString().slice(0, 10) });
    setArchivos(emptyFiles);
    setEstadoLecturaPdf('');
    setMostrarNuevoProveedor(false);
    setProveedorRapido(emptyProveedorRapido);
    setModal(true);
  };

  const editar = c => {
    const base = c.monto_base != null ? Number(c.monto_base) : (c.aplicar_igv ? Number(c.monto || 0) / (1 + IGV_RATE) : Number(c.monto || 0));
    setEditando(c);
    setForm({
      ...emptyForm,
      ...c,
      project_id: esCostoDirecto(c.categoria_gasto) ? (c.project_id || '') : '',
      proyecto_texto: c.proyecto_texto || '',
      proveedor_id: c.proveedor_id || '',
      proveedor_nombre: c.proveedor_nombre || c.proveedores?.nombre || '',
      monto_base: base ? String(Number(base.toFixed(2))) : '',
      ceco: c.ceco || '',
      lob: c.lob || '',
      fecha_control: c.fecha_control || '',
      numero_documento: c.numero_documento || c.numero || '',
      tipo_comprobante: c.tipo_comprobante === 'RECIBO' ? 'RECIBO POR HONORARIOS' : c.tipo_comprobante === 'TICKET' ? 'OTRO' : (c.tipo_comprobante || 'SIN COMPROBANTE')
    });
    setArchivos(emptyFiles);
    setEstadoLecturaPdf('');
    setMostrarNuevoProveedor(false);
    setProveedorRapido(emptyProveedorRapido);
    setModal(true);
  };

  const seleccionarProveedor = value => {
    const prov = proveedores.find(p => p.id === value);
    setForm(f => ({ ...f, proveedor_id: value, proveedor_nombre: prov?.nombre || '' }));
  };

  const guardarProveedorRapido = async e => {
    e.preventDefault();
    if (!proveedorRapido.nombre.trim() || !proveedorRapido.ruc_documento.trim() || !proveedorRapido.productos.trim()) {
      return alert('Completa razón social, RUC / Documento y producto/servicio del proveedor.');
    }
    if (proveedorRapido.condicion_pago === 'CREDITO' && Number(proveedorRapido.plazo_dias) <= 0) return alert('Indica el plazo de crédito.');
    setGuardandoProveedor(true);
    try {
      const contactosValidos = (proveedorRapido.contactos || []).map(c => ({ nombre: String(c.nombre || '').trim(), telefono: String(c.telefono || '').trim() })).filter(c => c.nombre || c.telefono);
      const contactoPrincipal = contactosValidos[0] || { nombre: '', telefono: '' };
      const payload = {
        nombre: proveedorRapido.nombre.trim(),
        nombre_comercial: String(proveedorRapido.nombre_comercial || '').trim() || null,
        ruc_documento: proveedorRapido.ruc_documento.trim(),
        productos: proveedorRapido.productos.trim(),
        contacto_nombre: contactoPrincipal.nombre || null,
        telefono: contactoPrincipal.telefono || null,
        condicion_pago: proveedorRapido.condicion_pago,
        plazo_dias: proveedorRapido.condicion_pago === 'CONTADO' ? 0 : Math.trunc(Number(proveedorRapido.plazo_dias) || 0),
        estado: true
      };
      const { data: proveedorCreado, error } = await supabase.from('proveedores').insert([payload]).select('id,nombre,nombre_comercial,ruc_documento').single();
      if (error) throw error;
      if (!proveedorCreado?.id) throw new Error('La base de datos no devolvió el proveedor creado.');
      if (contactosValidos.length) {
        const { error: contactosError } = await supabase.from('proveedor_contactos').insert(contactosValidos.map(c => ({ proveedor_id: proveedorCreado.id, nombre: c.nombre || null, telefono: c.telefono || null })));
        if (contactosError) throw contactosError;
      }
      await cargar();
      setForm(f => ({ ...f, proveedor_id: proveedorCreado.id, proveedor_nombre: proveedorCreado.nombre || payload.nombre }));
      setMostrarNuevoProveedor(false);
      setProveedorRapido(emptyProveedorRapido);
      onNotify(`Nuevo proveedor registrado: ${payload.nombre}`, 'nuevo');
      onAudit('Creación', `Proveedor creado desde Registro de compras · ${payload.nombre}`);
    } catch (err) {
      console.error(err);
      alert(`No se pudo registrar el proveedor. ${err?.message || ''}`);
    } finally {
      setGuardandoProveedor(false);
    }
  };

  const buildAdjuntoFileName = (file, formData) => {
    const proveedor = sanitizeFileName(formData?.proveedor_nombre || 'PROVEEDOR');
    const numero = sanitizeFileName(formData?.numero_documento || 'SIN-DOCUMENTO');
    const fecha = sanitizeFileName(formData?.fecha_compra || 'SIN-FECHA');
    const original = String(file?.name || '');
    const dot = original.lastIndexOf('.');
    const ext = dot >= 0 ? original.slice(dot + 1).toLowerCase() : '';
    const baseName = `${proveedor}_${numero}_${fecha}`;
    return ext ? `${baseName}.${ext}` : baseName;
  };

  const uploadAdjunto = async (compraId, kind, file, formData) => {
    if (!file) return null;
    const fileName = buildAdjuntoFileName(file, formData);
    const path = `${compraId}/${kind}/${fileName}`;
    const { error } = await supabase.storage
      .from('compras-adjuntos')
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) throw error;
    return path;
  };

  const abrirAdjunto = async path => {
    if (!path) return;
    const { data, error } = await supabase.storage.from('compras-adjuntos').createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) return alert('No se pudo abrir el archivo adjunto.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const normalizarNumeroDocumento = value => String(value || '')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim();

  const detectarNumeroDocumento = text => {
    const source = normalizarNumeroDocumento(text);
    const compact = source.replace(/\s+/g, ' ');
    const patterns = [
      // Formato SUNAT habitual: F001-00012345 / B001-00012345 / E001-00012345.
      /\b([FBE][A-Z0-9]{3})\s*[-/]\s*(\d{1,12})\b/i,
      // Serie y correlativo separados por espacios, común en PDFs con texto posicionado.
      /\b([FBE][A-Z0-9]{3})\s+(\d{3,12})\b/i,
      // Etiquetas explícitas: Serie F001 Número 12345.
      /\bSERIE\s*[:.]?\s*([FBE][A-Z0-9]{3})[^A-Z0-9]{0,35}(?:N(?:RO|UMERO)?|CORRELATIVO|N[°º])\s*[:.]?\s*(\d{1,12})\b/i,
      // Factura electrónica ... F001 ... 12345.
      /\b(?:FACTURA|BOLETA)(?:\s+ELECTRONICA)?[^A-Z0-9]{0,45}([FBE][A-Z0-9]{3})[^0-9]{0,12}(\d{1,12})\b/i
    ];
    for (const pattern of patterns) {
      const match = compact.match(pattern);
      if (match?.[1] && match?.[2]) return `${match[1].toUpperCase()}-${match[2]}`;
    }
    return '';
  };

  const textoPdfPorLineas = content => {
    const rows = [];
    for (const item of content.items || []) {
      const value = String(item?.str || '').trim();
      if (!value) continue;
      const x = Number(item?.transform?.[4] || 0);
      const y = Number(item?.transform?.[5] || 0);
      let row = rows.find(r => Math.abs(r.y - y) <= 2.5);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, value });
    }
    return rows
      .sort((a, b) => b.y - a.y)
      .map(row => row.items.sort((a, b) => a.x - b.x).map(i => i.value).join(' '))
      .join('\n');
  };

  const leerNumeroFacturaPdf = async file => {
    if (!file) return { numero: '', tieneTexto: false };
    const fromName = detectarNumeroDocumento(file.name);
    try {
      setProcesandoPdf(true);
      setEstadoLecturaPdf('Leyendo contenido del PDF…');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjsLib.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false });
      const pdf = await loadingTask.promise;
      let text = '';
      const pages = Math.min(pdf.numPages, 5);
      for (let pageNum = 1; pageNum <= pages; pageNum += 1) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent({ disableNormalization: false });
        const pageText = textoPdfPorLineas(content);
        text += `\n${pageText}`;
        const numeroPagina = detectarNumeroDocumento(pageText);
        if (numeroPagina) return { numero: numeroPagina, tieneTexto: true };
      }
      const tieneTexto = text.replace(/\s/g, '').length > 10;
      return { numero: detectarNumeroDocumento(text) || fromName, tieneTexto };
    } catch (error) {
      console.warn('No se pudo leer automáticamente el número del PDF:', error);
      return { numero: fromName, tieneTexto: false, error };
    } finally {
      setProcesandoPdf(false);
    }
  };

  const seleccionarPdfFactura = async file => {
    setArchivos(a => ({ ...a, pdf: file || null }));
    setEstadoLecturaPdf('');
    if (!file) return;
    const resultado = await leerNumeroFacturaPdf(file);
    if (resultado.numero) {
      setForm(f => ({ ...f, numero_documento: resultado.numero }));
      setEstadoLecturaPdf(`Número detectado: ${resultado.numero}`);
    } else if (!resultado.tieneTexto) {
      setEstadoLecturaPdf('El PDF parece ser escaneado o no contiene texto seleccionable. Ingresa el número manualmente.');
    } else {
      setEstadoLecturaPdf('Se leyó el PDF, pero no se encontró un número reconocible. Puedes ingresarlo manualmente.');
    }
  };

  const guardar = async e => {
    e.preventDefault();
    if (!form.fecha_compra || !form.ceco || !form.categoria_gasto || !String(form.descripcion || '').trim() || !form.proveedor_id || !form.monto_base) {
      return alert('Completa fecha, CeCo, categoría de gasto, descripción, proveedor y valor compra.');
    }
    const base = Number(form.monto_base);
    if (!Number.isFinite(base) || base <= 0) return alert('El monto debe ser mayor a 0.');
    const aplicaIgv = ['FACTURA', 'BOLETA'].includes(form.tipo_comprobante);
    const generaCreditoFiscal = form.tipo_comprobante === 'FACTURA';
    const igvMonto = aplicaIgv ? Number((base * IGV_RATE).toFixed(2)) : 0;
    const total = Number((base + igvMonto).toFixed(2));
    setCargando(true);
    try {
      const compraId = editando?.id || id();
      const payload = {
        fecha_compra: form.fecha_compra,
        fecha_control: form.fecha_control || null,
        ceco: form.ceco,
        lob: form.lob,
        categoria_gasto: form.categoria_gasto,
        project_id: esCostoDirecto(form.categoria_gasto) ? (form.project_id || null) : null,
        proyecto_texto: esCostoDirecto(form.categoria_gasto) ? null : (String(form.proyecto_texto || '').trim() || null),
        descripcion: String(form.descripcion || '').trim(),
        proveedor_id: form.proveedor_id,
        proveedor_nombre: String(form.proveedor_nombre || '').trim() || null,
        monto_base: base,
        aplicar_igv: aplicaIgv,
        genera_credito_fiscal: generaCreditoFiscal,
        igv_monto: igvMonto,
        monto: total,
        tipo_comprobante: form.tipo_comprobante,
        numero_documento: String(form.numero_documento || '').trim() || null,
        observaciones: String(form.observaciones || '').trim() || null,
        registrado_por: usuario || null,
        updated_at: new Date().toISOString()
      };
      const result = editando
        ? await supabase.from('compras').update(payload).eq('id', compraId)
        : await supabase.from('compras').insert([{ ...payload, id: compraId }]);
      if (result.error) throw result.error;

      if (!esCostoDirecto(form.categoria_gasto)) {
        const proyectoGeneral = String(form.proyecto_texto || '').trim();
        if (proyectoGeneral) {
          const { error: generalError } = await supabase.from('compras_proyectos_generales').insert([{ nombre: proyectoGeneral, created_by: usuario || null }]);
          if (generalError && generalError.code !== '23505') console.warn('No se pudo actualizar el catálogo de proyectos generales:', generalError);
        }
      }

      const [pdfPath, xmlPath, ctzPath] = await Promise.all([
        uploadAdjunto(compraId, 'pdf', archivos.pdf, form),
        uploadAdjunto(compraId, 'xml', archivos.xml, form),
        uploadAdjunto(compraId, 'cotizacion', archivos.ctz, form)
      ]);
      const adjuntosPayload = {
        pdf_factura_path: pdfPath || form.pdf_factura_path || null,
        xml_factura_path: xmlPath || form.xml_factura_path || null,
        ctz_path: ctzPath || form.ctz_path || null
      };
      const { error: adjuntosError } = await supabase.from('compras').update(adjuntosPayload).eq('id', compraId);
      if (adjuntosError) throw adjuntosError;

      onNotify(editando ? 'Compra actualizada' : 'Compra registrada', editando ? 'edicion' : 'nuevo');
      onAudit(editando ? 'Edición' : 'Creación', `${editando ? 'Compra actualizada' : 'Compra registrada'} · ${payload.descripcion} · ${money(total)}`);
      setModal(false);
      setEditando(null);
      setForm(emptyForm);
      setArchivos(emptyFiles);
      await cargar();
    } catch (err) {
      console.error(err);
      alert(`No se pudo guardar la compra. ${err?.message || ''}`);
    } finally {
      setCargando(false);
    }
  };

  const eliminar = async c => {
    if (!confirm(`¿Eliminar ${c.codigo || 'esta compra'}?`)) return;
    const { error } = await supabase.from('compras').delete().eq('id', c.id);
    if (error) return alert(`No se pudo eliminar. ${error.message}`);
    onAudit('Eliminación', `Compra eliminada · ${c.codigo || c.id}`);
    await cargar();
  };

  const basePreview = Number(form.monto_base || 0);
  const aplicaIgvPreview = ['FACTURA', 'BOLETA'].includes(form.tipo_comprobante);
  const igvCalculadoPreview = aplicaIgvPreview ? Number((basePreview * IGV_RATE).toFixed(2)) : 0;
  const creditoFiscalPreview = form.tipo_comprobante === 'FACTURA' ? igvCalculadoPreview : 0;
  const totalPreview = Number((basePreview + igvCalculadoPreview).toFixed(2));

  return <div className="purchase-register-module">
    <div className="section-header">
      <div><h3 className="section-title"><FestosIcon name="ClipboardList" size={21}/> Registro de compras</h3><p className="panel-note">Registra todo lo que se compra. Los pagos y movimientos de caja se controlan por separado.</p></div>
      <button className="btn-primary" onClick={abrirNuevo}><FestosIcon name="Plus" size={16}/> Nueva compra</button>
    </div>

    <div className="glass-card form-card purchase-toolbar">
      <div className="toolbar-search-row"><input className="search-input" placeholder="Buscar compra, proveedor, proyecto, código..." value={busqueda} onChange={e => setBusqueda(e.target.value)}/></div>
      <div className="purchase-filter-stack">
        <div className="purchase-filter-dates-row">
          <label>Desde <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}/></label>
          <label>Hasta <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}/></label>
        </div>
        <div className="purchase-filter-selects-row purchase-filter-ordered">
          <SearchableSelect className="business-payment-filter" value={filtroCeCo} onChange={setFiltroCeCo} ariaLabel="Filtrar por CeCo" options={[{value:'TODOS',label:'CeCo: Todos'},...cecoCatalogo.map(x => ({value:x,label:x}))]} />
          <SearchableSelect className="business-payment-filter" value={filtroCategoriaGasto} onChange={value => { setFiltroCategoriaGasto(value); setFiltroProyectos([]); }} ariaLabel="Filtrar por categoría de gasto" options={[{value:'TODAS',label:'Categoría de gasto: Todas'},...categoriaGastoCatalogo.map(x => ({value:x,label:x}))]} />
          <SearchableSelect className="business-payment-filter" value={filtroLob} onChange={setFiltroLob} ariaLabel="Filtrar por LOB" options={[{value:'TODOS',label:'LOB: Todos'},...lobCatalogo.map(x => ({value:x,label:x}))]} />
          <MultiSearchableSelect className="business-payment-filter" values={filtroProyectos} onChange={setFiltroProyectos} ariaLabel="Filtrar por uno o más proyectos" placeholder={esCostoDirecto(filtroCategoriaGasto) ? 'Proyecto PRY: Todos' : 'Proyecto general: Todos'} options={esCostoDirecto(filtroCategoriaGasto)
            ? [{value:'SIN_PROYECTO',label:'Sin proyecto'},...proyectos.map(p => ({value:p.id,label:`${p.codigo || 'PRY'} · ${p.nombre}`,searchText:`${p.codigo || ''} ${p.nombre || ''}`}))]
            : [{value:'SIN_PROYECTO',label:'Sin proyecto / compra general'},...proyectosGenerales.map(p => ({value:`GENERAL:${p.nombre}`,label:p.nombre,searchText:p.nombre}))]} />
          <SearchableSelect className="business-payment-filter" value={filtroProveedor} onChange={setFiltroProveedor} ariaLabel="Filtrar por proveedor" options={[{value:'TODOS',label:'Proveedor: Todos'},...proveedores.filter(p => p.estado !== false).map(p => ({value:p.id,label:p.nombre_comercial ? `${p.nombre_comercial} · ${p.nombre}` : p.nombre,searchText:`${p.nombre || ''} ${p.nombre_comercial || ''} ${p.ruc_documento || ''}`}))]} />
          <button className="btn-muted btn-filter-clear" onClick={() => { setBusqueda(''); setFiltroProyectos([]); setFiltroProveedor('TODOS'); setFiltroCategoriaGasto('TODAS'); setFiltroLob('TODOS'); setFiltroCeCo('TODOS'); setFechaDesde(''); setFechaHasta(''); setFiltroSinAdjunto(false); }}>Limpiar filtros</button>
        </div>
      </div>
    </div>

    <div className="purchase-summary-grid">
      <div className="glass-card purchase-kpi"><span>Valor compra</span><strong>{money(resumen.valorCompra)}</strong><small>Total sin IGV</small></div>
      <div className="glass-card purchase-kpi"><span>Crédito fiscal</span><strong>{money(resumen.creditoFiscal)}</strong><small>Solo facturas</small></div>
      <div className="glass-card purchase-kpi"><span>Precio de compra</span><strong>{money(resumen.precioCompra)}</strong><small>Total final</small></div>
      <button
        type="button"
        className={`glass-card purchase-kpi purchase-kpi-alert purchase-kpi-filter ${filtroSinAdjunto ? 'is-active' : ''}`}
        onClick={() => {
          const siguiente = !filtroSinAdjunto;
          setFiltroSinAdjunto(siguiente);
          if (siguiente) setTimeout(() => document.querySelector('.purchase-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
        }}
        aria-pressed={filtroSinAdjunto}
        title={filtroSinAdjunto ? 'Mostrar todas las compras' : 'Mostrar solo compras sin adjuntos'}
      >
        <span>Compras sin adjunto</span>
        <strong>{resumen.sinAdjunto}</strong>
        <small>{filtroSinAdjunto ? 'Filtro activo · clic para quitar' : 'Clic para ver registros sin documentos'}</small>
      </button>
    </div>

    <div className="business-record-list purchase-list">
      {filtradas.length === 0 ? <p className="empty-hint">No hay compras con los filtros actuales.</p> : filtradas.map(c => {
        const abierto = detalle === c.id;
        const adjuntoObligatorio = requiereAdjunto(c);
        const adjuntosOk = !adjuntoObligatorio || tieneAlgunAdjunto(c);
        return <article className={`business-pro-card purchase-card ${abierto ? 'is-open' : ''}`} key={c.id}>
          <div className="business-pro-main purchase-card-main-clean">
            <div className="business-identity"><span className="business-status-dot status-active"/><div><div className="business-code">{c.codigo || 'COMPRA'}</div><h4>{c.descripcion}</h4>{(c.proyectos || c.proyecto_texto) && <div className="purchase-project-line">{c.proyectos ? `${c.proyectos.codigo || ''} · ${c.proyectos.nombre}` : c.proyecto_texto}</div>}</div></div>
            <div className="purchase-card-tags">
              <div className="purchase-card-tag"><span>Categoría de gasto</span><strong>{c.categoria_gasto || '—'}</strong></div>
              <div className="purchase-card-tag"><span>Tipo de comprobante</span><strong>{c.tipo_comprobante === 'SIN COMPROBANTE' ? 'Sin comprobante' : (c.tipo_comprobante || '—')}</strong></div>
            </div>
            <div className="purchase-value-zone">
              <div className={`purchase-attachment-status ${adjuntosOk ? 'is-complete' : 'is-missing'}`} title={!adjuntoObligatorio ? 'Adjunto no obligatorio para este comprobante' : (adjuntosOk ? 'Compra con adjunto' : 'Compra sin adjunto obligatorio')}><FestosIcon name={adjuntosOk ? 'Check' : 'AlertTriangle'} size={17}/></div>
              <div className="business-date-value"><span>Valor compra</span><strong>{money(c.monto_base ?? c.monto)}</strong><small>{c.fecha_compra ? new Date(`${c.fecha_compra}T12:00:00`).toLocaleDateString('es-PE') : '—'}</small></div>
            </div>
          </div>
          <button type="button" className="quote-expand-bar" onClick={() => setDetalle(abierto ? null : c.id)}><span>{abierto ? 'Ocultar detalle' : 'Ver detalle completo'}</span><span className={`quote-expand-chevron ${abierto ? 'open' : ''}`}><FestosIcon name="ChevronDown" size={17}/></span></button>
          {abierto && <div className="purchase-detail-wrap"><div className="business-detail-grid purchase-detail-grid-clean">
            <div><span>Fecha de compra</span><strong>{c.fecha_compra || '—'}</strong></div>
            <div><span>Fecha de control</span><strong>{c.fecha_control || 'Pendiente de Registro de Ventas'}</strong></div>
            <div><span>CeCo</span><strong>{c.ceco || '—'}</strong></div>
            <div><span>LOB</span><strong>{c.lob || '—'}</strong></div>
            <div><span>Proveedor</span><strong>{c.proveedor_nombre || c.proveedores?.nombre || '—'}</strong></div>
            <div><span>Número de documento</span><strong>{c.numero_documento || c.numero || '—'}</strong></div>
            <div><span>Precio de compra</span><strong>{money(c.monto)}</strong></div>
            <div><span>Registrado por</span><strong>{nombreCompletoUsuario(c.registrado_por, c.registrado_por || '—')}</strong></div>
            <div className="business-detail-wide purchase-documents-detail"><span>Archivos adjuntos</span><div className="purchase-document-buttons">{c.pdf_factura_path && <button type="button" className="btn-muted" onClick={() => abrirAdjunto(c.pdf_factura_path)}>PDF</button>}{c.xml_factura_path && <button type="button" className="btn-muted" onClick={() => abrirAdjunto(c.xml_factura_path)}>XML</button>}{c.ctz_path && <button type="button" className="btn-muted" onClick={() => abrirAdjunto(c.ctz_path)}>COTIZACIÓN</button>}{!c.pdf_factura_path && !c.xml_factura_path && !c.ctz_path && <strong>Sin archivos adjuntos.</strong>}</div></div>
            <div className="business-detail-wide"><span>Observaciones</span><strong>{c.observaciones || 'Sin observaciones.'}</strong></div>
          </div><div className="purchase-detail-actions"><button className="btn-secondary" onClick={() => editar(c)}><FestosIcon name="Pencil" size={15}/> Editar</button><button className="btn-danger-soft" onClick={() => eliminar(c)}><FestosIcon name="Trash2" size={15}/> Eliminar</button></div></div>}
        </article>;
      })}
    </div>

    {modal && <div className="modal-overlay" onClick={() => !cargando && setModal(false)}><form className="glass-card modal-card business-modal purchase-modal" onSubmit={guardar} onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><h4 className="panel-title icon-heading">{editando ? <><FestosIcon name="Pencil" size={18}/> Editar compra</> : <><FestosIcon name="Plus" size={18}/> Registrar compra</>}</h4><p className="panel-note">Completa la información de la compra.</p></div><button type="button" className="modal-close-btn" onClick={() => setModal(false)}>×</button></div>

      <div className="form-row"><label>Fecha de compra *</label><input type="date" value={form.fecha_compra} onChange={e => setForm({...form, fecha_compra:e.target.value})} required/></div>
      <div className="form-row"><label>Fecha de control</label><input type="date" value={form.fecha_control || ''} onChange={e => setForm({...form, fecha_control:e.target.value})}/></div>
      <div className="form-row"><label>CeCo *</label><SearchableSelect value={form.ceco} onChange={value => setForm({...form, ceco:value})} required ariaLabel="Seleccionar CeCo" placeholder="Selecciona un CeCo" options={[{value:'',label:'Selecciona un CeCo'},...cecoCatalogo.map(x => ({value:x,label:x}))]} /></div>
      <div className="form-row"><label>LOB</label><SearchableSelect value={form.lob} onChange={value => setForm({...form, lob:value})} ariaLabel="Seleccionar LOB" placeholder="Sin LOB / opcional" options={[{value:'',label:'Sin LOB / opcional'},...lobCatalogo.map(x => ({value:x,label:x}))]} /></div>
      <div className="form-row"><label>Categoría de gasto *</label><SearchableSelect value={form.categoria_gasto} onChange={value => setForm({...form, categoria_gasto:value, project_id: esCostoDirecto(value) ? form.project_id : '', proyecto_texto: esCostoDirecto(value) ? '' : form.proyecto_texto})} required ariaLabel="Seleccionar categoría de gasto" placeholder="Selecciona una categoría de gasto" options={[{value:'',label:'Selecciona una categoría de gasto'},...categoriaGastoCatalogo.map(x => ({value:x,label:x}))]} /><small>Clasificación administrativa/contable usada por Registro de Compras.</small></div>
      <div className="form-row"><label>Proyecto</label>{esCostoDirecto(form.categoria_gasto) ? <SearchableSelect value={form.project_id} onChange={value => setForm({...form, project_id:value})} ariaLabel="Seleccionar proyecto" placeholder="Escribe para buscar un proyecto..." searchPlaceholder="Escribe código o nombre..." options={[{value:'',label:'Sin proyecto / compra general'},...proyectos.map(p => ({value:p.id,label:`${p.codigo || 'PRY'} · ${p.nombre}`,searchText:`${p.codigo || ''} ${p.nombre || ''}`}))]} /> : <><input list="compras-proyectos-generales" value={form.proyecto_texto || ''} onChange={e => setForm({...form, proyecto_texto:e.target.value})} placeholder="Escribe o selecciona un proyecto general..."/><datalist id="compras-proyectos-generales">{proyectosGenerales.map(p => <option key={p.id} value={p.nombre}/>)}</datalist></>}<small>Si escribes un proyecto nuevo, FESTOS lo guardará como proyecto general para futuras compras y filtros.</small></div>
      <div className="form-row"><label>Descripción *</label><textarea rows="3" value={form.descripcion} onChange={e => setForm({...form, descripcion:e.target.value})} placeholder="¿Qué se compró?" required/></div>

      <div className="form-row"><label>Proveedor *</label><SearchableSelect value={form.proveedor_id} onChange={seleccionarProveedor} required ariaLabel="Seleccionar proveedor" placeholder="Selecciona un proveedor..." options={[{value:'',label:'Selecciona un proveedor...'},...proveedores.filter(p => p.estado !== false).map(p => ({value:p.id,label:p.nombre,searchText:`${p.nombre || ''} ${p.ruc_documento || ''}`}))]} /><button type="button" className="btn-muted purchase-add-provider-btn" onClick={() => setMostrarNuevoProveedor(v => !v)}><FestosIcon name="Plus" size={15}/> Añadir nuevo proveedor</button></div>

      {mostrarNuevoProveedor && <div className="quick-provider-card" onClick={e => e.stopPropagation()}>
        <div className="quick-client-head"><strong>Registrar proveedor sin salir de Compras</strong><button type="button" className="btn-muted" onClick={() => setMostrarNuevoProveedor(false)}>Cerrar</button></div>
        <div className="form-grid-2"><div className="form-row"><label>Razón social *</label><input value={proveedorRapido.nombre} onChange={e => setProveedorRapido({...proveedorRapido, nombre:e.target.value})}/></div><div className="form-row"><label>Nombre comercial</label><input value={proveedorRapido.nombre_comercial} onChange={e => setProveedorRapido({...proveedorRapido, nombre_comercial:e.target.value})} placeholder="Nombre con el que se conoce al proveedor"/></div></div>
        <div className="form-grid-2"><div className="form-row"><label>RUC / Documento *</label><input value={proveedorRapido.ruc_documento} onChange={e => setProveedorRapido({...proveedorRapido, ruc_documento:e.target.value})} placeholder="RUC, DNI u otro documento"/></div><div className="form-row"><label>Producto / Servicio *</label><input value={proveedorRapido.productos} onChange={e => setProveedorRapido({...proveedorRapido, productos:e.target.value})}/></div></div>
        <div className="quick-provider-contacts"><div className="contactos-head"><div><strong>Contactos</strong><small>Nombre y teléfono del contacto.</small></div><button type="button" className="btn-muted" onClick={() => setProveedorRapido(prev => ({...prev, contactos:[...(prev.contactos || []), {nombre:'',telefono:''}]}))}><FestosIcon name="Plus" size={15}/> Agregar contacto</button></div>{(proveedorRapido.contactos || []).map((ct, index) => <div className="form-grid-2 quick-provider-contact-row" key={index}><div className="form-row"><label>Nombre{index === 0 ? '' : ` ${index + 1}`}</label><input value={ct.nombre} onChange={e => setProveedorRapido(prev => ({...prev, contactos:prev.contactos.map((x,i) => i === index ? {...x,nombre:e.target.value} : x)}))} placeholder="Nombre del contacto"/></div><div className="form-row"><label>Teléfono{index === 0 ? '' : ` ${index + 1}`}</label><div className="quick-provider-phone-line"><input value={ct.telefono} onChange={e => setProveedorRapido(prev => ({...prev, contactos:prev.contactos.map((x,i) => i === index ? {...x,telefono:e.target.value} : x)}))} placeholder="+51 999 999 999"/>{index > 0 && <button type="button" className="contact-remove-btn" onClick={() => setProveedorRapido(prev => ({...prev, contactos:prev.contactos.filter((_,i) => i !== index)}))}>×</button>}</div></div></div>)}</div>
        <div className="form-grid-2"><div className="form-row"><label>Condición de pago</label><select value={proveedorRapido.condicion_pago} onChange={e => setProveedorRapido({...proveedorRapido, condicion_pago:e.target.value, plazo_dias:e.target.value==='CONTADO'?0:proveedorRapido.plazo_dias})}><option value="CONTADO">CONTADO</option><option value="CREDITO">CRÉDITO</option></select></div><div className="form-row"><label>Plazo (días)</label><input type="number" min="0" disabled={proveedorRapido.condicion_pago==='CONTADO'} value={proveedorRapido.plazo_dias} onChange={e => setProveedorRapido({...proveedorRapido, plazo_dias:e.target.value})}/></div></div>
        <button type="button" className="btn-primary btn-small" disabled={guardandoProveedor} onClick={guardarProveedorRapido}>{guardandoProveedor ? 'Guardando...' : 'Registrar y seleccionar proveedor'}</button>
      </div>}

      <div className="purchase-amount-block">
        <div className="form-row"><label>Valor compra (S/.) *</label><input type="number" min="0.01" step="0.01" value={form.monto_base} onChange={e => setForm({...form, monto_base:e.target.value})} placeholder="0.00" required/></div>
        <div className="purchase-amount-summary"><div><span>Valor compra</span><strong>{money(basePreview)}</strong></div><div><span>Crédito fiscal</span><strong>{money(creditoFiscalPreview)}</strong><small>{form.tipo_comprobante === 'FACTURA' ? 'IGV 18% a favor' : form.tipo_comprobante === 'BOLETA' ? 'Boleta incluye IGV, sin crédito fiscal' : 'No aplica'}</small></div><div className="purchase-total-highlight"><span>Precio de compra</span><strong>{money(totalPreview)}</strong><small>{aplicaIgvPreview ? 'Incluye IGV 18%' : 'Sin IGV automático'}</small></div></div>
      </div>

      <div className="form-row"><label>Tipo de comprobante</label><select value={form.tipo_comprobante} onChange={e => setForm({...form, tipo_comprobante:e.target.value})}>{TIPOS_COMPROBANTE.map(x => <option key={x}>{x}</option>)}</select></div>

      <div className="purchase-invoice-files">
        <div className="form-row purchase-document-number"><label>Número de documento</label><input value={form.numero_documento || ''} onChange={e => setForm({...form, numero_documento:e.target.value.toUpperCase()})} placeholder="Ej. F001-000123"/><small className={estadoLecturaPdf.startsWith('Número detectado') ? 'pdf-reader-status is-success' : estadoLecturaPdf ? 'pdf-reader-status is-warning' : 'pdf-reader-status'}>{procesandoPdf ? 'Leyendo PDF para detectar el número automáticamente…' : (estadoLecturaPdf || 'Puedes escribirlo manualmente. Al adjuntar un PDF, FESTOS intentará detectar el número.')}</small></div>
        <div className="purchase-files-title"><FestosIcon name="Upload" size={18}/><div><strong>Documentos adjuntos</strong><small>Adjunta los documentos disponibles ahora o posteriormente.</small></div></div>
        <div className="purchase-files-grid">
          <label className="purchase-file-box"><span>PDF</span><input type="file" accept="application/pdf,.pdf" onChange={e => seleccionarPdfFactura(e.target.files?.[0] || null)}/><strong>{archivos.pdf?.name || (form.pdf_factura_path ? 'Archivo ya cargado' : 'Seleccionar archivo')}</strong></label>
          <label className="purchase-file-box"><span>XML</span><input type="file" accept=".xml,text/xml,application/xml" onChange={e => setArchivos(a => ({...a, xml:e.target.files?.[0] || null}))}/><strong>{archivos.xml?.name || (form.xml_factura_path ? 'Archivo ya cargado' : 'Seleccionar archivo')}</strong></label>
          <label className="purchase-file-box"><span>COTIZACIÓN</span><input type="file" onChange={e => setArchivos(a => ({...a, ctz:e.target.files?.[0] || null}))}/><strong>{archivos.ctz?.name || (form.ctz_path ? 'Archivo ya cargado' : 'Seleccionar archivo')}</strong></label>
        </div>
      </div>

      <div className="form-row"><label>Observaciones</label><textarea rows="3" value={form.observaciones} onChange={e => setForm({...form, observaciones:e.target.value})} placeholder="Datos adicionales, OC, referencia, etc."/></div>
      <div className="modal-actions"><button className="btn-primary" disabled={cargando}>{cargando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar compra'}</button><button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button></div>
    </form></div>}
  </div>;
}
