import React, { useState, useEffect } from 'react';
import { interpretVoiceCommand } from './voice/commands';
import { answerDashboardQuestion, classifyDashboardQuestion } from './voice/metrics';
import { answerSmallTalk } from './voice/smallTalk';
import { answerRecordQuestion } from './voice/records';
import { supabase } from './supabaseClient';
import OneSignal from 'react-onesignal';
import './App.css';
import { Clientes, Proveedores, Proyectos, Cotizaciones } from './modules/BusinessModules';
import { ExecutiveDashboard } from './modules/ExecutiveDashboard';
import { OperationsCenter } from './modules/OperationsCenter';
import { GestionRoles } from './modules/RolesModule';
import { PERMISOS_VACIOS } from './permissions';
import { FestosIcon } from './FestosIcon';

/* ============================================================
   CONFIGURACIÓN GLOBAL
   ============================================================ */


// Monto (S/. con IGV) a partir del cual un pago requiere control dual
// (aprobación de un miembro distinto de quien lo registró/solicitó).
const UMBRAL_APROBACION = 500;

const ETIQUETAS_DISPONIBLES = ['Neumática', 'Automatización', 'Mantenimiento', 'Logística'];

const NOMBRES_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const obtenerFechaActual = () => new Intl.DateTimeFormat('es-PE', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
}).format(new Date());

function saludoPorHora() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function FestosWelcomeOverlay({ nombre, cargo, correo, foto, onClose }) {
  return (
    <div className="festos-welcome-overlay" role="dialog" aria-modal="true" aria-label="Bienvenida a FESTOS" onClick={onClose}>
      <div className="festos-welcome-orbit orbit-a" aria-hidden="true" />
      <div className="festos-welcome-orbit orbit-b" aria-hidden="true" />
      <div className="festos-welcome-beam" aria-hidden="true" />
      <div className="festos-welcome-card" onClick={e => e.stopPropagation()}>
        <div className="festos-welcome-shine" aria-hidden="true" />
        <div className="festos-welcome-brand">
          <img src={`${import.meta.env.BASE_URL}festoslogo-header.png`} alt="FESTOS" />
          <span>GESTIÓN EMPRESARIAL</span>
        </div>
        <div className="festos-welcome-avatar">
          {foto ? <img src={foto} alt="Perfil" /> : <FestosIcon name="UserRound" size={34} strokeWidth={1.6} />}
          <span className="festos-welcome-status" />
        </div>
        <span className="festos-welcome-greeting">{saludoPorHora()}</span>
        <h1>BIENVENID@ A FESTOS GESTIÓN</h1>
        <h2>{nombre}</h2>
        <div className="festos-welcome-role"><FestosIcon name="ShieldCheck" size={17} /> {cargo}</div>
        <div className="festos-welcome-mail"><FestosIcon name="Mail" size={15} /> {correo}</div>
        <div className="festos-welcome-progress"><span /></div>
        <small>Preparando tu espacio de trabajo seguro</small>
      </div>
    </div>
  );
}

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
        <FestosIcon name="Bell" size={19} />
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
                    <span className="notif-item-icon"><FestosIcon name={iconoPorTipo(n.tipo)} size={17} /></span>
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


const CLAVES_PERFIL = {
  nombre: 'festos_perfil_nombre_',
  foto: 'festos_perfil_foto_',
};

function clavePerfil(tipo, usuario) {
  return `${CLAVES_PERFIL[tipo]}${String(usuario || '').trim().toLowerCase()}`;
}

function obtenerFotoPerfilUsuario(usuario) {
  try {
    return localStorage.getItem(clavePerfil('foto', usuario)) || '';
  } catch (e) {
    return '';
  }
}

function cargoUsuario(usuario) {
  const cargos = {
    gonzalo: 'HEAD ADMIN',
    rodrigo: 'DESARROLLADOR SOFTWARE',
    mar: 'OPERADORA COMERCIAL',
    jesus: 'ADMIN',
  };
  return cargos[String(usuario || '').trim().toLowerCase()] || 'Usuario del sistema';
}

function iconoPorTipo(tipo) {
  switch (tipo) {
    case 'nuevo': return 'Upload';
    case 'pagado': return 'CheckCircle2';
    case 'pendiente': return 'History';
    case 'edicion': return 'Pencil';
    case 'eliminado': return 'Trash2';
    case 'aprobacion': return 'LockKeyhole';
    default: return 'Bell';
  }
}

