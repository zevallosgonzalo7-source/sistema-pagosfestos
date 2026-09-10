import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import OneSignal from 'react-onesignal';
import './App.css';

function App() {
  // --- ESTADOS DE AUTENTICACIÓN ---
  const [usuarioLogueado, setUsuarioLogueado] = useState(() => {
    return localStorage.getItem('festos_sesion_usuario') || '';
  });
  const [inputUser, setInputUser] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  const [modoOscuro, setModoOscuro] = useState(() => {
    return localStorage.getItem('festos_modo_oscuro') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('festos_modo_oscuro', modoOscuro);
  }, [modoOscuro]);

  // Manejo de Inicio de Sesión (Credenciales estrictas para los 4 usuarios de la empresa)
  const manejarLogin = (e) => {
    e.preventDefault();
    setErrorLogin('');

    // Credenciales exactas autorizadas
    const usuariosValidos = {
      "gonzalo": "ADMIN9090",
      "rodrigo": "ADMIN8080",
      "mar": "ADMIN7070",
      "jesus": "ADMIN6060"
    };

    const userLower = inputUser.trim().toLowerCase();

    // Verificamos si el usuario existe y si la contraseña coincide exactamente
    if (usuariosValidos[userLower] && usuariosValidos[userLower] === inputPass) {
      localStorage.setItem('festos_sesion_usuario', inputUser.trim()); 
      setUsuarioLogueado(inputUser.trim());
      setInputUser('');
      setInputPass('');
    } else {
      setErrorLogin('Acceso denegado: Usuario o contraseña incorrectos.');
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('festos_sesion_usuario');
    setUsuarioLogueado('');
  };

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

  // Estado para edición en Por Pagar / Historial
  const [pagoEditando, setPagoEditando] = useState(null);
  const [archivoNuevo, setArchivoNuevo] = useState(null);

  // Filtros del Historial
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroComprobante, setFiltroComprobante] = useState('todos'); // 'todos', 'conFactura', 'sinFactura'

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
        appId: "ef5bdb2f-ce76-4f50-b664-071d1c526642",
        allowLocalhostAsSecureOrigin: true,
      }).then(() => {
        if (OneSignal.SlidedefaultPrompt && typeof OneSignal.SlidedefaultPrompt.showPrompt === 'function') {
          OneSignal.SlidedefaultPrompt.showPrompt();
        }
      });
    } catch (err) {
      console.warn("OneSignal notice:", err);
    }
  }, []);

  useEffect(() => {
    if (usuarioLogueado) {
      obtenerPagos();
    }
  }, [usuarioLogueado]);

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
        nombre_archivo: nombreArchivoFinal,
        url_archivo: urlArchivoFinal,
        estado: 'Por Pagar', 
        fecha_creacion: fechaActualStr,
        fecha_legible: new Date().toLocaleDateString(),
        registrado_por: usuarioLogueado
      };

      const { error: insertError } = await supabase.from('pagos').insert([nuevoPagoDB]);
      if (insertError) throw insertError;

      alert(`¡Pago registrado con éxito! ID: ${idUnico}`);

      setProducto('');
      setProveedor('');
      setMontoIngresado('');
      setAplicarIgv(true);
      setDescripcion('');
      setProyecto('');
      setArchivo(null);
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
          nombre_archivo: nombreArchivoFinal
        })
        .eq('id', pagoEditando.id);

      if (error) throw error;

      alert('¡Registro actualizado correctamente!');
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
    const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby-TY2sJmERrrIz9ktYYItTp6jQnoJIQMKBnZWPL7AjXqAGxOvwaQI90TfUx8dXDoKx/exec";
    
    const datosEnvio = {
      fecha: pago.fecha_legible || '',
      proveedor: pago.proveedor || '',
      proyecto: pago.proyecto || '',
      descripcion: pago.descripcion || '',
      tipo_documento: 'Factura',
      codigo_unico: pago.codigo_unico || '',
      precio_sin_igv: pago.precio_sin_igv || '0.00',
      precio_con_igv: pago.precio_con_igv || '0.00',
      registrado_por: pago.registrado_por || 'Anónimo'
    };

    try {
      await fetch(WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosEnvio)
      });
    } catch (error) {
      console.error('Error al sincronizar con Google Sheets:', error);
    }
  };

  const eliminarDeGoogleSheets = async (codigoUnico) => {
    const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby-TY2sJmERrrIz9ktYYItTp6jQnoJIQMKBnZWPL7AjXqAGxOvwaQI90TfUx8dXDoKx/exec";
    const urlConParametros = `${WEB_APP_URL}?action=delete&codigo_unico=${encodeURIComponent(codigoUnico)}`;

    try {
      await fetch(urlConParametros, {
        method: 'GET',
        mode: 'no-cors'
      });
    } catch (error) {
      console.error('Error al eliminar de Google Sheets:', error);
    }
  };

  const cambiarEstado = async (id, nuevoEstado) => {
    const pagoActual = pagos.find(p => p.id === id);

    const { error } = await supabase
      .from('pagos')
      .update({ estado: nuevoEstado })
      .eq('id', id);

    if (error) {
      alert('Error al actualizar el estado');
    } else {
      if (nuevoEstado === 'Pagado' && pagoActual) {
        sincronizarConGoogleSheets(pagoActual);
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
      'Descripción',
      'Tipo de Documento',
      'Número de Factura / Código',
      'Precio Sin IGV (S/.)',
      'Precio Con IGV (S/.)',
      'Tiene Comprobante'
    ];

    const rows = pagosFiltrados.map(p => [
      `"${p.fecha_legible || ''}"`,
      `"${p.proveedor || ''}"`,
      `"${p.proyecto || ''}"`,
      `"${p.descripcion || ''}"`,
      `"Factura"`,
      `"${p.codigo_unico || ''}"`,
      p.precio_sin_igv || '0.00',
      p.precio_con_igv || '0.00',
      `"${p.url_archivo ? 'Sí' : 'No'}"`
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
      ${p.fecha_legible || ''} ${p.precio_con_igv || ''} ${p.estado || ''}
    `.toLowerCase();
    return terminos.every(termino => textoCompleto.includes(termino));
  });

  // Cálculos Dashboard
  const pagosRealizados = pagos.filter(p => p.estado === 'Pagado');
  const pagosPendientesList = pagos.filter(p => p.estado === 'Por Pagar');
  const gastoTotalAcumulado = pagosRealizados.reduce((acc, p) => acc + (parseFloat(p.precio_con_igv) || 0), 0);
  const montoPendienteTotal = pagosPendientesList.reduce((acc, p) => acc + (parseFloat(p.precio_con_igv) || 0), 0);
  const totalConFactura = pagos.filter(p => p.url_archivo).length;
  const totalSinFactura = pagos.length - totalConFactura;

  const tema = {
    bgApp: modoOscuro ? '#0f172a' : '#f8fafc',
    bgCard: modoOscuro ? '#1e293b' : '#ffffff',
    textMain: modoOscuro ? '#f8fafc' : '#1e293b',
    textMuted: modoOscuro ? '#94a3b8' : '#64748b',
    border: modoOscuro ? '#334155' : '#e2e8f0',
    inputBg: modoOscuro ? '#0f172a' : '#ffffff',
    inputColor: modoOscuro ? '#f8fafc' : '#1e293b',
  };

  // --- PANTALLA DE LOGIN CON FONDO VERDE PETRÓLEO, BLUR Y LOGO GRANDE TRASERO ---
  if (!usuarioLogueado) {
    return (
      <div style={{ 
        position: 'relative',
        display: 'flex', 
        height: '100vh', 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#224248', 
        fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', 
        padding: '20px',
        overflow: 'hidden'
      }}>
        
        {/* LOGO GIGANTE DE FONDO CON BLUR Y OPACIDAD */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          backgroundImage: 'url("/festoslogo.jpeg")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'contain',
          filter: 'blur(10px)',
          opacity: 0.10,
          zIndex: 1,
          pointerEvents: 'none'
        }} />

        {/* EFECTO DE LUZ / BLUR ADICIONAL */}
        <div style={{ position: 'absolute', width: '350px', height: '350px', background: '#325b63', borderRadius: '50%', top: '-80px', left: '-80px', filter: 'blur(70px)', opacity: '0.5', zIndex: 1 }}></div>

        {/* FORMULARIO DE LOGIN (Z-index superior) */}
        <form onSubmit={manejarLogin} style={{ 
          position: 'relative',
          zIndex: 10,
          background: 'rgba(255, 255, 255, 0.92)', 
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: '#1e293b', 
          padding: '35px', 
          borderRadius: '16px', 
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)', 
          textAlign: 'center', 
          width: '100%', 
          maxWidth: '380px',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          {/* Logo pequeño superior dentro de la tarjeta */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <img 
              src="/festoslogo.jpeg" 
              alt="Festos Logo" 
              style={{ height: '42px', objectFit: 'contain', borderRadius: '6px', padding: '2px', background: '#ffffff' }} 
            />
          </div>

          <h2 style={{ marginBottom: '6px', color: '#224248' }}>Control Festos</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>Acceso exclusivo para el equipo autorizado</p>
          
          {errorLogin && (
            <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '16px', fontWeight: 'bold' }}>
              {errorLogin}
            </div>
          )}

          <div style={{ marginBottom: '14px', textAlign: 'left' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '4px' }}>Usuario</label>
            <input 
              type="text" 
              placeholder="Ej. Gonzalo, Rodrigo, Mar, Jesus" 
              value={inputUser} 
              onChange={(e) => setInputUser(e.target.value)} 
              required
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#1e293b', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }}
            />
          </div>

          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '4px' }}>Contraseña</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={inputPass} 
              onChange={(e) => setInputPass(e.target.value)} 
              required
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#1e293b', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }}
            />
          </div>

          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#224248', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>Iniciar Sesión</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', minHeight: '100vh', backgroundColor: tema.bgApp, color: tema.textMain, paddingBottom: '40px', transition: 'background-color 0.3s, color 0.3s' }}>
      
      {/* Cabecera Oficial Festos */}
      <header style={{ backgroundColor: '#224248', color: 'white', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src="/festoslogo.jpeg" 
            alt="Festos Logo" 
            style={{ height: '38px', objectFit: 'contain', backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px', borderRadius: '6px' }} 
          />
          <h1 style={{ fontSize: '1.2rem', fontWeight: '600', margin: 0, letterSpacing: '-0.02em' }}>Control de Pagos y Compras FESTOS</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setModoOscuro(!modoOscuro)}
            title="Cambiar Modo Oscuro/Claro"
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '1rem', color: '#ffffff' }}
          >
            {modoOscuro ? '☀️' : '🌙'}
          </button>

          <span style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.15)', padding: '6px 12px', borderRadius: '8px', color: '#ffffff', textTransform: 'capitalize' }}>
            👤 {usuarioLogueado}
          </span>

          <button 
            onClick={cerrarSesion}
            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
          >
            Salir 🚪
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '900px', margin: '30px auto', padding: '0 16px' }}>
        
        {/* Menú de Navegación */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '24px', backgroundColor: tema.bgCard, padding: '8px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: `1px solid ${tema.border}`, flexWrap: 'wrap', gap: '6px' }}>
          <button 
            onClick={() => setVista('dashboard')} 
            style={{ fontWeight: vista === 'dashboard' ? '600' : '400', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'dashboard' ? '#224248' : 'transparent', color: vista === 'dashboard' ? '#ffffff' : tema.textMuted }}
          >
            📊 Dashboard
          </button>

          <button 
            onClick={() => setVista('subir')} 
            style={{ fontWeight: vista === 'subir' ? '600' : '400', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'subir' ? '#224248' : 'transparent', color: vista === 'subir' ? '#ffffff' : tema.textMuted }}
          >
            Subir Pago
          </button>

          <button 
            onClick={() => setVista('porPagar')} 
            style={{ fontWeight: vista === 'porPagar' ? '600' : '400', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'porPagar' ? '#224248' : 'transparent', color: vista === 'porPagar' ? '#ffffff' : tema.textMuted }}
          >
            Por Pagar ({pagosPendientesList.length})
          </button>

          <button 
            onClick={() => setVista('historial')} 
            style={{ fontWeight: vista === 'historial' ? '600' : '400', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'historial' ? '#224248' : 'transparent', color: vista === 'historial' ? '#ffffff' : tema.textMuted }}
          >
            Historial 📂
          </button>

          <button 
            onClick={() => setVista('asistente')} 
            style={{ fontWeight: vista === 'asistente' ? '600' : '400', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'asistente' ? '#224248' : 'transparent', color: vista === 'asistente' ? '#ffffff' : tema.textMuted }}
          >
            🤖 IA
          </button>
        </div>

        {/* MODAL / FORMULARIO FLOTANTE DE EDICIÓN Y SUBIDA DE COMPROBANTE */}
        {pagoEditando && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
            <form onSubmit={guardarEdicionConArchivo} style={{ background: tema.bgCard, color: tema.textMain, padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '450px', border: `1px solid ${tema.border}`, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
              <h3 style={{ margin: '0 0 16px 0', color: modoOscuro ? '#38bdf8' : '#224248' }}>✏️ Editar Registro y Comprobante</h3>
              
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Proveedor</label>
                <input type="text" value={pagoEditando.proveedor} onChange={(e) => setPagoEditando({...pagoEditando, proveedor: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor }} required />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Producto / Servicio</label>
                <input type="text" value={pagoEditando.producto} onChange={(e) => setPagoEditando({...pagoEditando, producto: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor }} required />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Monto (S/.)</label>
                <input type="number" step="0.01" value={pagoEditando.precio_con_igv} onChange={(e) => setPagoEditando({...pagoEditando, precio_con_igv: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor }} required />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Comprobante Actual: {pagoEditando.url_archivo ? '✅ Subido' : '❌ Sin comprobante'}</label>
                <input type="file" onChange={(e) => setArchivoNuevo(e.target.files[0])} style={{ fontSize: '0.85rem' }} />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setPagoEditando(null)} style={{ padding: '8px 14px', background: '#cbd5e1', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button type="submit" disabled={cargando} style={{ padding: '8px 14px', background: '#224248', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{cargando ? 'Guardando...' : 'Guardar Cambios'}</button>
              </div>
            </form>
          </div>
        )}

        {/* VISTA: DASHBOARD EJECUTIVO */}
        {vista === 'dashboard' && (
          <div>
            <h3 style={{ color: modoOscuro ? '#38bdf8' : '#224248', fontSize: '1.2rem', marginBottom: '16px' }}>📊 Dashboard Ejecutivo General</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: tema.bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${tema.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: tema.textMuted }}>Gasto Total Pagado</p>
                <h2 style={{ margin: '8px 0 0 0', color: '#22c55e' }}>S/. {gastoTotalAcumulado.toFixed(2)}</h2>
              </div>
              <div style={{ background: tema.bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${tema.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: tema.textMuted }}>Total Por Pagar</p>
                <h2 style={{ margin: '8px 0 0 0', color: '#f59e0b' }}>S/. {montoPendienteTotal.toFixed(2)}</h2>
              </div>
              <div style={{ background: tema.bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${tema.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: tema.textMuted }}>Registros con Factura</p>
                <h2 style={{ margin: '8px 0 0 0', color: '#38bdf8' }}>{totalConFactura} / {pagos.length}</h2>
              </div>
              <div style={{ background: tema.bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${tema.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: tema.textMuted }}>Sin Comprobante</p>
                <h2 style={{ margin: '8px 0 0 0', color: '#ef4444' }}>{totalSinFactura}</h2>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ background: tema.bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${tema.border}` }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: modoOscuro ? '#38bdf8' : '#224248' }}>📌 Estado General de Facturación</h4>
                <p style={{ fontSize: '0.9rem', color: tema.textMuted, margin: '6px 0' }}>• Facturas adjuntas: <strong>{((totalConFactura / (pagos.length || 1)) * 100).toFixed(1)}%</strong></p>
                <p style={{ fontSize: '0.9rem', color: tema.textMuted, margin: '6px 0' }}>• Facturas pendientes: <strong>{pagosPendientesList.length} docs</strong></p>
              </div>
              <div style={{ background: tema.bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${tema.border}` }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: modoOscuro ? '#38bdf8' : '#224248' }}>💡 Consejos Financieros Festos</h4>
                <p style={{ fontSize: '0.9rem', color: tema.textMuted, margin: '6px 0' }}>• Recuerda subir los comprobantes faltantes desde la pestaña de Historial.</p>
                <p style={{ fontSize: '0.9rem', color: tema.textMuted, margin: '6px 0' }}>• Utiliza el asistente IA para consultas rápidas por proveedor o proyecto.</p>
              </div>
            </div>
          </div>
        )}

        {/* VISTA: SUBIR PAGO */}
        {vista === 'subir' && (
          <form onSubmit={handleSubmit} style={{ background: tema.bgCard, padding: '24px', borderRadius: '12px', border: `1px solid ${tema.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: modoOscuro ? '#38bdf8' : '#224248' }}>📤 Subir Nueva Factura / Pago</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Producto / Servicio *</label>
                <input type="text" value={producto} onChange={(e) => setProducto(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Proveedor *</label>
                <input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Monto (S/.) *</label>
                <input type="number" step="0.01" value={montoIngresado} onChange={(e) => setMontoIngresado(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Proyecto</label>
                <input type="text" value={proyecto} onChange={(e) => setProyecto(e.target.value)} placeholder="Ej. General, Xiaomi..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={aplicarIgv} onChange={(e) => setAplicarIgv(e.target.checked)} />
                Agregar 18% IGV al monto ingresado
              </label>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: tema.textMuted }}>Total calculado: <strong>S/. {precioFinalCalculado}</strong></p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Descripción / Notas</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows="3" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, boxSizing: 'border-box' }}></textarea>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Adjuntar Factura (Opcional)</label>
              <input type="file" onChange={(e) => setArchivo(e.target.files[0])} style={{ color: tema.textMuted }} />
            </div>

            <button type="submit" disabled={cargando} style={{ width: '100%', backgroundColor: '#224248', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              {cargando ? 'Subiendo...' : 'Registrar Pago'}
            </button>
          </form>
        )}

        {/* VISTA: POR PAGAR */}
        {vista === 'porPagar' && (
          <div>
            <h3 style={{ color: modoOscuro ? '#38bdf8' : '#224248', fontSize: '1.2rem', marginBottom: '16px' }}>⏳ Pagos Pendientes ({pagosPendientesList.length})</h3>
            {pagosPendientesList.length === 0 ? (
              <p style={{ color: tema.textMuted, background: tema.bgCard, padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${tema.border}` }}>No hay pagos pendientes por realizar.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pagosPendientesList.map(p => (
                  <div key={p.id} style={{ background: tema.bgCard, padding: '16px', borderRadius: '12px', border: `1px solid ${tema.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{p.codigo_unico}</span>
                      <h4 style={{ margin: '6px 0 2px 0', fontSize: '1rem' }}>{p.proveedor} - {p.producto}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: tema.textMuted }}>Proyecto: <strong>{p.proyecto}</strong> | Monto: <strong style={{ color: '#f59e0b' }}>S/. {p.precio_con_igv}</strong></p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: tema.textMuted }}>Nota: {p.descripcion || 'Sin descripción'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {p.url_archivo ? (
                        <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', background: '#e0f2fe', color: '#0369a1', padding: '6px 10px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' }}>Ver Comprobante</a>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>Sin archivo</span>
                      )}
                      <button onClick={() => setPagoEditando(p)} style={{ fontSize: '0.8rem', background: '#3b82f6', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Editar</button>
                      <button onClick={() => cambiarEstado(p.id, 'Pagado')} style={{ fontSize: '0.8rem', background: '#22c55e', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Marcar Pagado ✅</button>
                      <button onClick={() => eliminarPago(p.id, p.codigo_unico)} style={{ fontSize: '0.8rem', background: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️</button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ color: modoOscuro ? '#38bdf8' : '#224248', fontSize: '1.2rem', margin: 0 }}>📂 Historial de Pagos Realizados</h3>
              <button onClick={exportarAExcel} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>📥 Exportar a Excel (CSV)</button>
            </div>

            {/* Filtros */}
            <div style={{ background: tema.bgCard, padding: '16px', borderRadius: '12px', border: `1px solid ${tema.border}`, marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px', color: tema.textMuted }}>Búsqueda General</label>
                <input type="text" placeholder="Proveedor, producto, ID..." value={filtroBusqueda} onChange={(e) => setFiltroBusqueda(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px', color: tema.textMuted }}>Fecha Inicio</label>
                <input type="date" value={filtroFechaInicio} onChange={(e) => setFiltroFechaInicio(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px', color: tema.textMuted }}>Fecha Fin</label>
                <input type="date" value={filtroFechaFin} onChange={(e) => setFiltroFechaFin(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px', color: tema.textMuted }}>Comprobante</label>
                <select value={filtroComprobante} onChange={(e) => setFiltroComprobante(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, fontSize: '0.85rem', boxSizing: 'border-box' }}>
                  <option value="todos">Todos</option>
                  <option value="conFactura">Con Factura</option>
                  <option value="sinFactura">Sin Factura</option>
                </select>
              </div>
            </div>

            {pagosFiltrados.length === 0 ? (
              <p style={{ color: tema.textMuted, background: tema.bgCard, padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${tema.border}` }}>No hay pagos registrados en el historial con los filtros aplicados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pagosFiltrados.map(p => (
                  <div key={p.id} style={{ background: tema.bgCard, padding: '16px', borderRadius: '12px', border: `1px solid ${tema.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{p.codigo_unico}</span>
                        <span style={{ fontSize: '0.75rem', color: tema.textMuted }}>{p.fecha_legible}</span>
                      </div>
                      <h4 style={{ margin: '4px 0 2px 0', fontSize: '1rem' }}>{p.proveedor} - {p.producto}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: tema.textMuted }}>Proyecto: <strong>{p.proyecto}</strong> | Monto: <strong style={{ color: '#22c55e' }}>S/. {p.precio_con_igv}</strong></p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: tema.textMuted }}>Registrado por: <strong>{p.registrado_por}</strong></p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {p.url_archivo ? (
                        <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', background: '#e0f2fe', color: '#0369a1', padding: '6px 10px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' }}>Ver Comprobante</a>
                      ) : (
                        <button onClick={() => setPagoEditando(p)} style={{ fontSize: '0.8rem', background: '#f59e0b', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Subir Factura 📎</button>
                      )}
                      <button onClick={() => cambiarEstado(p.id, 'Por Pagar')} style={{ fontSize: '0.8rem', background: '#64748b', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Pasar a Pendiente</button>
                      <button onClick={() => eliminarPago(p.id, p.codigo_unico)} style={{ fontSize: '0.8rem', background: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VISTA: ASISTENTE IA */}
        {vista === 'asistente' && (
          <div style={{ background: tema.bgCard, padding: '24px', borderRadius: '12px', border: `1px solid ${tema.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ color: modoOscuro ? '#38bdf8' : '#224248', fontSize: '1.2rem', marginBottom: '8px' }}>🤖 Asistente IA de Búsqueda Inteligente</h3>
            <p style={{ fontSize: '0.85rem', color: tema.textMuted, marginBottom: '16px' }}>Escribe palabras clave separadas por espacio (ej. proveedor, proyecto, estado, montos) para buscar instantáneamente en todos los registros.</p>
            
            <input 
              type="text" 
              placeholder="Ej. Xiaomi pagado o PAG-123456..." 
              value={busquedaInteligente} 
              onChange={(e) => setBusquedaInteligente(e.target.value)} 
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, fontSize: '0.95rem', boxSizing: 'border-box', marginBottom: '20px', outline: 'none' }} 
            />

            <h4 style={{ fontSize: '1rem', marginBottom: '12px', color: tema.textMain }}>Resultados Encontrados ({pagosBusquedaInteligente.length})</h4>

            {pagosBusquedaInteligente.length === 0 ? (
              <p style={{ color: tema.textMuted, fontSize: '0.9rem' }}>No se encontraron coincidencias para tu búsqueda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pagosBusquedaInteligente.map(p => (
                  <div key={p.id} style={{ background: tema.bgApp, padding: '12px', borderRadius: '8px', border: `1px solid ${tema.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', background: p.estado === 'Pagado' ? '#dcfce7' : '#fef3c7', color: p.estado === 'Pagado' ? '#15803d' : '#d97706', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{p.codigo_unico} - {p.estado}</span>
                      <p style={{ margin: '6px 0 2px 0', fontSize: '0.9rem', fontWeight: 'bold' }}>{p.proveedor} - {p.producto}</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: tema.textMuted }}>Proyecto: {p.proyecto} | S/. {p.precio_con_igv} | {p.fecha_legible}</p>
                    </div>
                    {p.url_archivo && (
                      <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' }}>Ver Factura</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;