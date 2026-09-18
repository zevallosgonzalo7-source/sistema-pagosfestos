import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import OneSignal from 'react-onesignal';
import './App.css';
import { Clientes, Proveedores, Proyectos, Cotizaciones } from './modules/BusinessModules';
import { GestionRoles } from './modules/RolesModule';
import { PERMISOS_DEFECTO, obtenerPermisos, ROLES_LABEL } from './permissions';

/* ============================================================
   CONFIGURACIÓN GLOBAL
   ============================================================ */

// Respaldo temporal: si en Supabase todavía no se ejecutó
// supabase_usuarios_v15.sql, el login sigue funcionando con estas
// credenciales fijas para no dejar a nadie fuera del sistema.
const USUARIOS_VALIDOS_RESPALDO = {
  gonzalo: 'ADMIN9090',
  rodrigo: 'ADMIN8080',
  mar: 'ADMIN7070',
  jesus: 'ADMIN6060',
};

// Monto (S/. con IGV) a partir del cual un pago requiere control dual
// (aprobación de un miembro distinto de quien lo registró/solicitó).
const UMBRAL_APROBACION = 500;

const ETIQUETAS_DISPONIBLES = ['Neumática', 'Automatización', 'Mantenimiento', 'Logística'];

const NOMBRES_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/* ============================================================
   COMPONENTES DE APOYO (gráficos, sin librerías externas)
   ============================================================ */

// Anillo de progreso circular (SVG puro)
function AnilloProgreso({ porcentaje, color, pistaColor, texto, subtexto, textoColor }) {
  const radio = 52;
  const circunferencia = 2 * Math.PI * radio;
  const valor = Math.min(100, Math.max(0, porcentaje));
  const offset = circunferencia - (valor / 100) * circunferencia;

  return (
    <div className="ring-wrap">
      <svg className="ring-svg" width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radio} fill="none" stroke={pistaColor} strokeWidth="10" />
        <circle
          cx="64" cy="64" r={radio} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          transform="rotate(-90 64 64)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="64" y="60" textAnchor="middle" fontSize="21" fontWeight="700" fill={textoColor}>
          {texto}
        </text>
        <text x="64" y="78" textAnchor="middle" fontSize="9" fill={textoColor} opacity="0.6">
          {subtexto}
        </text>
      </svg>
    </div>
  );
}