function iconoPorAccion(accion) {
  switch (accion) {
    case 'Creación': return 'Upload';
    case 'Edición': return 'Pencil';
    case 'Eliminación': return 'Trash2';
    case 'Solicitud de Aprobación': return 'LockKeyhole';
    case 'Aprobación y Pago': return 'CheckCircle2';
    case 'Reversión a Pendiente': return 'History';
    default: return 'Pin';
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

function GlobalSearchPalette({ open, onClose, onNavigate, permisos }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    let activo = true;
    const cargar = async () => {
      setLoading(true);
      try {
        const [c, p, pr, q] = await Promise.all([
          permisos.ver_clientes ? supabase.from('clientes').select('id,nombre,ruc').limit(60) : Promise.resolve({data:[]}),
          permisos.ver_proveedores ? supabase.from('proveedores').select('id,nombre,categoria,productos').limit(60) : Promise.resolve({data:[]}),
          permisos.ver_proyectos ? supabase.from('proyectos').select('id,codigo,nombre,estado,ejecutivo').limit(80) : Promise.resolve({data:[]}),
          permisos.ver_cotizaciones ? supabase.from('cotizaciones').select('id,codigo,proyecto_nombre,estado').limit(80) : Promise.resolve({data:[]}),
        ]);
        if (!activo) return;
        const all = [
          ...(c.data || []).map(x => ({ id:`cliente-${x.id}`, view:'clientes', icon:'Users', type:'Cliente', title:x.nombre, subtitle:x.ruc || 'Cliente FESTOS' })),
          ...(p.data || []).map(x => ({ id:`proveedor-${x.id}`, view:'proveedores', icon:'Truck', type:'Proveedor', title:x.nombre, subtitle:[x.categoria,x.productos].filter(Boolean).join(' · ') || 'Proveedor FESTOS' })),
          ...(pr.data || []).map(x => ({ id:`proyecto-${x.id}`, view:'proyectos', icon:'FolderKanban', type:'Proyecto', title:x.nombre || x.codigo, subtitle:[x.codigo,x.estado,x.ejecutivo ? `Ejecutivo comercial: ${x.ejecutivo}` : ''].filter(Boolean).join(' · ') })),
          ...(q.data || []).map(x => ({ id:`cotizacion-${x.id}`, view:'cotizaciones', icon:'FileText', type:'Cotización', title:x.codigo || x.proyecto_nombre, subtitle:[x.proyecto_nombre,x.estado].filter(Boolean).join(' · ') })),
        ];
        setRecords(all);
      } catch (err) {
        console.error('Búsqueda global:', err);
        setRecords([]);
      } finally {
        if (activo) setLoading(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const cerrar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [open, onClose]);

  if (!open) return null;
  const q = query.trim().toLowerCase();
  const filtered = records.filter(item => !q || `${item.type} ${item.title} ${item.subtitle}`.toLowerCase().includes(q)).slice(0, 12);

  return <div className="command-overlay" onMouseDown={onClose}>
    <div className="command-palette" onMouseDown={e => e.stopPropagation()}>
      <div className="command-search-row">
        <FestosIcon name="Search" size={19} />
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente, proyecto, cotización o proveedor…" />
        <kbd>ESC</kbd>
      </div>
      <div className="command-meta"><span>BÚSQUEDA GLOBAL FESTOS</span><small>Ctrl + K</small></div>
      <div className="command-quick-actions" aria-label="Accesos rápidos">
        {[['dashboard','House','Inicio'],['analisis','LayoutDashboard','Dashboard'],['operaciones','CalendarDays','Centro de trabajo'],...(permisos.gestionar_proyectos && permisos.ver_proyectos ? [['nuevo-proyecto','Plus','Nuevo proyecto']] : []),...(permisos.gestionar_cotizaciones && permisos.ver_cotizaciones ? [['nueva-cotizacion','Plus','Nueva cotización']] : [])].filter(x => !q || x[2].toLowerCase().includes(q)).map(([id,icon,label]) => <button type="button" key={id} onClick={() => { onNavigate(id); onClose(); }}><FestosIcon name={icon} size={16}/>{label}</button>)}
      </div>
      <div className="command-results">
        {loading ? <div className="command-loading"><i/><i/><i/><i/></div> : filtered.length ? filtered.map(item =>
          <button key={item.id} type="button" className="command-result" onClick={() => { onNavigate(item.view); onClose(); }}>
            <span className="command-result-icon"><FestosIcon name={item.icon} size={18} /></span>
            <span><strong>{item.title}</strong><small>{item.subtitle || item.type}</small></span>
            <em>{item.type}</em>
            <b><FestosIcon name="ArrowRight" size={15} /></b>
          </button>
        ) : <div className="command-empty"><span><FestosIcon name="Search" size={22} /></span><strong>Sin coincidencias</strong><small>Prueba con otro nombre, código o palabra.</small></div>}
      </div>
      <div className="command-footer"><span>↑↓ Explorar</span><span>↵ Abrir módulo</span><span>ESC Cerrar</span></div>
    </div>
  </div>;
}

/* ============================================================
   APP PRINCIPAL
   ============================================================ */

function App() {
  // --- ESTADOS DE AUTENTICACIÓN (Supabase Auth · V29 Security Lite) ---
  const [usuarioLogueado, setUsuarioLogueado] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [perfilServidor, setPerfilServidor] = useState(null);
  const [inputUser, setInputUser] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  // Perfil visual local: nombre/foto se guardan por dispositivo. La contraseña
  // se actualiza directamente en Supabase Auth y FESTOS nunca la almacena.
  const [perfilNombre, setPerfilNombre] = useState('');
  const [perfilFoto, setPerfilFoto] = useState('');
  const [perfilMenuAbierto, setPerfilMenuAbierto] = useState(false);
  const [perfilModalAbierto, setPerfilModalAbierto] = useState(false);
  const [perfilNombreEdit, setPerfilNombreEdit] = useState('');
  const [perfilFotoEdit, setPerfilFotoEdit] = useState('');
  const [perfilPassword, setPerfilPassword] = useState('');
  const [perfilPasswordConfirm, setPerfilPasswordConfirm] = useState('');
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [mostrarBienvenida, setMostrarBienvenida] = useState(false);

  const cargarPerfilAutenticado = async (authUser) => {
    if (!authUser?.id) {
      setUsuarioLogueado('');
      setAuthEmail('');
      setPerfilServidor(null);
      return false;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('user_id,email,usuario,nombre,rol_label,activo,permisos')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (error || !data) {
      console.error('Perfil FESTOS no disponible:', error);
      await supabase.auth.signOut();
      setUsuarioLogueado('');
      setAuthEmail('');
      setPerfilServidor(null);
      setErrorLogin('Tu cuenta existe en Supabase Auth, pero aún no tiene un perfil FESTOS habilitado. Contacta al HEAD ADMIN.');
      return false;
    }

    if (!data.activo) {
      await supabase.auth.signOut();
      setUsuarioLogueado('');
      setAuthEmail('');
      setPerfilServidor(null);
      setErrorLogin('Tu acceso a FESTOS está desactivado. Contacta al HEAD ADMIN.');
      return false;
    }

    setPerfilServidor(data);
    setUsuarioLogueado(String(data.usuario || '').trim().toLowerCase());
    setAuthEmail(data.email || authUser.email || '');
    return true;
  };

  useEffect(() => {
    let activo = true;
    try { localStorage.removeItem('festos_sesion_usuario'); } catch (e) { /* legacy cleanup */ }

    const sincronizar = async (session) => {
      if (!activo) return;
      try {
        if (session?.user) await cargarPerfilAutenticado(session.user);
        else {
          setUsuarioLogueado('');
          setAuthEmail('');
          setPerfilServidor(null);
        }
      } finally {
        if (activo) setAuthReady(true);
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('No se pudo recuperar la sesión de Supabase Auth:', error);
      sincronizar(data?.session || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => sincronizar(session), 0);
    });

    return () => {
      activo = false;
      listener?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada usuario conserva su propia foto y nombre visible. Al cambiar de sesión
  // se recarga el perfil correspondiente sin compartir datos entre usuarios.
  useEffect(() => {
    if (!usuarioLogueado) {
      setPerfilNombre('');
      setPerfilFoto('');
      return;
    }
    const nombreGuardado = localStorage.getItem(clavePerfil('nombre', usuarioLogueado));
    const fotoGuardada = localStorage.getItem(clavePerfil('foto', usuarioLogueado));

    // Compatibilidad con la V18/V19: migra una sola vez el perfil antiguo
    // al perfil individual del usuario que está entrando.
    const nombreLegacy = localStorage.getItem('festos_perfil_nombre');
    const fotoLegacy = localStorage.getItem('festos_perfil_foto');
    const esGonzalo = String(usuarioLogueado).trim().toLowerCase() === 'gonzalo';
    if (esGonzalo && !nombreGuardado && nombreLegacy) localStorage.setItem(clavePerfil('nombre', usuarioLogueado), nombreLegacy);
    if (esGonzalo && !fotoGuardada && fotoLegacy) localStorage.setItem(clavePerfil('foto', usuarioLogueado), fotoLegacy);

    setPerfilNombre(nombreGuardado || perfilServidor?.nombre || (esGonzalo ? nombreLegacy : '') || usuarioLogueado);
    setPerfilFoto(fotoGuardada || (esGonzalo ? fotoLegacy : '') || '');
  }, [usuarioLogueado, perfilServidor?.nombre]);

  // Bienvenida animada: se muestra una sola vez por sesión autenticada.
  // Funciona tanto al iniciar sesión como al abrir FESTOS con una sesión vigente.
  useEffect(() => {
    if (!authReady || !usuarioLogueado || !perfilServidor?.activo) return undefined;
    setMostrarBienvenida(true);
    const timer = window.setTimeout(() => setMostrarBienvenida(false), 5000);
    return () => window.clearTimeout(timer);
  }, [authReady, usuarioLogueado, perfilServidor?.activo]);

  // Tema visual persistente. V27 permite alternar entre claro y oscuro
  // sin cambiar la identidad verde petróleo de FESTOS.
  const [modoOscuro, setModoOscuro] = useState(() => {
    try { return localStorage.getItem('festos_tema') === 'dark'; } catch (e) { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('festos_tema', modoOscuro ? 'dark' : 'light'); } catch (e) { /* no-op */ }
  }, [modoOscuro]);

  const [busquedaGlobalAbierta, setBusquedaGlobalAbierta] = useState(false);
  const [enLinea, setEnLinea] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const abrir = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setBusquedaGlobalAbierta(true);
      }
    };
    window.addEventListener('keydown', abrir);
    return () => window.removeEventListener('keydown', abrir);
  }, []);

  useEffect(() => {
    const online = () => setEnLinea(true);
    const offline = () => setEnLinea(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);

  // --- SIDEBAR (única navegación de la app) ---
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(false);
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

  // Inicio de sesión por correo + contraseña con Supabase Auth.
  const [verificandoLogin, setVerificandoLogin] = useState(false);

  const manejarLogin = async (e) => {
    e.preventDefault();
    setErrorLogin('');
    const email = inputUser.trim().toLowerCase();
    const password = inputPass;
    if (!email || !password) return;

    setVerificandoLogin(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const ok = await cargarPerfilAutenticado(data.user);
      if (!ok) {
        await supabase.auth.signOut();
        return;
      }
      setInputUser('');
      setInputPass('');
    } catch (err) {
      console.error('No se pudo iniciar sesión con Supabase Auth:', err);
      setErrorLogin('Correo o contraseña incorrectos, o la cuenta no está habilitada para FESTOS.');
    } finally {
      setVerificandoLogin(false);
    }
  };

  const abrirPerfil = () => {
    setPerfilNombreEdit(perfilNombre || usuarioLogueado);
    setPerfilFotoEdit(perfilFoto || '');
    setPerfilPassword('');
    setPerfilPasswordConfirm('');
    setPerfilMenuAbierto(false);
    setPerfilModalAbierto(true);
  };

  const seleccionarFotoPerfil = (e) => {
    const archivoFoto = e.target.files?.[0];
    if (!archivoFoto) return;
    if (!archivoFoto.type.startsWith('image/')) return alert('Selecciona una imagen válida.');
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 420;
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * escala));
        canvas.height = Math.max(1, Math.round(img.height * escala));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPerfilFotoEdit(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivoFoto);
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();
    const nombre = perfilNombreEdit.trim();
    if (!nombre) return alert('El nombre es obligatorio.');
    if (perfilPassword && perfilPassword.length < 8) return alert('La nueva contraseña debe tener al menos 8 caracteres.');
    if (perfilPassword !== perfilPasswordConfirm) return alert('Las contraseñas no coinciden.');
    setGuardandoPerfil(true);
    try {
      localStorage.setItem(clavePerfil('nombre', usuarioLogueado), nombre);
      localStorage.setItem(clavePerfil('foto', usuarioLogueado), perfilFotoEdit || '');
      setPerfilNombre(nombre);
      setPerfilFoto(perfilFotoEdit || '');
      if (perfilPassword) {
        const { error } = await supabase.auth.updateUser({ password: perfilPassword });
        if (error) throw error;
      }
      setPerfilModalAbierto(false);
      agregarNotificacion('Perfil actualizado correctamente.', 'edicion');
    } catch (err) {
      console.error(err);
      alert(`No se pudo actualizar el perfil. ${err?.message || ''}`);
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const cerrarSesion = async () => {
    setPerfilMenuAbierto(false);
    setMostrarBienvenida(false);
    try { await supabase.auth.signOut(); } catch (err) { console.error('Error cerrando sesión:', err); }
    setPerfilServidor(null);
    setAuthEmail('');
    setUsuarioLogueado('');
  };

  // --- ROLES Y PERMISOS (servidor) ---
  const cargarPermisos = async () => {
    if (!usuarioLogueado) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,email,usuario,nombre,rol_label,activo,permisos')
        .eq('usuario', usuarioLogueado)
        .maybeSingle();
      if (error) throw error;
      if (data?.activo) setPerfilServidor(data);
    } catch (err) {
      console.warn('No se pudo refrescar el perfil/permisos desde Supabase.', err);
    }
  };

  const misPermisos = perfilServidor
    ? { ...PERMISOS_VACIOS, ...(perfilServidor.permisos || {}), rol_label: perfilServidor.rol_label || 'Usuario' }
    : PERMISOS_VACIOS;

  const [vista, setVista] = useState('dashboard');
  const [nuevoProyectoSolicitado, setNuevoProyectoSolicitado] = useState(false);
  const [nuevaCotizacionSolicitada, setNuevaCotizacionSolicitada] = useState(false);
  const [voiceCommand, setVoiceCommand] = useState(null);
  const [proyectosDesdeDashboard, setProyectosDesdeDashboard] = useState(null);
  const puedeRegistrarCliente = !!misPermisos.gestionar_clientes && ['HEAD ADMIN', 'ADMIN', 'DESARROLLADOR SOFTWARE'].includes(String(perfilServidor?.rol_label || '').trim().toUpperCase());
  const abrirProyectosFiltrados = filtro => {
    if (!misPermisos.ver_proyectos) return;
    setProyectosDesdeDashboard({ ...filtro, id: Date.now() });
    setVoiceCommand(null);
    setVista('proyectos');
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
  };
  const [voiceFeedback, setVoiceFeedback] = useState(null);
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
    if (window.festosDesktop?.isDesktop || window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
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
    if (usuarioLogueado) cargarPermisos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [vista, usuarioLogueado, perfilServidor]);

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
    { id: 'dashboard', icono: 'House', label: 'Inicio' },
    { id: 'analisis', icono: 'LayoutDashboard', label: 'Dashboard' },
    { id: 'operaciones', icono: 'CalendarDays', label: 'Centro de trabajo' },
    // Módulos temporalmente ocultos del menú lateral.
    // Su lógica permanece intacta para poder reactivarlos más adelante:
    // Subir Pago · Por Pagar · Historial · Auditoría · Asistente IA
    ...(misPermisos.ver_clientes ? [{ id: 'clientes', icono: 'Users', label: 'Clientes' }] : []),
    ...(misPermisos.ver_proveedores ? [{ id: 'proveedores', icono: 'Truck', label: 'Proveedores' }] : []),
    ...(misPermisos.ver_proyectos ? [{ id: 'proyectos', icono: 'FolderKanban', label: 'Proyectos' }] : []),
    ...(misPermisos.ver_cotizaciones ? [{ id: 'cotizaciones', icono: 'FileText', label: 'Cotizaciones' }] : []),
    ...(misPermisos.gestionar_roles ? [{ id: 'roles', icono: 'ShieldCheck', label: 'Roles y Permisos' }] : []),
  ];

  const irAVista = (id) => {
    // Una entrada manual a Proyectos no conserva filtros de un salto anterior desde Dashboard.
    if (id === 'proyectos') setProyectosDesdeDashboard(null);
    // Evita reabrir un dictado anterior al volver manualmente a otro modulo.
    const targetKind = id === 'proyectos' || id === 'nuevo-proyecto' ? 'project' : id === 'cotizaciones' || id === 'nueva-cotizacion' ? 'quote' : null;
    setVoiceCommand(old => old?.kind === targetKind ? old : null);
    if (id === 'nuevo-proyecto') {
      if (!misPermisos.gestionar_proyectos || !misPermisos.ver_proyectos) return;
      setNuevoProyectoSolicitado(true);
      id = 'proyectos';
    } else if (id === 'nueva-cotizacion') {
      if (!misPermisos.gestionar_cotizaciones || !misPermisos.ver_cotizaciones) return;
      setNuevaCotizacionSolicitada(true);
      id = 'cotizaciones';
    }
    setVista(id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const feedbackVoz = text => { setVoiceFeedback({ text, id: Date.now() }); return text; };
  const ejecutarOrdenVoz = async (utterance) => {
    const social = answerSmallTalk(utterance, perfilNombre || perfilServidor?.nombre || usuarioLogueado);
    if (social) return feedbackVoz(social);
    const parsed = interpretVoiceCommand(utterance, vista === 'cotizaciones' ? 'quote' : vista === 'proyectos' ? 'project' : '');
    // Consultas concretas de registros tienen prioridad sobre agregados de Dashboard.
    // Sin SQL libre, sin permisos de administración ni escrituras por voz.
    if (parsed.action !== 'navigate' && parsed.action !== 'confirm-required'
      && !/^\s*(?:crea|crear|creame|nueva?|registra|prepara)\b/i.test(utterance)) {
      try {
        const recordAnswer = await answerRecordQuestion(utterance, misPermisos);
        if (recordAnswer) return feedbackVoz(recordAnswer);
      } catch (error) { return feedbackVoz(`No pude consultar el registro: ${error.message}`); }
    }
    // La navegación explícita tiene prioridad frente a las preguntas numéricas.
    // Todos los cálculos se ejecutan con la sesión y RLS de este usuario.
    if (parsed.action !== 'navigate' && parsed.action !== 'draft' && parsed.action !== 'confirm-required'
      && classifyDashboardQuestion(utterance)) {
      try { return feedbackVoz(await answerDashboardQuestion(utterance, misPermisos)); }
      catch (error) { return feedbackVoz(`No pude consultar el Dashboard en Supabase: ${error.message}`); }
    }
    if (parsed.action === 'confirm-required') {
      return feedbackVoz('Por seguridad, guarda, aprueba o elimina registros desde sus botones después de revisar los datos.');
    }
    if (parsed.action === 'navigate') {
      const allowed = {
        dashboard: true, analisis: true, analisis_ventas: true, operaciones: true,
        clientes: misPermisos.ver_clientes, proveedores: misPermisos.ver_proveedores,
        proyectos: misPermisos.ver_proyectos, cotizaciones: misPermisos.ver_cotizaciones,
        roles: misPermisos.gestionar_roles, perfil: true, notificaciones: true,
      };
      if (!Object.prototype.hasOwnProperty.call(allowed, parsed.target) || !allowed[parsed.target]) return feedbackVoz('No tienes permiso para abrir ese apartado.');
      if (parsed.target === 'perfil') { setPerfilModalAbierto(true); return feedbackVoz('He abierto tu perfil.'); }
      if (parsed.target === 'notificaciones') { setPanelNotifAbierto(true); return feedbackVoz('He abierto tus notificaciones.'); }
      irAVista(parsed.target);
      return feedbackVoz(`He abierto ${parsed.target === 'dashboard' ? 'Inicio' : parsed.target === 'analisis' ? 'Dashboard proyectos' : parsed.target === 'analisis_ventas' ? 'Dashboard ventas' : parsed.target === 'operaciones' ? 'Centro de trabajo' : parsed.target}.`);
    }
    if (parsed.action === 'draft') {
      const permission = parsed.kind === 'quote'
        ? !!(misPermisos.ver_cotizaciones && misPermisos.gestionar_cotizaciones)
        : !!(misPermisos.ver_proyectos && misPermisos.gestionar_proyectos);
      if (!permission) return feedbackVoz('Tu cuenta no tiene permiso para crear o editar este tipo de registro.');
      setVoiceCommand({ ...parsed, id: Date.now() + Math.random() });
      // El comando de voz abre y reinicia el formulario por si mismo.
      // Evita dos efectos de creación simultáneos (React StrictMode).
      irAVista(parsed.kind === 'quote' ? 'cotizaciones' : 'proyectos');
      return feedbackVoz(`${parsed.kind === 'quote' ? 'Cotización' : 'Proyecto'} ${parsed.startNew ? 'nuevo' : 'actualizado'} en pantalla. Revisa los campos y sigue dictando; no se ha guardado nada.`);
    }
    return feedbackVoz('No entendí bien esa frase. Puedes decir: hola, dime la hora, abre Cotizaciones, crea un proyecto, dame un resumen del Dashboard o dime la utilidad proyectada.');
  };

  /* -------------------- PANTALLA DE LOGIN -------------------- */
  if (!authReady) {
    return <div className="login-screen"><div className="login-center"><div className="login-card"><div className="login-brand"><div className="login-brand-logo"><img src={`${import.meta.env.BASE_URL}festoslogo-header.png`} alt="Festos" className="login-brand-img" /></div><div className="login-brand-copy"><strong>FESTOS GESTIÓN EMPRESARIAL</strong><span>VALIDANDO SESIÓN SEGURA</span></div></div></div></div></div>;
  }

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
              <div className="login-brand-logo">
                <img src={`${import.meta.env.BASE_URL}festoslogo-header.png`} alt="Festos" className="login-brand-img" />
              </div>
              <div className="login-brand-copy">
                <strong>FESTOS GESTIÓN EMPRESARIAL</strong>
                <span>OPERACIONES Y ADMINISTRACIÓN</span>
              </div>
            </div>

            {errorLogin && <div className="login-error">{errorLogin}</div>}

            <div className="login-field">
              <label>Correo corporativo</label>
              <input
                type="email"
                placeholder="nombre@festosmkt.com"
                value={inputUser}
                autoComplete="username"
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
                autoComplete="current-password"
                onChange={(e) => setInputPass(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-submit" disabled={verificandoLogin}>
              {verificandoLogin ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <p className="login-footnote">FESTOS · Gestión operativa, comercial y administrativa</p>
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

      <GlobalSearchPalette
        open={busquedaGlobalAbierta}
        onClose={() => setBusquedaGlobalAbierta(false)}
        onNavigate={irAVista}
        permisos={misPermisos}
      />

      {mostrarBienvenida && (
        <FestosWelcomeOverlay
          nombre={(perfilNombre || perfilServidor?.nombre || usuarioLogueado).toUpperCase()}
          cargo={perfilServidor?.rol_label || cargoUsuario(usuarioLogueado)}
          correo={authEmail}
          foto={perfilFoto}
          onClose={() => setMostrarBienvenida(false)}
        />
      )}

      {/* FESTOS Voz temporalmente oculto: sin escucha ni indicadores. Código conservado para reactivación futura. */}

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src={`${import.meta.env.BASE_URL}festoslogo-Photoroom.png`} alt="Festos" />
        </div>

        <nav className="sidebar-nav">
          {itemsNav.map(item => item.id === 'analisis' ? (
            <div className="sidebar-dashboard-group" key="analisis">
              <button type="button" className={`sidebar-item sidebar-dashboard-toggle ${['analisis','analisis_ventas'].includes(vista) ? 'active' : ''}`} aria-expanded={dashboardMenuOpen} aria-controls="festos-dashboard-submenu" onClick={() => setDashboardMenuOpen(open => !open)}>
                <span className="sidebar-item-icon"><FestosIcon name="LayoutDashboard" size={20} /></span>
                <span>Dashboard</span>
                <span className={`sidebar-chevron ${dashboardMenuOpen ? 'open' : ''}`}><FestosIcon name="ChevronDown" size={17} /></span>
              </button>
              {dashboardMenuOpen && <div id="festos-dashboard-submenu" className="sidebar-submenu">
                <button type="button" className={`sidebar-item sidebar-subitem ${vista === 'analisis' ? 'active' : ''}`} onClick={() => irAVista('analisis')}><FestosIcon name="FolderKanban" size={17} /> Proyectos</button>
                <button type="button" className={`sidebar-item sidebar-subitem ${vista === 'analisis_ventas' ? 'active' : ''}`} onClick={() => irAVista('analisis_ventas')}><FestosIcon name="ChartNoAxesColumnIncreasing" size={17} /> Ventas</button>
              </div>}
            </div>
          ) : (
            <button key={item.id} className={`sidebar-item ${vista === item.id ? 'active' : ''}`} onClick={() => irAVista(item.id)}>
              <span className="sidebar-item-icon"><FestosIcon name={item.icono} size={20} /></span>
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
            <div className="topbar-brand">
              <div className="topbar-brand-copy">
                <strong>FESTOS GESTIÓN EMPRESARIAL</strong>
                <span>OPERACIONES Y ADMINISTRACIÓN</span>
              </div>
            </div>
          </div>

          <div className="topbar-right">
            <button type="button" className="global-search-trigger" onClick={() => setBusquedaGlobalAbierta(true)} title="Búsqueda global (Ctrl + K)">
              <FestosIcon name="Search" size={17} /><strong>Buscar</strong><kbd>Ctrl K</kbd>
            </button>

            <span className={`connection-chip ${enLinea ? 'online' : 'offline'}`} title={enLinea ? 'Hay conectividad de red. La confirmación de guardado depende de Supabase.' : 'Sin conexión a Internet'}>
              <i /> {enLinea ? 'Red disponible' : 'Sin conexión'}
            </span>

            <button type="button" className="theme-toggle" onClick={() => setModoOscuro(v => !v)} title={modoOscuro ? 'Usar tema claro' : 'Usar tema oscuro'} aria-label="Cambiar tema">
              <span><FestosIcon name={modoOscuro ? 'Sun' : 'Moon'} size={18} /></span>
            </button>

            <CentroNotificaciones
              notificaciones={notificaciones}
              panelAbierto={panelNotifAbierto}
              setPanelAbierto={setPanelNotifAbierto}
              marcarTodasLeidas={marcarTodasLeidas}
            />

            <div className="topbar-welcome">
              <strong>Bienvenido, {perfilNombre || usuarioLogueado}</strong>
              <span>{obtenerFechaActual()}</span>
            </div>

            <div className="profile-menu-wrap">
              <button type="button" className="user-profile-pill" onClick={() => setPerfilMenuAbierto(v => !v)} aria-label="Abrir menú de perfil">
                <span className="user-avatar">{perfilFoto ? <img src={perfilFoto} alt="Perfil" /> : <FestosIcon name="UserRound" size={19} />}</span>
                <div className="user-profile-text"><strong>{perfilNombre || usuarioLogueado}</strong><span>{(perfilServidor?.rol_label || cargoUsuario(usuarioLogueado))}</span></div>
                <span className="profile-more-dots"><FestosIcon name="MoreVertical" size={18} /></span>
              </button>
              {perfilMenuAbierto && (
                <>
                  <div className="profile-menu-backdrop" onClick={() => setPerfilMenuAbierto(false)} />
                  <div className="profile-menu">
                    <div className="profile-menu-user"><span className="profile-menu-avatar">{perfilFoto ? <img src={perfilFoto} alt="Perfil" /> : <FestosIcon name="UserRound" size={19} />}</span><div><strong>{perfilNombre || usuarioLogueado}</strong><small>{(perfilServidor?.rol_label || cargoUsuario(usuarioLogueado))}</small></div></div>
                    <button type="button" onClick={abrirPerfil}><FestosIcon name="UserRound" size={17} /> <span>Ver perfil</span></button>
                    <button type="button" onClick={abrirPerfil}><FestosIcon name="Settings" size={17} /> <span>Preferencias de cuenta</span></button>
                    <div className="profile-menu-separator" />
                    <button type="button" className="danger" onClick={cerrarSesion}><FestosIcon name="LogOut" size={17} /> <span>Cerrar sesión</span></button>
                  </div>
                </>
              )}
            </div>

          </div>
        </header>

        <div className="content-container">

          {perfilModalAbierto && (
            <div className="modal-overlay" onClick={() => !guardandoPerfil && setPerfilModalAbierto(false)}>
              <form className="glass-card modal-card profile-modal" onSubmit={guardarPerfil} onClick={e => e.stopPropagation()}>
                <div className="modal-head">
                  <div><h4 className="panel-title icon-heading"><FestosIcon name="UserRound" size={18} /> Mi perfil</h4><p className="panel-note">Personaliza cómo apareces dentro de FESTOS.</p></div>
                  <button type="button" className="modal-close-btn" onClick={() => setPerfilModalAbierto(false)}>×</button>
                </div>
                <div className="profile-hero">
                  <div className="profile-avatar-large">{perfilFotoEdit ? <img src={perfilFotoEdit} alt="Foto de perfil" /> : <FestosIcon name="UserRound" size={34} />}</div>
                  <div><strong>{perfilNombre || usuarioLogueado}</strong><span>{(perfilServidor?.rol_label || cargoUsuario(usuarioLogueado))}</span><label className="profile-upload-btn"><FestosIcon name="Camera" size={16} /> Cambiar foto<input type="file" accept="image/*" onChange={seleccionarFotoPerfil} /></label></div>
                </div>
                <div className="profile-section-title">Información personal</div>
                <div className="form-row"><label>Nombre visible</label><input value={perfilNombreEdit} onChange={e => setPerfilNombreEdit(e.target.value)} placeholder="Tu nombre" /></div>
                <div className="profile-info-grid"><div><span>Correo de acceso</span><strong>{authEmail || '—'}</strong></div><div><span>Usuario interno</span><strong>{usuarioLogueado}</strong></div><div><span>Cargo</span><strong>{(perfilServidor?.rol_label || cargoUsuario(usuarioLogueado))}</strong></div></div>
                <div className="profile-section-title">Seguridad</div>
                <div className="form-grid-2"><div className="form-row"><label>Nueva contraseña</label><input type="password" value={perfilPassword} onChange={e => setPerfilPassword(e.target.value)} placeholder="Mínimo 8 caracteres" /></div><div className="form-row"><label>Confirmar contraseña</label><input type="password" value={perfilPasswordConfirm} onChange={e => setPerfilPasswordConfirm(e.target.value)} placeholder="Repite la contraseña" /></div></div>
                <div className="profile-tip"><FestosIcon name="LockKeyhole" size={16} /> Puedes cambiar tu contraseña cuando quieras. Tu sesión actual se mantiene activa.</div>
                <div className="modal-actions"><button className="btn-primary" disabled={guardandoPerfil}>{guardandoPerfil ? 'Guardando...' : 'Guardar perfil'}</button><button type="button" className="btn-secondary" onClick={() => setPerfilModalAbierto(false)}>Cancelar</button></div>
              </form>
            </div>
          )}

          {/* MODAL / FORMULARIO FLOTANTE DE EDICIÓN Y SUBIDA DE COMPROBANTE */}
          {pagoEditando && (
            <div className="modal-overlay">
              <form onSubmit={guardarEdicionConArchivo} className="glass-card modal-card">
                <h3 className="section-title"><FestosIcon name="Pencil" size={21} /> Editar Registro y Comprobante</h3>

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
                  <label>Comprobante Actual: {pagoEditando.url_archivo ? 'Subido' : 'Sin comprobante'}</label>
                  <input type="file" onChange={(e) => setArchivoNuevo(e.target.files[0])} />
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setPagoEditando(null)} className="btn-secondary">Cancelar</button>
                  <button type="submit" disabled={cargando} className="btn-primary">{cargando ? 'Guardando...' : 'Guardar Cambios'}</button>
                </div>
              </form>
            </div>
          )}

          {/* VISTA: INICIO */}
          {vista === 'operaciones' && (
            <OperationsCenter usuario={usuarioLogueado} permisos={misPermisos} onNavigate={irAVista} onNotify={agregarNotificacion} onAudit={registrarAuditoria} />
          )}

          {(vista === 'analisis' || vista === 'analisis_ventas') && (
            <ExecutiveDashboard tipo={vista === 'analisis_ventas' ? 'ventas' : 'proyectos'} usuario={usuarioLogueado} onOpenAI={() => setVista('asistente')} onOpenProjects={abrirProyectosFiltrados} />
          )}

          {vista === 'dashboard' && (
            <div className="inicio-page">
              <section className="welcome-home-card">
                <div className="welcome-home-logo">
                  <img src={`${import.meta.env.BASE_URL}festoslogo-Photoroom.png`} alt="FESTOS" />
                </div>
                <div className="welcome-home-content">
                  <span className="welcome-home-eyebrow">FESTOS GESTIÓN EMPRESARIAL</span>
                  <h1>Bienvenido, {perfilNombre || usuarioLogueado}</h1>
                  <p>Una plataforma centralizada para gestionar las operaciones, el control administrativo y la información comercial de FESTOS desde un solo lugar.</p>
                  <div className="welcome-benefits">
                    <div><strong><FestosIcon name="LayoutDashboard" size={18} /> Control</strong><span>Visualiza pagos, pendientes y movimientos.</span></div>
                    <div><strong><FestosIcon name="Users" size={18} /> Gestión</strong><span>Administra clientes, proveedores y proyectos.</span></div>
                    <div><strong><FestosIcon name="FileText" size={18} /> Cotizaciones</strong><span>Organiza el proceso comercial y sus estados.</span></div>
                    <div><strong><FestosIcon name="History" size={18} /> Trazabilidad</strong><span>Consulta auditoría, permisos y actividad.</span></div>
                  </div>
                </div>
              </section>

              <section className="inicio-manual-card">
                <div className="inicio-manual-icon" aria-hidden="true"><FestosIcon name="BookOpen" size={28} /></div>
                <div className="inicio-manual-content">
                  <span className="inicio-section-kicker">DOCUMENTACIÓN FESTOS</span>
                  <h2>Manual de Usuario</h2>
                  <p>Consulta la guía oficial de FESTOS Gestión Empresarial para conocer el funcionamiento de cada módulo, los flujos de trabajo y las principales operaciones del sistema.</p>
                  <div className="inicio-manual-meta">
                    <span>V21 · Septiembre 2026</span>
                    <span>Incluye todos los módulos excepto Subir Pago</span>
                  </div>
                </div>
                <div className="inicio-manual-actions">
                  <a className="inicio-manual-btn primary" href={`${import.meta.env.BASE_URL}Manual_Usuario_FESTOS_V21.pdf`} target="_blank" rel="noopener noreferrer">
                    <FestosIcon name="ExternalLink" size={16} /> Abrir manual
                  </a>
                  <a className="inicio-manual-btn secondary" href={`${import.meta.env.BASE_URL}Manual_Usuario_FESTOS_V21.pdf`} download="Manual_Usuario_FESTOS_V21.pdf">
                    <FestosIcon name="Download" size={16} /> Descargar PDF
                  </a>
                </div>
              </section>

              <section className="company-summary-card">
                <div className="company-summary-heading">
                  <div>
                    <span className="welcome-home-eyebrow">NUESTRA ORGANIZACIÓN</span>
                    <h2>Equipo FESTOS</h2>
                    <p>Personas y responsabilidades que forman parte de la operación de FESTOS.</p>
                  </div>
                  <div className="company-summary-badge"><FestosIcon name="Building2" size={16} /> ESTRUCTURA INTERNA</div>
                </div>

                <div className="org-flow" aria-label="Estructura del equipo FESTOS">
                  <div className="org-node org-node-main">
                    <div className="org-avatar">{obtenerFotoPerfilUsuario('gonzalo') ? <img src={obtenerFotoPerfilUsuario('gonzalo')} alt="Gonzalo" /> : 'G'}</div>
                    <div className="org-node-name">GONZALO</div>
                    <div className="org-node-role">HEAD ADMIN</div>
                    <span className="org-node-caption">Dirección y administración</span>
                  </div>

                  <div className="org-flow-line" aria-hidden="true"><span></span><span></span><span></span></div>

                  <div className="org-team-grid">
                    <div className="org-node">
                      <div className="org-avatar">{obtenerFotoPerfilUsuario('jesus') ? <img src={obtenerFotoPerfilUsuario('jesus')} alt="Jesus" /> : 'J'}</div>
                      <div className="org-node-name">JESUS</div>
                      <div className="org-node-role">ADMIN</div>
                      <span className="org-node-caption">Administración</span>
                    </div>
                    <div className="org-node">
                      <div className="org-avatar">{obtenerFotoPerfilUsuario('mar') ? <img src={obtenerFotoPerfilUsuario('mar')} alt="Mar" /> : 'M'}</div>
                      <div className="org-node-name">MAR</div>
                      <div className="org-node-role">OPERADORA COMERCIAL</div>
                      <span className="org-node-caption">Operaciones comerciales</span>
                    </div>
                    <div className="org-node">
                      <div className="org-avatar">{obtenerFotoPerfilUsuario('rodrigo') ? <img src={obtenerFotoPerfilUsuario('rodrigo')} alt="Rodrigo" /> : 'R'}</div>
                      <div className="org-node-name">RODRIGO</div>
                      <div className="org-node-role">DESARROLLADOR SOFTWARE</div>
                      <span className="org-node-caption">Tecnología y software</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="inicio-info-grid">
                <article className="inicio-info-card inicio-about-card">
                  <span className="inicio-section-kicker">CONTROL FESTOS</span>
                  <h2>¿Qué es Control Festos?</h2>
                  <p>Es el centro de gestión de FESTOS: reúne en un solo lugar la operación comercial, administrativa y de proyectos para trabajar con información organizada y trazable.</p>
                  <div className="inicio-about-points">
                    <span><FestosIcon name="Check" size={15} /> Información centralizada</span>
                    <span><FestosIcon name="Check" size={15} /> Procesos conectados</span>
                    <span><FestosIcon name="Check" size={15} /> Trazabilidad de actividad</span>
                  </div>
                </article>

                <article className="inicio-info-card">
                  <span className="inicio-section-kicker">PROPÓSITO</span>
                  <h2>Una sola plataforma</h2>
                  <p>La idea es que cada área pueda consultar y actualizar la información que necesita sin perder el contexto del proceso.</p>
                  <div className="inicio-mini-stat-row">
                    <div><strong>01</strong><span>Orden</span></div>
                    <div><strong>02</strong><span>Control</span></div>
                    <div><strong>03</strong><span>Trazabilidad</span></div>
                  </div>
                </article>
              </section>

              <section className="inicio-modules-card">
                <div className="inicio-section-heading">
                  <div>
                    <span className="inicio-section-kicker">CENTRO DE OPERACIONES</span>
                    <h2>Áreas del sistema</h2>
                    <p>Los principales módulos que forman parte de Control Festos.</p>
                  </div>
                </div>
                <div className="inicio-modules-grid">
                  <div className="inicio-module-item"><span><FestosIcon name="CreditCard" size={21} /></span><div><strong>Pagos</strong><small>Control de facturas, comprobantes y estados.</small></div></div>
                  <div className="inicio-module-item"><span><FestosIcon name="Users" size={21} /></span><div><strong>Clientes</strong><small>Directorio comercial y contactos.</small></div></div>
                  <div className="inicio-module-item"><span><FestosIcon name="Truck" size={21} /></span><div><strong>Proveedores</strong><small>Servicios, categorías y condiciones de pago.</small></div></div>
                  <div className="inicio-module-item"><span><FestosIcon name="FileText" size={21} /></span><div><strong>Cotizaciones</strong><small>El proceso comercial desde borrador hasta aprobación.</small></div></div>
                  <div className="inicio-module-item"><span><FestosIcon name="FolderKanban" size={21} /></span><div><strong>Proyectos</strong><small>Seguimiento de trabajos y ejecución.</small></div></div>
                  <div className="inicio-module-item"><span><FestosIcon name="History" size={21} /></span><div><strong>Auditoría</strong><small>Registro de actividad y trazabilidad.</small></div></div>
                </div>
              </section>

              <section className="inicio-benefits-card">
                <div className="inicio-section-heading">
                  <div>
                    <span className="inicio-section-kicker">VALOR PARA FESTOS</span>
                    <h2>¿Qué nos permite?</h2>
                  </div>
                </div>
                <div className="inicio-benefits-grid">
                  <div><span>01</span><strong>Más orden</strong><p>La información se mantiene organizada por proceso y área.</p></div>
                  <div><span>02</span><strong>Mejor seguimiento</strong><p>Los responsables pueden identificar estados y pendientes.</p></div>
                  <div><span>03</span><strong>Menos duplicidad</strong><p>Clientes, cotizaciones y proyectos se conectan dentro del sistema.</p></div>
                  <div><span>04</span><strong>Mayor trazabilidad</strong><p>Las acciones relevantes quedan registradas para consulta.</p></div>
                </div>
              </section>

              <section className="inicio-flow-card">
                <div className="inicio-section-heading">
                  <div>
                    <span className="inicio-section-kicker">FLUJO FESTOS</span>
                    <h2>Del cliente a la operación</h2>
                    <p>El recorrido principal de una oportunidad dentro de Control Festos.</p>
                  </div>
                </div>
                <div className="inicio-process-flow" aria-label="Flujo principal de Control Festos">
                  {['CLIENTE','COTIZACIÓN','APROBACIÓN','PROYECTO','OPERACIÓN','FACTURACIÓN'].map((paso, index) => (
                    <React.Fragment key={paso}>
                      <div className={`inicio-process-step ${index === 2 ? 'highlight' : ''}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{paso}</strong></div>
                      {index < 5 && <div className="inicio-process-arrow" aria-hidden="true">→</div>}
                    </React.Fragment>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* VISTA: SUBIR PAGO */}
          {vista === 'subir' && (
            <form onSubmit={handleSubmit} className="glass-card form-card">
              <h3 className="section-title"> Subir Nueva Factura / Pago</h3>

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
                  <p className="dual-control-hint"><FestosIcon name="LockKeyhole" size={16} /> Este monto requerirá aprobación de un segundo miembro del equipo.</p>
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
                  <h3 className="section-title"><FestosIcon name="LockKeyhole" size={21} /> Pendientes de Aprobación ({pagosEnAprobacionList.length})</h3>
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
                              <>{puedeAprobar ? <><FestosIcon name="CheckCircle2" size={16} /> Aprobar y Pagar</> : <><FestosIcon name="LockKeyhole" size={16} /> Requiere otro miembro</>}</>
                            </button>
                            <button onClick={() => cambiarEstado(p.id, 'Por Pagar')} className="btn-muted">Cancelar solicitud</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <h3 className="section-title"><FestosIcon name="Clock3" size={21} /> Pagos Pendientes ({pagosPendientesList.length})</h3>
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
                        <button onClick={() => cambiarEstado(p.id, 'Pagado')} className="btn-pay"><FestosIcon name="CheckCircle2" size={16} /> Marcar Pagado</button>
                        <button onClick={() => eliminarPago(p.id, p.codigo_unico)} className="btn-delete"><FestosIcon name="Trash2" size={16} /></button>
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
                <h3 className="section-title" style={{ margin: 0 }}><FestosIcon name="History" size={21} /> Historial de Pagos Realizados</h3>
                <button onClick={exportarAExcel} className="btn-export"> Exportar a Excel (CSV)</button>
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
                          <button onClick={() => setPagoEditando(p)} className="btn-upload"><FestosIcon name="Upload" size={16} /> Subir Factura</button>
                        )}
                        <button onClick={() => cambiarEstado(p.id, 'Por Pagar')} className="btn-muted">Pasar a Pendiente</button>
                        <button onClick={() => eliminarPago(p.id, p.codigo_unico)} className="btn-delete"><FestosIcon name="Trash2" size={16} /></button>
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
              <h3 className="section-title"><FestosIcon name="History" size={21} /> Centro de Auditoría</h3>
              <p className="panel-note" style={{ marginBottom: '20px' }}>
                Huella digital de cada acción del equipo — quién creó, editó, solicitó, aprobó o eliminó un registro, con marca de tiempo exacta.
              </p>

              {auditoria.length === 0 ? (
                <p className="empty-hint">Aún no hay actividad registrada en esta sesión.</p>
              ) : (
                <div className="audit-timeline">
                  {auditoria.map(entry => (
                    <div key={entry.id} className="audit-item">
                      <div className="audit-marker"><FestosIcon name={iconoPorAccion(entry.accion)} size={16} /></div>
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
              puedeGestionar={puedeRegistrarCliente}
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
              filtroDesdeDashboard={proyectosDesdeDashboard}
              solicitudNuevo={nuevoProyectoSolicitado}
              voiceCommand={voiceCommand?.kind === 'project' ? voiceCommand : null}
              onVoiceFeedback={feedbackVoz}
              onConsumirNuevo={() => setNuevoProyectoSolicitado(false)}
              usuario={usuarioLogueado}
              onNotify={agregarNotificacion}
              onAudit={registrarAuditoria}
              puedeGestionar={!!misPermisos.gestionar_proyectos}
            />
          )}

          {/* VISTA: COTIZACIONES */}
          {vista === 'cotizaciones' && misPermisos.ver_cotizaciones && (
            <Cotizaciones
              puedeCrearCliente={puedeRegistrarCliente}
              solicitudNuevo={nuevaCotizacionSolicitada}
              voiceCommand={voiceCommand?.kind === 'quote' ? voiceCommand : null}
              onVoiceFeedback={feedbackVoz}
              onConsumirNuevo={() => setNuevaCotizacionSolicitada(false)}
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
              <h3 className="section-title"><FestosIcon name="Bot" size={21} /> Asistente IA de Búsqueda Inteligente</h3>
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
            <span><FestosIcon name={iconoPorTipo(t.tipo)} size={16} /></span>
            <span>{t.mensaje}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;