// Barra de comparación (gasto pagado vs pendiente)
function BarraComparativa({ etiqueta, valor, total, color, tema }) {
  const porcentaje = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <div className="compare-row">
      <div className="compare-labels">
        <span style={{ color: tema.textMuted }}>{etiqueta}</span>
        <span style={{ color: tema.textMain }}>S/. {valor.toFixed(2)}</span>
      </div>
      <div className="compare-track">
        <div
          className="compare-fill"
          style={{ width: `${porcentaje}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
        />
      </div>
    </div>
  );
}

// Mini gráfico de tendencia (barras SVG) de gasto pagado por mes
function TendenciaGastos({ datos, tema }) {
  if (datos.length === 0) {
    return <p className="empty-hint" style={{ color: tema.textMuted }}>Aún no hay historial suficiente para una tendencia.</p>;
  }
  const max = Math.max(...datos.map(d => d.total), 1);
  const ancho = 300;
  const alto = 118;
  const paso = ancho / datos.length;
  const barW = Math.max(10, paso - 14);

  return (
    <svg width="100%" height={alto} viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="gradTendencia" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#224248" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      {datos.map((d, i) => {
        const barH = (d.total / max) * 82;
        const x = i * paso + (paso - barW) / 2;
        const y = 96 - barH;
        return (
          <g key={d.mes}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, 2)} rx="4" fill="url(#gradTendencia)" />
            <text x={x + barW / 2} y="110" fontSize="8" textAnchor="middle" fill={tema.textMuted}>
              {d.etiqueta}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Campanita de notificaciones con badge y panel flotante
function CentroNotificaciones({ notificaciones, panelAbierto, setPanelAbierto, marcarTodasLeidas }) {
  const noLeidas = notificaciones.filter(n => !n.leido).length;

  return (
    <div className="notif-wrap">
      <button
        className="icon-btn"
        onClick={() => setPanelAbierto(o => !o)}
        title="Notificaciones"
        aria-label="Notificaciones"
      >
        🔔
        {noLeidas > 0 && <span className="notif-badge">{noLeidas > 9 ? '9+' : noLeidas}</span>}
      </button>

      {panelAbierto && (
        <>
          <div className="notif-backdrop" onClick={() => setPanelAbierto(false)} />
          <div className="notif-panel">
            <div className="notif-panel-header">
              <strong>Notificaciones</strong>
              {noLeidas > 0 && (
                <button className="notif-mark-read" onClick={marcarTodasLeidas}>
                  Marcar todas leídas
                </button>
              )}
            </div>
            <div className="notif-list">
              {notificaciones.length === 0 ? (
                <p className="notif-empty">Sin movimientos por ahora.</p>
              ) : (
                notificaciones.map(n => (
                  <div key={n.id} className={`notif-item ${n.leido ? '' : 'unread'}`}>
                    <span className="notif-item-icon">{iconoPorTipo(n.tipo)}</span>
                    <div>
                      <p className="notif-item-msg">{n.mensaje}</p>
                      <span className="notif-item-time">{n.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


function cargoUsuario(usuario) {
  const cargos = {
    gonzalo: 'Administrador General',
    rodrigo: 'Jefe de Operaciones',
    mar: 'Coordinadora Comercial',
    jesus: 'Asistente Administrativo',
  };
  return cargos[String(usuario || '').trim().toLowerCase()] || 'Usuario del sistema';
}

function iconoPorTipo(tipo) {
  switch (tipo) {
    case 'nuevo': return '📤';
    case 'pagado': return '✅';
    case 'pendiente': return '↩️';
    case 'edicion': return '✏️';
    case 'eliminado': return '🗑️';
    case 'aprobacion': return '🔐';
    default: return '🔔';
  }
}

function iconoPorAccion(accion) {
  switch (accion) {
    case 'Creación': return '📤';
    case 'Edición': return '✏️';
    case 'Eliminación': return '🗑️';
    case 'Solicitud de Aprobación': return '🔐';
    case 'Aprobación y Pago': return '✅';
    case 'Reversión a Pendiente': return '↩️';
    default: return '📌';
  }
}

// Chips de etiquetas técnicas (selección múltiple)
function SelectorEtiquetas({ seleccionadas, onToggle }) {
  return (
    <div className="tag-selector">
      {ETIQUETAS_DISPONIBLES.map(tag => {
        const activo = seleccionadas.includes(tag);
        return (
          <button
            type="button"
            key={tag}
            className={`tag-chip ${activo ? 'active' : ''}`}
            onClick={() => onToggle(tag)}
          >
            #{tag}
          </button>
        );
      })}
    </div>
  );
}

function ChipsEtiquetas({ etiquetas }) {
  if (!etiquetas) return null;
  const lista = etiquetas.split(',').map(t => t.trim()).filter(Boolean);
  if (lista.length === 0) return null;
  return (
    <div className="tag-list">
      {lista.map(t => (
        <span key={t} className="tag-pill">#{t}</span>
      ))}
    </div>
  );
}

/* ============================================================
   APP PRINCIPAL
   ============================================================ */

function App() {
  // --- ESTADOS DE AUTENTICACIÓN ---
  const [usuarioLogueado, setUsuarioLogueado] = useState(() => {
    return localStorage.getItem('festos_sesion_usuario') || '';
  });
  const [inputUser, setInputUser] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  // Tema fijo: interfaz profesional en blanco + verde petróleo Festos.
  // (Se eliminó el selector de modo oscuro/claro a pedido del cliente.)
  const modoOscuro = false;

  // --- SIDEBAR (única navegación de la app) ---
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  });

  // --- NOTIFICACIONES ---
  const [notificaciones, setNotificaciones] = useState(() => {
    try {
      const guardado = localStorage.getItem('festos_notificaciones');
      return guardado ? JSON.parse(guardado) : [];
    } catch (e) {
      return [];
    }
  });
  const [panelNotifAbierto, setPanelNotifAbierto] = useState(false);
  const [toasts, setToasts] = useState([]);

  // --- CENTRO DE AUDITORÍA (bitácora de trazabilidad) ---
  const [auditoria, setAuditoria] = useState(() => {
    try {
      const guardado = localStorage.getItem('festos_auditoria');
      return guardado ? JSON.parse(guardado) : [];
    } catch (e) {
      return [];
    }
  });

  const registrarAuditoria = (accion, detalle) => {
    const entrada = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      accion,
      detalle,
      usuario: usuarioLogueado,
      timestamp: new Date().toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }),
    };
    setAuditoria(prev => {
      const actualizado = [entrada, ...prev].slice(0, 200);
      try {
        localStorage.setItem('festos_auditoria', JSON.stringify(actualizado));
      } catch (e) { /* almacenamiento no disponible */ }
      return actualizado;
    });
  };

  const agregarNotificacion = (mensaje, tipo = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nueva = {
      id,
      mensaje,
      tipo,
      timestamp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      leido: false,
    };

    setNotificaciones(prev => {
      const actualizado = [nueva, ...prev].slice(0, 30);
      try {
        localStorage.setItem('festos_notificaciones', JSON.stringify(actualizado));
      } catch (e) { /* almacenamiento no disponible */ }
      return actualizado;
    });

    setToasts(prev => [...prev, nueva]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const marcarTodasLeidas = () => {
    setNotificaciones(prev => {
      const actualizado = prev.map(n => ({ ...n, leido: true }));
      try {
        localStorage.setItem('festos_notificaciones', JSON.stringify(actualizado));
      } catch (e) { /* almacenamiento no disponible */ }
      return actualizado;
    });
  };

  // Manejo de Inicio de Sesión: valida contra la tabla real de usuarios en
  // Supabase (creada por supabase_usuarios_v15.sql). Si esa función aún no
  // existe (script no ejecutado todavía), cae de respaldo a las 4
  // credenciales fijas originales para no dejar a nadie sin acceso.
  const [verificandoLogin, setVerificandoLogin] = useState(false);

  const manejarLogin = async (e) => {
    e.preventDefault();
    setErrorLogin('');
    const userInput = inputUser.trim();
    const passInput = inputPass;
    if (!userInput || !passInput) return;

    setVerificandoLogin(true);
    try {
      const { data, error } = await supabase.rpc('verificar_login', {
        p_usuario: userInput,
        p_password: passInput,
      });
      if (error) throw error;

      if (data && data.length > 0) {
        const usuarioValido = data[0].usuario;
        localStorage.setItem('festos_sesion_usuario', usuarioValido);
        setUsuarioLogueado(usuarioValido);
        setInputUser('');
        setInputPass('');
      } else {
        setErrorLogin('Acceso denegado: Usuario o contraseña incorrectos.');
      }
    } catch (err) {
      console.warn('No se pudo validar el login contra Supabase, usando respaldo local.', err);
      const userLower = userInput.toLowerCase();
      if (USUARIOS_VALIDOS_RESPALDO[userLower] && USUARIOS_VALIDOS_RESPALDO[userLower] === passInput) {
        localStorage.setItem('festos_sesion_usuario', userLower);
        setUsuarioLogueado(userLower);
        setInputUser('');
        setInputPass('');
      } else {
        setErrorLogin('Acceso denegado: Usuario o contraseña incorrectos.');
      }
    } finally {
      setVerificandoLogin(false);
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('festos_sesion_usuario');
    setUsuarioLogueado('');
  };

  // --- ROLES Y PERMISOS ---
  const [permisosPorUsuario, setPermisosPorUsuario] = useState(() => {
    try {
      const guardado = localStorage.getItem('festos_roles_permisos');
      return guardado ? { ...PERMISOS_DEFECTO, ...JSON.parse(guardado) } : PERMISOS_DEFECTO;
    } catch (e) {
      return PERMISOS_DEFECTO;
    }
  });

  const cargarPermisos = async () => {
    try {
      const { data, error } = await supabase.from('roles_permisos').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        const mapa = { ...PERMISOS_DEFECTO };
        data.forEach(fila => {
          mapa[fila.usuario] = { rol_label: fila.rol_label, ...fila.permisos };
        });
        setPermisosPorUsuario(mapa);
        try { localStorage.setItem('festos_roles_permisos', JSON.stringify(mapa)); } catch (e) { /* no-op */ }
      }
    } catch (err) {
      // Si la tabla aún no existe en Supabase (no se corrió supabase_roles_v14.sql),
      // la app sigue funcionando con los permisos por defecto / guardados localmente.
      console.warn('No se pudo cargar roles_permisos desde Supabase, usando valores locales.', err);
    }
  };

  const misPermisos = obtenerPermisos(permisosPorUsuario, usuarioLogueado);

  const [vista, setVista] = useState('dashboard');
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Campos del formulario de Facturas/Pagos
  const [producto, setProducto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [montoIngresado, setMontoIngresado] = useState('');
  const [aplicarIgv, setAplicarIgv] = useState(true);
  const [descripcion, setDescripcion] = useState('');
  const [proyecto, setProyecto] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState([]);

  const alternarEtiqueta = (tag) => {
    setEtiquetasSeleccionadas(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Estado para edición en Por Pagar / Historial
  const [pagoEditando, setPagoEditando] = useState(null);
  const [archivoNuevo, setArchivoNuevo] = useState(null);

  // Filtros del Historial
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroComprobante, setFiltroComprobante] = useState('todos');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('todas');

  // Asistente IA
  const [busquedaInteligente, setBusquedaInteligente] = useState('');

  const valorBase = parseFloat(montoIngresado) || 0;
  const precioFinalCalculado = aplicarIgv ? (valorBase * 1.18).toFixed(2) : valorBase.toFixed(2);

  useEffect(() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return;
    }

    if (window.OneSignalInitialized) return;
    window.OneSignalInitialized = true;

    try {
      OneSignal.init({
        appId: 'ef5bdb2f-ce76-4f50-b664-071d1c526642',
        allowLocalhostAsSecureOrigin: true,
      }).then(() => {
        if (OneSignal.SlidedefaultPrompt && typeof OneSignal.SlidedefaultPrompt.showPrompt === 'function') {
          OneSignal.SlidedefaultPrompt.showPrompt();
        }
      });
    } catch (err) {
      console.warn('OneSignal notice:', err);
    }
  }, []);

  useEffect(() => {
    if (usuarioLogueado) {
      obtenerPagos();
      cargarPermisos();
    }
  }, [usuarioLogueado]);

  // Si el usuario pierde acceso a la vista en la que está (por un cambio de
  // permisos), lo regresamos al Dashboard para evitar pantallas huérfanas.
  useEffect(() => {
    const requiereVer = {
      clientes: misPermisos.ver_clientes,
      proveedores: misPermisos.ver_proveedores,
      proyectos: misPermisos.ver_proyectos,
      cotizaciones: misPermisos.ver_cotizaciones,
      roles: misPermisos.gestionar_roles,
    };
    if (vista in requiereVer && !requiereVer[vista]) {
      setVista('dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, usuarioLogueado, permisosPorUsuario]);

  const obtenerPagos = async () => {
    const { data, error } = await supabase.from('pagos').select('*');
    if (error) {
      console.error('Error al cargar pagos:', error);
    } else {
      setPagos(data || []);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!producto || !proveedor || !montoIngresado) {
      alert('Por favor completa los campos obligatorios');
      return;
    }

    setCargando(true);

    try {
      let nombreArchivoFinal = 'Sin archivo adjunto';
      let urlArchivoFinal = '';

      if (archivo) {
        const fileExt = archivo.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('facturas')
          .upload(fileName, archivo);

        if (uploadError) throw uploadError;

        const { data: publicURLData } = supabase.storage
          .from('facturas')
          .getPublicUrl(fileName);

        urlArchivoFinal = publicURLData.publicUrl;
        nombreArchivoFinal = archivo.name;
      }

      const timestamp = Date.now();
      const idUnico = `PAG-${timestamp.toString().slice(-6)}`;
      const fechaActualStr = new Date().toISOString().split('T')[0];

      const nuevoPagoDB = {
        codigo_unico: idUnico,
        producto,
        proveedor,
        precio_sin_igv: valorBase.toFixed(2),
        precio_con_igv: parseFloat(precioFinalCalculado),
        descripcion: `${descripcion} ${aplicarIgv ? '(Incluye IGV)' : '(Sin IGV)'}`.trim(),
        proyecto: proyecto || 'General',
        etiquetas: etiquetasSeleccionadas.join(', '),
        nombre_archivo: nombreArchivoFinal,
        url_archivo: urlArchivoFinal,
        estado: 'Por Pagar',
        fecha_creacion: fechaActualStr,
        fecha_legible: new Date().toLocaleDateString(),
        registrado_por: usuarioLogueado,
      };

      const { error: insertError } = await supabase.from('pagos').insert([nuevoPagoDB]);
      if (insertError) throw insertError;

      agregarNotificacion(`Nuevo pago registrado: ${proveedor} — ${producto} (S/. ${precioFinalCalculado})`, 'nuevo');
      registrarAuditoria('Creación', `${idUnico} · ${proveedor} — ${producto} · S/. ${precioFinalCalculado}`);

      setProducto('');
      setProveedor('');
      setMontoIngresado('');
      setAplicarIgv(true);
      setDescripcion('');
      setProyecto('');
      setArchivo(null);
      setEtiquetasSeleccionadas([]);
      setCargando(false);
      obtenerPagos();
      setVista('porPagar');

    } catch (error) {
      console.error(error);
      alert('Hubo un error al subir el pago o la factura.');
      setCargando(false);
    }
  };

  const guardarEdicionConArchivo = async (e) => {
    e.preventDefault();
    if (!pagoEditando) return;

    setCargando(true);
    try {
      let urlArchivoFinal = pagoEditando.url_archivo;
      let nombreArchivoFinal = pagoEditando.nombre_archivo;

      if (archivoNuevo) {
        const fileExt = archivoNuevo.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('facturas')
          .upload(fileName, archivoNuevo);

        if (uploadError) throw uploadError;

        const { data: publicURLData } = supabase.storage
          .from('facturas')
          .getPublicUrl(fileName);

        urlArchivoFinal = publicURLData.publicUrl;
        nombreArchivoFinal = archivoNuevo.name;
      }

      const { error } = await supabase
        .from('pagos')
        .update({
          proveedor: pagoEditando.proveedor,
          producto: pagoEditando.producto,
          proyecto: pagoEditando.proyecto,
          precio_con_igv: parseFloat(pagoEditando.precio_con_igv),
          url_archivo: urlArchivoFinal,
          nombre_archivo: nombreArchivoFinal,
        })
        .eq('id', pagoEditando.id);

      if (error) throw error;

      agregarNotificacion(`Registro actualizado: ${pagoEditando.proveedor} — ${pagoEditando.producto}`, 'edicion');
      registrarAuditoria('Edición', `${pagoEditando.codigo_unico} · ${pagoEditando.proveedor} — ${pagoEditando.producto}`);
      setPagoEditando(null);
      setArchivoNuevo(null);
      obtenerPagos();
    } catch (error) {
      console.error(error);
      alert('Error al actualizar el registro.');
    } finally {
      setCargando(false);
    }
  };

  const sincronizarConGoogleSheets = async (pago) => {
    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby-TY2sJmERrrIz9ktYYItTp6jQnoJIQMKBnZWPL7AjXqAGxOvwaQI90TfUx8dXDoKx/exec';

    const datosEnvio = {
      fecha: pago.fecha_legible || '',
      proveedor: pago.proveedor || '',
      proyecto: pago.proyecto || '',
      descripcion: pago.descripcion || '',
      tipo_documento: 'Factura',
      codigo_unico: pago.codigo_unico || '',
      precio_sin_igv: pago.precio_sin_igv || '0.00',
      precio_con_igv: pago.precio_con_igv || '0.00',
      registrado_por: pago.registrado_por || 'Anónimo',
    };

    try {
      await fetch(WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosEnvio),
      });
    } catch (error) {
      console.error('Error al sincronizar con Google Sheets:', error);
    }
  };

  const eliminarDeGoogleSheets = async (codigoUnico) => {
    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby-TY2sJmERrrIz9ktYYItTp6jQnoJIQMKBnZWPL7AjXqAGxOvwaQI90TfUx8dXDoKx/exec';
    const urlConParametros = `${WEB_APP_URL}?action=delete&codigo_unico=${encodeURIComponent(codigoUnico)}`;

    try {
      await fetch(urlConParametros, {
        method: 'GET',
        mode: 'no-cors',
      });
    } catch (error) {
      console.error('Error al eliminar de Google Sheets:', error);
    }
  };

  // Cambia el estado de un pago, aplicando control dual (Idea 4) para montos
  // iguales o superiores a UMBRAL_APROBACION: un pago de ese nivel no puede
  // ser aprobado por la misma persona que lo solicitó.
  const cambiarEstado = async (id, nuevoEstado, { aprobando = false } = {}) => {
    const pagoActual = pagos.find(p => p.id === id);
    if (!pagoActual) return;

    const monto = parseFloat(pagoActual.precio_con_igv) || 0;
    const requiereControlDual = monto >= UMBRAL_APROBACION;

    // Paso 1: alguien intenta marcar como Pagado un monto elevado -> pasa a
    // "Pendiente Aprobación" en lugar de pagarse directamente.
    if (nuevoEstado === 'Pagado' && requiereControlDual && !aprobando) {
      const { error } = await supabase
        .from('pagos')
        .update({ estado: 'Pendiente Aprobación', solicitado_por: usuarioLogueado })
        .eq('id', id);

      if (error) {
        alert('Error al enviar el pago a aprobación.');
        return;
      }
      agregarNotificacion(`Requiere aprobación (control dual): ${pagoActual.proveedor} — S/. ${monto.toFixed(2)}`, 'aprobacion');
      registrarAuditoria('Solicitud de Aprobación', `${pagoActual.codigo_unico} · ${pagoActual.proveedor} · S/. ${monto.toFixed(2)}`);
      obtenerPagos();
      return;
    }

    // Paso 2: un segundo miembro aprueba el pago pendiente de aprobación.
    if (nuevoEstado === 'Pagado' && aprobando) {
      const solicitante = pagoActual.solicitado_por || pagoActual.registrado_por;
      if (solicitante === usuarioLogueado) {
        alert('Control dual: este pago debe ser aprobado por un miembro distinto de quien lo solicitó.');
        return;
      }
    }

    const payloadUpdate = { estado: nuevoEstado };
    if (aprobando) payloadUpdate.aprobado_por = usuarioLogueado;

    const { error } = await supabase.from('pagos').update(payloadUpdate).eq('id', id);

    if (error) {
      alert('Error al actualizar el estado');
    } else {
      if (nuevoEstado === 'Pagado') {
        sincronizarConGoogleSheets(pagoActual);
        agregarNotificacion(`Pago marcado como pagado: ${pagoActual.proveedor} — ${pagoActual.producto}`, 'pagado');
        registrarAuditoria('Aprobación y Pago', `${pagoActual.codigo_unico} · ${pagoActual.proveedor} — ${pagoActual.producto}`);
      } else {
        agregarNotificacion(`Pago movido a pendiente: ${pagoActual.proveedor} — ${pagoActual.producto}`, 'pendiente');
        registrarAuditoria('Reversión a Pendiente', `${pagoActual.codigo_unico} · ${pagoActual.proveedor} — ${pagoActual.producto}`);
      }
      obtenerPagos();
    }
  };

  const eliminarPago = async (id, codigoUnico) => {
    const confirmar = window.confirm(`¿Estás seguro de que deseas eliminar el registro ${codigoUnico}?`);
    if (!confirmar) return;

    const { error } = await supabase
      .from('pagos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error al eliminar:', error);
      alert('Hubo un error al intentar eliminar el registro.');
    } else {
      eliminarDeGoogleSheets(codigoUnico);
      agregarNotificacion(`Registro eliminado: ${codigoUnico}`, 'eliminado');
      registrarAuditoria('Eliminación', codigoUnico);
      obtenerPagos();
    }
  };

  const exportarAExcel = () => {
    if (pagosFiltrados.length === 0) {
      alert('No hay datos en el historial para exportar con los filtros actuales.');
      return;
    }

    const headers = [
      'Fecha',
      'Proveedor',
      'Proyecto',
      'Etiquetas',
      'Descripción',
      'Tipo de Documento',
      'Número de Factura / Código',
      'Precio Sin IGV (S/.)',
      'Precio Con IGV (S/.)',
      'Tiene Comprobante',
    ];

    const rows = pagosFiltrados.map(p => [
      `"${p.fecha_legible || ''}"`,
      `"${p.proveedor || ''}"`,
      `"${p.proyecto || ''}"`,
      `"${p.etiquetas || ''}"`,
      `"${p.descripcion || ''}"`,
      `"Factura"`,
      `"${p.codigo_unico || ''}"`,
      p.precio_sin_igv || '0.00',
      p.precio_con_igv || '0.00',
      `"${p.url_archivo ? 'Sí' : 'No'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Pagos_Festos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pagosFiltrados = pagos.filter(p => {
    if (p.estado !== 'Pagado') return false;
    if (filtroFechaInicio && p.fecha_creacion < filtroFechaInicio) return false;
    if (filtroFechaFin && p.fecha_creacion > filtroFechaFin) return false;

    if (filtroComprobante === 'conFactura' && !p.url_archivo) return false;
    if (filtroComprobante === 'sinFactura' && p.url_archivo) return false;

    if (filtroEtiqueta !== 'todas') {
      const tags = (p.etiquetas || '').split(',').map(t => t.trim());
      if (!tags.includes(filtroEtiqueta)) return false;
    }

    if (filtroBusqueda.trim()) {
      const texto = filtroBusqueda.toLowerCase();
      const coincide =
        (p.codigo_unico && p.codigo_unico.toLowerCase().includes(texto)) ||
        (p.producto && p.producto.toLowerCase().includes(texto)) ||
        (p.proveedor && p.proveedor.toLowerCase().includes(texto)) ||
        (p.proyecto && p.proyecto.toLowerCase().includes(texto)) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(texto)) ||
        (p.registrado_por && p.registrado_por.toLowerCase().includes(texto));

      if (!coincide) return false;
    }

    return true;
  });

  const pagosBusquedaInteligente = pagos.filter(p => {
    if (!busquedaInteligente.trim()) return true;
    const terminos = busquedaInteligente.toLowerCase().trim().split(' ');
    const textoCompleto = `
      ${p.codigo_unico || ''} ${p.producto || ''} ${p.proveedor || ''} 
      ${p.proyecto || ''} ${p.descripcion || ''} ${p.registrado_por || ''} 
      ${p.etiquetas || ''} ${p.fecha_legible || ''} ${p.precio_con_igv || ''} ${p.estado || ''}
    `.toLowerCase();
    return terminos.every(termino => textoCompleto.includes(termino));
  });

  // Cálculos Dashboard
  const pagosRealizados = pagos.filter(p => p.estado === 'Pagado');
  const pagosPendientesList = pagos.filter(p => p.estado === 'Por Pagar');
  const pagosEnAprobacionList = pagos.filter(p => p.estado === 'Pendiente Aprobación');
  const gastoTotalAcumulado = pagosRealizados.reduce((acc, p) => acc + (parseFloat(p.precio_con_igv) || 0), 0);
  const montoPendienteTotal = [...pagosPendientesList, ...pagosEnAprobacionList]
    .reduce((acc, p) => acc + (parseFloat(p.precio_con_igv) || 0), 0);
  const totalConFactura = pagos.filter(p => p.url_archivo).length;
  const totalSinFactura = pagos.length - totalConFactura;
  const porcentajeConFactura = pagos.length > 0 ? (totalConFactura / pagos.length) * 100 : 0;
  const totalFlujo = gastoTotalAcumulado + montoPendienteTotal;

  // Tendencia de gasto pagado por mes (últimos 6 meses con datos)
  const tendenciaGastos = (() => {
    const agrupado = {};
    pagosRealizados.forEach(p => {
      const clave = (p.fecha_creacion || '').slice(0, 7);
      if (!clave || clave.length !== 7) return;
      agrupado[clave] = (agrupado[clave] || 0) + (parseFloat(p.precio_con_igv) || 0);
    });
    const meses = Object.keys(agrupado).sort().slice(-6);
    return meses.map(m => {
      const [, mm] = m.split('-');
      const idx = parseInt(mm, 10) - 1;
      return { mes: m, total: agrupado[m], etiqueta: NOMBRES_MES[idx] || mm };
    });
  })();

  const tema = {
    bgCard: modoOscuro ? 'rgba(19, 32, 36, 0.55)' : 'rgba(255, 255, 255, 0.9)',
    cardBorder: modoOscuro ? 'rgba(148, 197, 197, 0.14)' : 'rgba(15, 23, 42, 0.08)',
    textMain: modoOscuro ? '#f2f7f7' : '#132024',
    textMuted: modoOscuro ? '#9db3b6' : '#5a6b6e',
    border: modoOscuro ? '#2b4247' : '#dbe6e7',
    inputBg: modoOscuro ? 'rgba(9, 18, 20, 0.6)' : '#ffffff',
    inputColor: modoOscuro ? '#f2f7f7' : '#132024',
    accent: modoOscuro ? '#57d4fb' : '#224248',
  };

  const itemsNav = [
    { id: 'dashboard', icono: '📊', label: 'Dashboard' },
    { id: 'subir', icono: '📤', label: 'Subir Pago' },
    { id: 'porPagar', icono: '⏳', label: 'Por Pagar', badge: pagosPendientesList.length + pagosEnAprobacionList.length },
    { id: 'historial', icono: '📂', label: 'Historial' },
    { id: 'auditoria', icono: '🕵️', label: 'Auditoría' },
    { id: 'asistente', icono: '🤖', label: 'Asistente IA' },
    ...(misPermisos.ver_clientes ? [{ id: 'clientes', icono: '👥', label: 'Clientes' }] : []),
    ...(misPermisos.ver_proveedores ? [{ id: 'proveedores', icono: '🚚', label: 'Proveedores' }] : []),
    ...(misPermisos.ver_proyectos ? [{ id: 'proyectos', icono: '📁', label: 'Proyectos' }] : []),
    ...(misPermisos.ver_cotizaciones ? [{ id: 'cotizaciones', icono: '📑', label: 'Cotizaciones' }] : []),
    ...(misPermisos.gestionar_roles ? [{ id: 'roles', icono: '🔐', label: 'Roles y Permisos' }] : []),
  ];

  const irAVista = (id) => {
    setVista(id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  /* -------------------- PANTALLA DE LOGIN -------------------- */
  if (!usuarioLogueado) {
    return (
      <div className="login-screen">
        <div className="ambient-bg" aria-hidden="true">
          <div className="ambient-logo" />
          <div className="ambient-glow" />
        </div>

        <div className="login-center">
          <form onSubmit={manejarLogin} className="login-card">
            <div className="login-brand">
              <img src="/festoslogo.jpeg" alt="Festos" className="login-brand-img" />
            </div>

            <h2 className="login-title">Control Festos</h2>
            <p className="login-subtitle">Acceso exclusivo para el equipo autorizado</p>

            {errorLogin && <div className="login-error">{errorLogin}</div>}

            <div className="login-field">
              <label>Usuario</label>
              <input
                type="text"
                placeholder="Ej. Gonzalo, Rodrigo, Mar, Jesus"
                value={inputUser}
                onChange={(e) => setInputUser(e.target.value)}
                required
              />
            </div>

            <div className="login-field login-field-last">
              <label>Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={inputPass}
                onChange={(e) => setInputPass(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-submit" disabled={verificandoLogin}>
              {verificandoLogin ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <p className="login-footnote">FESTOS · Sistema interno de control de pagos y compras</p>
        </div>
      </div>
    );
  }

  /* -------------------- APP AUTENTICADA -------------------- */
  return (
    <div className="app-shell" data-theme={modoOscuro ? 'dark' : 'light'}>
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-logo" />
        <div className="ambient-glow" />
      </div>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/festoslogo.jpeg" alt="Festos" />
          <div className="sidebar-brand-text">
            Control Festos
            <span>Pagos y compras</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {itemsNav.map(item => (
            <button
              key={item.id}
              className={`sidebar-item ${vista === item.id ? 'active' : ''}`}
              onClick={() => irAVista(item.id)}
            >
              <span className="sidebar-item-icon">{item.icono}</span>
              {item.label}
              {!!item.badge && <span className="sidebar-item-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">Sesión: {usuarioLogueado}</div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn"
              onClick={() => setSidebarOpen(o => !o)}
              title="Abrir/cerrar menú"
              aria-label="Abrir/cerrar menú"
            >
              <span className={`hamburger-lines ${sidebarOpen ? 'active' : ''}`}>
                <span></span><span></span><span></span>
              </span>
            </button>
            <span className="topbar-title">Control de Pagos y Compras FESTOS</span>
          </div>

          <div className="topbar-right">
            <CentroNotificaciones
              notificaciones={notificaciones}
              panelAbierto={panelNotifAbierto}
              setPanelAbierto={setPanelNotifAbierto}
              marcarTodasLeidas={marcarTodasLeidas}
            />

            <div className="user-profile-pill"><span className="user-avatar">👤</span><div className="user-profile-text"><strong>{usuarioLogueado}</strong><span>{cargoUsuario(usuarioLogueado)}</span></div></div>

            <button onClick={cerrarSesion} className="logout-btn">Salir 🚪</button>
          </div>
        </header>

        <div className="content-container">

          {/* MODAL / FORMULARIO FLOTANTE DE EDICIÓN Y SUBIDA DE COMPROBANTE */}
          {pagoEditando && (
            <div className="modal-overlay">
              <form onSubmit={guardarEdicionConArchivo} className="glass-card modal-card">
                <h3 className="section-title">✏️ Editar Registro y Comprobante</h3>

                <div className="form-row">
                  <label>Proveedor</label>
                  <input type="text" value={pagoEditando.proveedor} onChange={(e) => setPagoEditando({ ...pagoEditando, proveedor: e.target.value })} required />
                </div>

                <div className="form-row">
                  <label>Producto / Servicio</label>
                  <input type="text" value={pagoEditando.producto} onChange={(e) => setPagoEditando({ ...pagoEditando, producto: e.target.value })} required />
                </div>

                <div className="form-row">
                  <label>Monto (S/.)</label>
                  <input type="number" step="0.01" value={pagoEditando.precio_con_igv} onChange={(e) => setPagoEditando({ ...pagoEditando, precio_con_igv: e.target.value })} required />
                </div>

                <div className="form-row">
                  <label>Comprobante Actual: {pagoEditando.url_archivo ? '✅ Subido' : '❌ Sin comprobante'}</label>
                  <input type="file" onChange={(e) => setArchivoNuevo(e.target.files[0])} />
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setPagoEditando(null)} className="btn-secondary">Cancelar</button>
                  <button type="submit" disabled={cargando} className="btn-primary">{cargando ? 'Guardando...' : 'Guardar Cambios'}</button>
                </div>
              </form>
            </div>
          )}

          {/* VISTA: DASHBOARD EJECUTIVO */}
          {vista === 'dashboard' && (
            <div>
              <h3 className="section-title">📊 Dashboard Ejecutivo General</h3>

              <div className="stat-grid">
                <div className="glass-card stat-card" style={{ '--accent-line': 'rgba(34,197,94,0.6)' }}>
                  <p className="stat-label">Gasto Total Pagado</p>
                  <h2 className="stat-value" style={{ color: '#22c55e' }}>S/. {gastoTotalAcumulado.toFixed(2)}</h2>
                </div>
                <div className="glass-card stat-card" style={{ '--accent-line': 'rgba(245,158,11,0.6)' }}>
                  <p className="stat-label">Total Por Pagar</p>
                  <h2 className="stat-value" style={{ color: '#f59e0b' }}>S/. {montoPendienteTotal.toFixed(2)}</h2>
                </div>
                <div className="glass-card stat-card" style={{ '--accent-line': 'rgba(13,148,136,0.6)' }}>
                  <p className="stat-label">Registros con Factura</p>
                  <h2 className="stat-value" style={{ color: '#0d9488' }}>{totalConFactura} / {pagos.length}</h2>
                </div>
                <div className="glass-card stat-card" style={{ '--accent-line': 'rgba(239,68,68,0.6)' }}>
                  <p className="stat-label">En Aprobación (Control Dual)</p>
                  <h2 className="stat-value" style={{ color: '#ef4444' }}>{pagosEnAprobacionList.length}</h2>
                </div>
              </div>

              <div className="panel-grid">
                <div className="glass-card panel-card panel-center">
                  <h4 className="panel-title">📌 Cobertura de Facturación</h4>
                  <AnilloProgreso
                    porcentaje={porcentajeConFactura}
                    color="#0d9488"
                    pistaColor={tema.border}
                    texto={`${porcentajeConFactura.toFixed(0)}%`}
                    subtexto="con factura"
                    textoColor={tema.textMain}
                  />
                  <p className="panel-note">{pagosPendientesList.length} registro(s) aún sin comprobante adjunto</p>
                </div>

                <div className="glass-card panel-card">
                  <h4 className="panel-title">⚖️ Pagado vs. Pendiente</h4>
                  <BarraComparativa etiqueta="Pagado" valor={gastoTotalAcumulado} total={totalFlujo} color="#22c55e" tema={tema} />
                  <BarraComparativa etiqueta="Por Pagar" valor={montoPendienteTotal} total={totalFlujo} color="#f59e0b" tema={tema} />
                </div>

                <div className="glass-card panel-card">
                  <h4 className="panel-title">📈 Tendencia de Gasto Pagado</h4>
                  <TendenciaGastos datos={tendenciaGastos} tema={tema} />
                </div>
              </div>

              <div className="glass-card panel-card">
                <h4 className="panel-title">💡 Consejos Financieros Festos</h4>
                <p className="tip-line">• Recuerda subir los comprobantes faltantes desde la pestaña de Historial.</p>
                <p className="tip-line">• Utiliza el asistente IA para consultas rápidas por proveedor o proyecto.</p>
                <p className="tip-line">• Los pagos desde S/. {UMBRAL_APROBACION.toFixed(2)} requieren aprobación de un segundo miembro (control dual).</p>
              </div>
            </div>
          )}

          {/* VISTA: SUBIR PAGO */}
          {vista === 'subir' && (
            <form onSubmit={handleSubmit} className="glass-card form-card">
              <h3 className="section-title">📤 Subir Nueva Factura / Pago</h3>

              <div className="form-grid-2">
                <div className="form-row">
                  <label>Producto / Servicio *</label>
                  <input type="text" value={producto} onChange={(e) => setProducto(e.target.value)} required />
                </div>
                <div className="form-row">
                  <label>Proveedor *</label>
                  <input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} required />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-row">
                  <label>Monto (S/.) *</label>
                  <input type="number" step="0.01" value={montoIngresado} onChange={(e) => setMontoIngresado(e.target.value)} required />
                </div>
                <div className="form-row">
                  <label>Proyecto</label>
                  <input type="text" value={proyecto} onChange={(e) => setProyecto(e.target.value)} placeholder="Ej. General, Xiaomi..." />
                </div>
              </div>

              <div className="form-row">
                <label>Etiquetas Técnicas</label>
                <SelectorEtiquetas seleccionadas={etiquetasSeleccionadas} onToggle={alternarEtiqueta} />
              </div>

              <div className="form-row igv-row">
                <label className="checkbox-label">
                  <input type="checkbox" checked={aplicarIgv} onChange={(e) => setAplicarIgv(e.target.checked)} />
                  Agregar 18% IGV al monto ingresado
                </label>
                <p className="calc-total">Total calculado: <strong>S/. {precioFinalCalculado}</strong></p>
                {valorBase * (aplicarIgv ? 1.18 : 1) >= UMBRAL_APROBACION && (
                  <p className="dual-control-hint">🔐 Este monto requerirá aprobación de un segundo miembro del equipo.</p>
                )}
              </div>

              <div className="form-row">
                <label>Descripción / Notas</label>
                <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows="3"></textarea>
              </div>

              <div className="form-row file-row">
                <label>Adjuntar Factura (Opcional)</label>
                <input type="file" onChange={(e) => setArchivo(e.target.files[0])} />
              </div>

              <button type="submit" disabled={cargando} className="btn-primary btn-block">
                {cargando ? 'Subiendo...' : 'Registrar Pago'}
              </button>
            </form>
          )}

          {/* VISTA: POR PAGAR */}
          {vista === 'porPagar' && (
            <div>
              {pagosEnAprobacionList.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <h3 className="section-title">🔐 Pendientes de Aprobación ({pagosEnAprobacionList.length})</h3>
                  <div className="record-list">
                    {pagosEnAprobacionList.map(p => {
                      const solicitante = p.solicitado_por || p.registrado_por;
                      const puedeAprobar = solicitante !== usuarioLogueado;
                      return (
                        <div key={p.id} className="glass-card record-card">
                          <div>
                            <span className="code-tag tag-approval">{p.codigo_unico}</span>
                            <h4 className="record-title">{p.proveedor} - {p.producto}</h4>
                            <p className="record-meta">Solicitado por: <strong>{solicitante}</strong> | Monto: <strong style={{ color: '#ef4444' }}>S/. {p.precio_con_igv}</strong></p>
                            <ChipsEtiquetas etiquetas={p.etiquetas} />
                          </div>
                          <div className="record-actions">
                            {p.url_archivo && (
                              <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" className="link-pill">Ver Comprobante</a>
                            )}
                            <button
                              onClick={() => cambiarEstado(p.id, 'Pagado', { aprobando: true })}
                              disabled={!puedeAprobar}
                              title={puedeAprobar ? 'Aprobar y marcar como pagado' : 'No puedes aprobar tu propia solicitud'}
                              className="btn-approve"
                            >
                              {puedeAprobar ? 'Aprobar y Pagar ✅' : 'Requiere otro miembro 🔒'}
                            </button>
                            <button onClick={() => cambiarEstado(p.id, 'Por Pagar')} className="btn-muted">Cancelar solicitud</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <h3 className="section-title">⏳ Pagos Pendientes ({pagosPendientesList.length})</h3>
              {pagosPendientesList.length === 0 ? (
                <p className="glass-card empty-card">No hay pagos pendientes por realizar.</p>
              ) : (
                <div className="record-list">
                  {pagosPendientesList.map(p => (
                    <div key={p.id} className="glass-card record-card">
                      <div>
                        <span className="code-tag tag-pending">{p.codigo_unico}</span>
                        <h4 className="record-title">{p.proveedor} - {p.producto}</h4>
                        <p className="record-meta">Proyecto: <strong>{p.proyecto}</strong> | Monto: <strong style={{ color: '#f59e0b' }}>S/. {p.precio_con_igv}</strong></p>
                        <p className="record-note">Nota: {p.descripcion || 'Sin descripción'}</p>
                        <ChipsEtiquetas etiquetas={p.etiquetas} />
                      </div>
                      <div className="record-actions">
                        {p.url_archivo ? (
                          <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" className="link-pill">Ver Comprobante</a>
                        ) : (
                          <span className="missing-file">Sin archivo</span>
                        )}
                        <button onClick={() => setPagoEditando(p)} className="btn-edit">Editar</button>
                        <button onClick={() => cambiarEstado(p.id, 'Pagado')} className="btn-pay">Marcar Pagado ✅</button>
                        <button onClick={() => eliminarPago(p.id, p.codigo_unico)} className="btn-delete">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VISTA: HISTORIAL */}
          {vista === 'historial' && (
            <div>
              <div className="section-header">
                <h3 className="section-title" style={{ margin: 0 }}>📂 Historial de Pagos Realizados</h3>
                <button onClick={exportarAExcel} className="btn-export">📥 Exportar a Excel (CSV)</button>
              </div>

              <div className="glass-card filter-card">
                <div className="form-row">
                  <label>Búsqueda General</label>
                  <input type="text" placeholder="Proveedor, producto, ID..." value={filtroBusqueda} onChange={(e) => setFiltroBusqueda(e.target.value)} />
                </div>
                <div className="form-row">
                  <label>Fecha Inicio</label>
                  <input type="date" value={filtroFechaInicio} onChange={(e) => setFiltroFechaInicio(e.target.value)} />
                </div>
                <div className="form-row">
                  <label>Fecha Fin</label>
                  <input type="date" value={filtroFechaFin} onChange={(e) => setFiltroFechaFin(e.target.value)} />
                </div>
                <div className="form-row">
                  <label>Comprobante</label>
                  <select value={filtroComprobante} onChange={(e) => setFiltroComprobante(e.target.value)}>
                    <option value="todos">Todos</option>
                    <option value="conFactura">Con Factura</option>
                    <option value="sinFactura">Sin Factura</option>
                  </select>
                </div>
                <div className="form-row">
                  <label>Etiqueta</label>
                  <select value={filtroEtiqueta} onChange={(e) => setFiltroEtiqueta(e.target.value)}>
                    <option value="todas">Todas</option>
                    {ETIQUETAS_DISPONIBLES.map(tag => (
                      <option key={tag} value={tag}>#{tag}</option>
                    ))}
                  </select>
                </div>
              </div>

              {pagosFiltrados.length === 0 ? (
                <p className="glass-card empty-card">No hay pagos registrados en el historial con los filtros aplicados.</p>
              ) : (
                <div className="record-list">
                  {pagosFiltrados.map(p => (
                    <div key={p.id} className="glass-card record-card">
                      <div>
                        <div className="record-tags-row">
                          <span className="code-tag tag-paid">{p.codigo_unico}</span>
                          <span className="record-date">{p.fecha_legible}</span>
                        </div>
                        <h4 className="record-title">{p.proveedor} - {p.producto}</h4>
                        <p className="record-meta">Proyecto: <strong>{p.proyecto}</strong> | Monto: <strong style={{ color: '#22c55e' }}>S/. {p.precio_con_igv}</strong></p>
                        <p className="record-note">Registrado por: <strong>{p.registrado_por}</strong>{p.aprobado_por ? <> · Aprobado por: <strong>{p.aprobado_por}</strong></> : null}</p>
                        <ChipsEtiquetas etiquetas={p.etiquetas} />
                      </div>
                      <div className="record-actions">
                        {p.url_archivo ? (
                          <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" className="link-pill">Ver Comprobante</a>
                        ) : (
                          <button onClick={() => setPagoEditando(p)} className="btn-upload">Subir Factura 📎</button>
                        )}
                        <button onClick={() => cambiarEstado(p.id, 'Por Pagar')} className="btn-muted">Pasar a Pendiente</button>
                        <button onClick={() => eliminarPago(p.id, p.codigo_unico)} className="btn-delete">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VISTA: AUDITORÍA (Idea 5 — timeline de trazabilidad) */}
          {vista === 'auditoria' && (
            <div className="glass-card form-card">
              <h3 className="section-title">🕵️ Centro de Auditoría</h3>
              <p className="panel-note" style={{ marginBottom: '20px' }}>
                Huella digital de cada acción del equipo — quién creó, editó, solicitó, aprobó o eliminó un registro, con marca de tiempo exacta.
              </p>

              {auditoria.length === 0 ? (
                <p className="empty-hint">Aún no hay actividad registrada en esta sesión.</p>
              ) : (
                <div className="audit-timeline">
                  {auditoria.map(entry => (
                    <div key={entry.id} className="audit-item">
                      <div className="audit-marker">{iconoPorAccion(entry.accion)}</div>
                      <div className="audit-body">
                        <div className="audit-head">
                          <strong>{entry.accion}</strong>
                          <span className="audit-user">{entry.usuario}</span>
                        </div>
                        <p className="audit-detail">{entry.detalle}</p>
                        <span className="audit-time">{entry.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VISTA: CLIENTES */}
          {vista === 'clientes' && misPermisos.ver_clientes && (
            <Clientes
              onNotify={agregarNotificacion}
              onAudit={registrarAuditoria}
              puedeGestionar={!!misPermisos.gestionar_clientes}
            />
          )}

          {/* VISTA: PROVEEDORES */}
          {vista === 'proveedores' && misPermisos.ver_proveedores && (
            <Proveedores
              onNotify={agregarNotificacion}
              onAudit={registrarAuditoria}
              puedeGestionar={!!misPermisos.gestionar_proveedores}
            />
          )}

          {/* VISTA: PROYECTOS */}
          {vista === 'proyectos' && misPermisos.ver_proyectos && (
            <Proyectos
              usuario={usuarioLogueado}
              onNotify={agregarNotificacion}
              onAudit={registrarAuditoria}
              puedeGestionar={!!misPermisos.gestionar_proyectos}
            />
          )}

          {/* VISTA: COTIZACIONES */}
          {vista === 'cotizaciones' && misPermisos.ver_cotizaciones && (
            <Cotizaciones
              usuario={usuarioLogueado}
              onNotify={agregarNotificacion}
              onAudit={registrarAuditoria}
              puedeAprobar={!!misPermisos.aprobar_cotizaciones}
            />
          )}

          {/* VISTA: ROLES Y PERMISOS (solo HEAD ADMIN) */}
          {vista === 'roles' && misPermisos.gestionar_roles && (
            <GestionRoles
              usuarioActual={usuarioLogueado}
              onNotify={agregarNotificacion}
              onAudit={registrarAuditoria}
              onCambio={cargarPermisos}
            />
          )}

          {/* VISTA: ASISTENTE IA */}
          {vista === 'asistente' && (
            <div className="glass-card form-card">
              <h3 className="section-title">🤖 Asistente IA de Búsqueda Inteligente</h3>
              <p className="panel-note" style={{ marginBottom: '16px' }}>Escribe palabras clave separadas por espacio (ej. proveedor, proyecto, estado, montos, etiquetas) para buscar instantáneamente en todos los registros.</p>

              <input
                type="text"
                placeholder="Ej. Xiaomi pagado o PAG-123456..."
                value={busquedaInteligente}
                onChange={(e) => setBusquedaInteligente(e.target.value)}
                className="search-input"
              />

              <h4 className="panel-title" style={{ marginTop: '8px' }}>Resultados Encontrados ({pagosBusquedaInteligente.length})</h4>

              {pagosBusquedaInteligente.length === 0 ? (
                <p className="empty-hint">No se encontraron coincidencias para tu búsqueda.</p>
              ) : (
                <div className="record-list">
                  {pagosBusquedaInteligente.map(p => (
                    <div key={p.id} className="mini-record">
                      <div>
                        <span className={`code-tag ${p.estado === 'Pagado' ? 'tag-paid' : p.estado === 'Pendiente Aprobación' ? 'tag-approval' : 'tag-pending'}`}>
                          {p.codigo_unico} · {p.estado}
                        </span>
                        <p className="mini-record-title">{p.proveedor} - {p.producto}</p>
                        <p className="mini-record-meta">Proyecto: {p.proyecto} | S/. {p.precio_con_igv} | {p.fecha_legible}</p>
                        <ChipsEtiquetas etiquetas={p.etiquetas} />
                      </div>
                      {p.url_archivo && (
                        <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" className="link-pill link-pill-sm">Ver Factura</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* TOASTS FLOTANTES */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <span>{iconoPorTipo(t.tipo)}</span>
            <span>{t.mensaje}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;