import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import OneSignal from 'react-onesignal';
import './App.css';

function App() {
  const [nombreUsuario, setNombreUsuario] = useState(localStorage.getItem('festos_usuario') || '');
  const [inputTemp, setInputTemp] = useState('');

  const [modoOscuro, setModoOscuro] = useState(() => {
    return localStorage.getItem('festos_modo_oscuro') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('festos_modo_oscuro', modoOscuro);
  }, [modoOscuro]);

  const guardarNombre = (e) => {
    e.preventDefault();
    if (!inputTemp.trim()) return;
    localStorage.setItem('festos_usuario', inputTemp.trim());
    setNombreUsuario(inputTemp.trim());
  };

  const [vista, setVista] = useState('dashboard'); 
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Estados para la nueva vista de Caja Festos (220 registros históricos)
  const [registrosCaja, setRegistrosCaja] = useState([]);
  const [busquedaCaja, setBusquedaCaja] = useState('');

  // Campos del formulario
  const [producto, setProducto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [montoIngresado, setMontoIngresado] = useState('');
  const [aplicarIgv, setAplicarIgv] = useState(true);
  const [descripcion, setDescripcion] = useState('');
  const [proyecto, setProyecto] = useState('');
  const [archivo, setArchivo] = useState(null);

  // Filtros de fecha y texto para el Historial
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');

  // Estado para la Búsqueda Inteligente (Asistente IA)
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
    if (nombreUsuario) {
      obtenerPagos();
      obtenerCajaFestos();
    }
  }, [nombreUsuario]);

  const obtenerPagos = async () => {
    const { data, error } = await supabase.from('pagos').select('*');
    if (error) {
      console.error('Error al cargar pagos:', error);
    } else {
      setPagos(data || []);
    }
  };

  // Función para obtener los registros de festos_caja
  const obtenerCajaFestos = async () => {
    const { data, error } = await supabase.from('festos_caja').select('*');
    if (error) {
      console.error('Error al cargar caja festos:', error);
    } else {
      setRegistrosCaja(data || []);
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
        registrado_por: nombreUsuario
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

  // Sincronizar inserción con Google Sheets (POST)
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

  // Sincronizar eliminación con Google Sheets vía GET
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
      'Precio Con IGV (S/.)'
    ];

    const rows = pagosFiltrados.map(p => [
      `"${p.fecha_legible || ''}"`,
      `"${p.proveedor || ''}"`,
      `"${p.proyecto || ''}"`,
      `"${p.descripcion || ''}"`,
      `"Factura"`,
      `"${p.codigo_unico || ''}"`,
      p.precio_sin_igv || '0.00',
      p.precio_con_igv || '0.00'
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

  // Filtro y cálculos para festos_caja
  const cajaFiltrada = registrosCaja.filter(r => {
    if (!busquedaCaja.trim()) return true;
    const txt = busquedaCaja.toLowerCase();
    return (
      (r.proveedor && r.proveedor.toLowerCase().includes(txt)) ||
      (r.categoria && r.categoria.toLowerCase().includes(txt)) ||
      (r.descripcion && r.descripcion.toLowerCase().includes(txt)) ||
      (r.fecha && r.fecha.toLowerCase().includes(txt))
    );
  });

  let totalIngresosCaja = 0;
  let totalEgresosCaja = 0;

  registrosCaja.forEach(r => {
    const ing = parseFloat(String(r.ingreso || '0').replace(/[^0-9.-]+/g, "")) || 0;
    const egr = parseFloat(String(r.egreso || '0').replace(/[^0-9.-]+/g, "")) || 0;
    totalIngresosCaja += ing;
    totalEgresosCaja += Math.abs(egr);
  });

  const saldoCaja = totalIngresosCaja - totalEgresosCaja;

  // Motor de Búsqueda Inteligente (Asistente IA)
  const pagosBusquedaInteligente = pagos.filter(p => {
    if (!busquedaInteligente.trim()) return true;
    
    const terminos = busquedaInteligente.toLowerCase().trim().split(' ');
    
    const textoCompleto = `
      ${p.codigo_unico || ''} 
      ${p.producto || ''} 
      ${p.proveedor || ''} 
      ${p.proyecto || ''} 
      ${p.descripcion || ''} 
      ${p.registrado_por || ''} 
      ${p.fecha_legible || ''}
      ${p.precio_con_igv || ''}
      ${p.estado || ''}
    `.toLowerCase();

    return terminos.every(termino => textoCompleto.includes(termino));
  });

  // --- CÁLCULOS PARA EL DASHBOARD EJECUTIVO ---
  const pagosRealizados = pagos.filter(p => p.estado === 'Pagado');
  const gastoTotalAcumulado = pagosRealizados.reduce((acc, p) => acc + (parseFloat(p.precio_con_igv) || 0), 0);
  
  const gastosPorProyecto = pagosRealizados.reduce((acc, p) => {
    const proj = p.proyecto || 'General';
    acc[proj] = (acc[proj] || 0) + (parseFloat(p.precio_con_igv) || 0);
    return acc;
  }, {});

  const gastosPorProveedor = pagosRealizados.reduce((acc, p) => {
    const prov = p.proveedor || 'Desconocido';
    acc[prov] = (acc[prov] || 0) + (parseFloat(p.precio_con_igv) || 0);
    return acc;
  }, {});

  const tema = {
    bgApp: modoOscuro ? '#0f172a' : '#f8fafc',
    bgCard: modoOscuro ? '#1e293b' : '#ffffff',
    textMain: modoOscuro ? '#f8fafc' : '#1e293b',
    textMuted: modoOscuro ? '#94a3b8' : '#64748b',
    border: modoOscuro ? '#334155' : '#e2e8f0',
    inputBg: modoOscuro ? '#0f172a' : '#ffffff',
    inputColor: modoOscuro ? '#f8fafc' : '#1e293b',
    cardAlt: modoOscuro ? '#131e32' : '#f8fafc'
  };

  if (!nombreUsuario) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#224248', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', padding: '20px' }}>
        <form onSubmit={guardarNombre} style={{ background: '#ffffff', color: '#1e293b', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', textAlign: 'center', width: '100%', maxWidth: '360px' }}>
          <h2 style={{ marginBottom: '8px', color: '#224248' }}>Control Festos</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '20px' }}>Ingresa tu nombre para continuar y registrar pagos</p>
          <input 
            type="text" 
            placeholder="Tu nombre completo" 
            value={inputTemp} 
            onChange={(e) => setInputTemp(e.target.value)} 
            required
            style={{ width: '100%', padding: '12px', boxSizing: 'border-box', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#1e293b', borderRadius: '8px', fontSize: '1rem', outline: 'none', marginBottom: '20px' }}
          />
          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#224248', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', minHeight: '100vh', backgroundColor: tema.bgApp, color: tema.textMain, paddingBottom: '40px', transition: 'background-color 0.3s, color 0.3s' }}>
      
      {/* Cabecera Oficial Festos */}
      <header style={{ backgroundColor: '#224248', color: 'white', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src="/logo-festos.png" 
            alt="Festos Logo" 
            style={{ height: '38px', objectFit: 'contain', backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px', borderRadius: '6px' }} 
          />
          <h1 style={{ fontSize: '1.2rem', fontWeight: '600', margin: 0, letterSpacing: '-0.02em' }}>Control de Pagos y Facturas</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setModoOscuro(!modoOscuro)}
            title="Cambiar Modo Oscuro/Claro"
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '1rem', color: '#ffffff' }}
          >
            {modoOscuro ? '☀️' : '🌙'}
          </button>

          <span style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '8px', color: '#ffffff' }}>
            👤 {nombreUsuario} (<span style={{ cursor: 'pointer', color: '#d4e036', textDecoration: 'underline' }} onClick={() => { localStorage.removeItem('festos_usuario'); setNombreUsuario(''); }}>cambiar</span>)
          </span>

          <div style={{ backgroundColor: '#d4e036', color: '#1e293b', fontWeight: '700', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.8rem' }}>
            FESTOS
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '800px', margin: '30px auto', padding: '0 16px' }}>
        
        {/* Menú de Navegación completo */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '24px', backgroundColor: tema.bgCard, padding: '8px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: `1px solid ${tema.border}`, flexWrap: 'wrap', gap: '6px' }}>
          <button 
            onClick={() => setVista('dashboard')} 
            style={{ fontWeight: vista === 'dashboard' ? '600' : '400', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'dashboard' ? '#224248' : 'transparent', color: vista === 'dashboard' ? '#ffffff' : tema.textMuted, transition: 'all 0.2s' }}
          >
            📊 Dashboard
          </button>

          <button 
            onClick={() => setVista('cajaFestos')} 
            style={{ fontWeight: vista === 'cajaFestos' ? '600' : '400', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'cajaFestos' ? '#224248' : 'transparent', color: vista === 'cajaFestos' ? '#ffffff' : tema.textMuted, transition: 'all 0.2s' }}
          >
            💳 Caja Histórica ({registrosCaja.length})
          </button>

          <button 
            onClick={() => setVista('subir')} 
            style={{ fontWeight: vista === 'subir' ? '600' : '400', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'subir' ? '#224248' : 'transparent', color: vista === 'subir' ? '#ffffff' : tema.textMuted, transition: 'all 0.2s' }}
          >
            Subir Pago
          </button>

          <button 
            onClick={() => setVista('porPagar')} 
            style={{ fontWeight: vista === 'porPagar' ? '600' : '400', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'porPagar' ? '#224248' : 'transparent', color: vista === 'porPagar' ? '#ffffff' : tema.textMuted, transition: 'all 0.2s' }}
          >
            Por Pagar ({pagos.filter(p => p.estado === 'Por Pagar').length})
          </button>

          <button 
            onClick={() => setVista('historial')} 
            style={{ fontWeight: vista === 'historial' ? '600' : '400', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'historial' ? '#224248' : 'transparent', color: vista === 'historial' ? '#ffffff' : tema.textMuted, transition: 'all 0.2s' }}
          >
            Historial 📂
          </button>

          <button 
            onClick={() => setVista('asistente')} 
            style={{ fontWeight: vista === 'asistente' ? '600' : '400', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'asistente' ? '#224248' : 'transparent', color: vista === 'asistente' ? '#ffffff' : tema.textMuted, transition: 'all 0.2s' }}
          >
            🤖 IA
          </button>
        </div>

        {/* VISTA: CAJA HISTÓRICA (CON SALDO ACTUAL Y TABLA COMPLETA) */}
        {vista === 'cajaFestos' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: modoOscuro ? '#38bdf8' : '#224248', fontSize: '1.2rem', fontWeight: '700', margin: '0 0 4px 0' }}>
                💳 Historial General de Caja - Festos
              </h3>
              <p style={{ fontSize: '0.85rem', color: tema.textMuted, margin: 0 }}>
                Visualización de los movimientos importados desde tu base de datos.
              </p>
            </div>

            {/* TARJETA DESTACADA: SALDO ACTUAL */}
            <div style={{ 
              background: modoOscuro ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #224248 0%, #152a2f 100%)', 
              color: '#ffffff', 
              padding: '24px', 
              borderRadius: '16px', 
              marginBottom: '20px', 
              boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#d4e036' }}>
                  💵 Saldo Actual en Caja
                </span>
                <h1 style={{ margin: '8px 0 0 0', fontSize: '2.4rem', fontWeight: '800' }}>
                  S/. {saldoCaja.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h1>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: '12px', backdropFilter: 'blur(5px)' }}>
                <span style={{ fontSize: '0.75rem', display: 'block', color: '#cbd5e1' }}>Total Registros</span>
                <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>{registrosCaja.length} movs</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: tema.bgCard, padding: '16px', borderRadius: '12px', border: `1px solid ${tema.border}` }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: tema.textMuted, textTransform: 'uppercase' }}>Ingresos Totales</span>
                <h3 style={{ margin: '6px 0 0 0', fontSize: '1.3rem', color: '#16a34a' }}>S/. {totalIngresosCaja.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div style={{ background: tema.bgCard, padding: '16px', borderRadius: '12px', border: `1px solid ${tema.border}` }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: tema.textMuted, textTransform: 'uppercase' }}>Egresos Totales</span>
                <h3 style={{ margin: '6px 0 0 0', fontSize: '1.3rem', color: '#e11d48' }}>S/. {totalEgresosCaja.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              </div>
            </div>

            <div style={{ background: tema.bgCard, padding: '16px', borderRadius: '12px', marginBottom: '16px', border: `1px solid ${tema.border}` }}>
              <input 
                type="text" 
                placeholder="🔍 Buscar por proveedor, categoría o descripción..." 
                value={busquedaCaja}
                onChange={(e) => setBusquedaCaja(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ background: tema.bgCard, borderRadius: '12px', border: `1px solid ${tema.border}`, overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: modoOscuro ? '#131e32' : '#f1f5f9', color: tema.textMuted, borderBottom: `1px solid ${tema.border}` }}>
                    <th style={{ padding: '12px' }}>Fecha</th>
                    <th style={{ padding: '12px' }}>Proveedor</th>
                    <th style={{ padding: '12px' }}>Categoría</th>
                    <th style={{ padding: '12px' }}>Descripción</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Ingreso</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Egreso</th>
                  </tr>
                </thead>
                <tbody>
                  {cajaFiltrada.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: tema.textMuted }}>No se encontraron registros coincidentes.</td>
                    </tr>
                  ) : (
                    cajaFiltrada.map((row, index) => (
                      <tr key={row.id || index} style={{ borderBottom: `1px solid ${tema.border}` }}>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{row.fecha || '-'}</td>
                        <td style={{ padding: '12px', fontWeight: '600' }}>{row.proveedor || '-'}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: modoOscuro ? '#334155' : '#e2e8f0', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem' }}>
                            {row.categoria || 'General'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: tema.textMuted, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.descripcion || '-'}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#16a34a' }}>{row.ingreso || ''}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#e11d48' }}>{row.egreso || ''}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA 0: DASHBOARD EJECUTIVO */}
        {vista === 'dashboard' && (
          <div>
            <h3 style={{ color: modoOscuro ? '#38bdf8' : '#224248', fontSize: '1.2rem', fontWeight: '700', marginBottom: '6px' }}>
              📊 Panel de Métricas Ejecutivas
            </h3>
            <p style={{ fontSize: '0.85rem', color: tema.textMuted, marginBottom: '20px' }}>
              Resumen en tiempo real del estado financiero y control de gastos de la empresa.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              
              <div style={{ background: tema.bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${tema.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: tema.textMuted, textTransform: 'uppercase' }}>Gasto Total Pagado</span>
                <h2 style={{ margin: '8px 0 0 0', fontSize: '1.8rem', color: '#16a34a' }}>
                  S/. {gastoTotalAcumulado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>

              <div style={{ background: tema.bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${tema.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: tema.textMuted, textTransform: 'uppercase' }}>Facturas Procesadas</span>
                <h2 style={{ margin: '8px 0 0 0', fontSize: '1.8rem', color: modoOscuro ? '#38bdf8' : '#224248' }}>
                  {pagosRealizados.length}
                </h2>
              </div>

              <div style={{ background: tema.bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${tema.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: tema.textMuted, textTransform: 'uppercase' }}>Por Pagar / Aprobados</span>
                <h2 style={{ margin: '8px 0 0 0', fontSize: '1.8rem', color: '#0369a1' }}>
                  {pagos.filter(p => p.estado === 'Por Pagar').length}
                </h2>
              </div>

            </div>

            {/* Desglose por Proyectos */}
            <div style={{ background: tema.bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${tema.border}`, marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '1rem', color: modoOscuro ? '#38bdf8' : '#224248' }}>
                📂 Gasto Acumulado por Proyecto
              </h4>
              {Object.keys(gastosPorProyecto).length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: tema.textMuted, margin: 0 }}>No hay pagos registrados aún para graficar.</p>
              ) : (
                Object.entries(gastosPorProyecto).map(([proj, monto]) => {
                  const porcentaje = gastoTotalAcumulado > 0 ? (monto / gastoTotalAcumulado) * 100 : 0;
                  return (
                    <div key={proj} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                        <span><b>{proj}</b></span>
                        <span style={{ fontWeight: '600' }}>S/. {monto.toFixed(2)} ({porcentaje.toFixed(1)}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: tema.cardAlt, borderRadius: '4px', overflow: 'hidden', border: `1px solid ${tema.border}` }}>
                        <div style={{ width: `${porcentaje}%`, height: '100%', backgroundColor: '#224248', borderRadius: '4px' }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desglose por Proveedores */}
            <div style={{ background: tema.bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${tema.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '1rem', color: modoOscuro ? '#38bdf8' : '#224248' }}>
                🏢 Gasto por Proveedor Principal
              </h4>
              {Object.keys(gastosPorProveedor).length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: tema.textMuted, margin: 0 }}>No hay pagos registrados aún.</p>
              ) : (
                Object.entries(gastosPorProveedor).map(([prov, monto]) => (
                  <div key={prov} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${tema.border}`, fontSize: '0.9rem' }}>
                    <span>📍 {prov}</span>
                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>S/. {monto.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* VISTA 1: SUBIR PAGO */}
        {vista === 'subir' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: tema.bgCard, color: tema.textMain, padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${tema.border}` }}>
            <h3 style={{ margin: '0 0 10px 0', color: modoOscuro ? '#38bdf8' : '#224248', fontSize: '1.1rem', fontWeight: '600' }}>Registrar Nuevo Gasto y Factura</h3>
            
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: tema.textMuted }}>Producto o Servicio *</label>
            <input type="text" value={producto} onChange={(e) => setProducto(e.target.value)} placeholder="Ej. Resmas de papel" required style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, fontSize: '0.9rem' }} />

            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: tema.textMuted }}>Proveedor *</label>
            <input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej. Tai Loy" required style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, fontSize: '0.9rem' }} />

            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: tema.textMuted }}>Proyecto Destinado</label>
            <input type="text" value={proyecto} onChange={(e) => setProyecto(e.target.value)} placeholder="Nombre del proyecto" style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, fontSize: '0.9rem' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: tema.cardAlt, padding: '10px 14px', borderRadius: '8px', border: `1px solid ${tema.border}` }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: tema.textMuted }}>¿Incluye / Calcular IGV (18%)?</span>
              <input 
                type="checkbox" 
                checked={aplicarIgv} 
                onChange={(e) => setAplicarIgv(e.target.checked)} 
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#224248' }} 
              />
            </div>

            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: tema.textMuted }}>
              {aplicarIgv ? 'Monto Base (Sin IGV) *' : 'Monto Total del Gasto *'}
            </label>
            <input type="number" step="0.01" value={montoIngresado} onChange={(e) => setMontoIngresado(e.target.value)} placeholder="0.00" required style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, fontSize: '0.9rem' }} />

            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: tema.textMuted }}>
              {aplicarIgv ? 'Precio Total con IGV (Cálculo Automático 18%):' : 'Precio Final a Pagar (Sin IGV):'}
            </label>
            <input type="text" value={`S/. ${precioFinalCalculado}`} disabled style={{ backgroundColor: modoOscuro ? '#0b1329' : '#f1f5f9', fontWeight: 'bold', padding: '10px', borderRadius: '8px', border: `1px solid ${tema.border}`, color: modoOscuro ? '#38bdf8' : '#224248' }} />

            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: tema.textMuted }}>Adjuntar Factura o Recibo (PDF o Foto) *</label>
            <input 
              type="file" 
              accept="image/*,.pdf" 
              onChange={(e) => setArchivo(e.target.files[0])} 
              style={{ padding: '8px', border: `1px dashed ${tema.border}`, borderRadius: '8px', fontSize: '0.85rem', backgroundColor: tema.cardAlt }} 
            />
            {archivo && <small style={{ color: '#16a34a', fontWeight: '500' }}>Archivo seleccionado: {archivo.name}</small>}

            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: tema.textMuted }}>Descripción</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Detalles adicionales..." rows="3" style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, fontSize: '0.9rem', fontFamily: 'inherit' }} />

            <button type="submit" disabled={cargando} style={{ backgroundColor: '#224248', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', marginTop: '8px', transition: 'opacity 0.2s' }}>
              {cargando ? 'Subiendo a la nube...' : 'Enviar Pago y Factura'}
            </button>
          </form>
        )}

        {/* VISTA 2: POR PAGAR */}
        {vista === 'porPagar' && (
          <div>
            <h3 style={{ color: modoOscuro ? '#38bdf8' : '#224248', fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px' }}>Facturas Por Pagar</h3>
            {pagos.filter(p => p.estado === 'Por Pagar').length === 0 ? (
              <p style={{ color: tema.textMuted, background: tema.bgCard, padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${tema.border}` }}>No hay facturas listas para pagar.</p>
            ) : (
              pagos.filter(p => p.estado === 'Por Pagar').map(p => (
                <div key={p.id} style={{ border: `1px solid ${tema.border}`, padding: '18px', borderRadius: '12px', marginBottom: '12px', background: tema.bgCard, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <p style={{ margin: '0 0 10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ background: '#bae6fd', color: '#0369a1', padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', display: 'inline-block' }}>
                      📋 {p.codigo_unico} (Por Pagar)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: tema.textMuted, fontSize: '12px' }}>{p.fecha_legible}</span>
                      <button 
                        onClick={() => eliminarPago(p.id, p.codigo_unico)} 
                        title="Eliminar registro"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '2px' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </p>
                  <p style={{ margin: '6px 0' }}><b>Producto:</b> {p.producto}</p>
                  <p style={{ margin: '6px 0' }}><b>Proveedor:</b> {p.proveedor}</p>
                  <p style={{ margin: '6px 0' }}><b>Proyecto:</b> {p.proyecto}</p>
                  <p style={{ margin: '6px 0' }}><b>Total a Pagar:</b> <span style={{ color: modoOscuro ? '#38bdf8' : '#224248', fontWeight: 'bold' }}>S/. {p.precio_con_igv}</span></p>
                  <p style={{ margin: '6px 0' }}><b>Registrado por:</b> <span style={{ color: '#0284c7', fontWeight: '600' }}>{p.registrado_por || 'Anónimo'}</span></p>
                  <p style={{ margin: '6px 0' }}>
                    <b>Factura:</b> {p.url_archivo ? <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>📄 Ver / Descargar ({p.nombre_archivo})</a> : p.nombre_archivo}
                  </p>
                  <button onClick={() => cambiarEstado(p.id, 'Pagado')} style={{ backgroundColor: '#d4e036', color: '#1e293b', padding: '8px 14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', marginTop: '10px' }}>
                    Marcar como Pagado
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* VISTA 3: HISTORIAL CON DISEÑO ESTÉTICO COMPLETO */}
        {vista === 'historial' && (
          <div>
            <h3 style={{ color: modoOscuro ? '#38bdf8' : '#224248', fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px' }}>Historial de Pagos Realizados</h3>
            
            {/* Contenedor de Filtros */}
            <div style={{ background: tema.bgCard, padding: '16px', borderRadius: '12px', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', border: `1px solid ${tema.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div>
                <label style={{ fontSize: '0.8rem', display: 'block', fontWeight: '600', color: tema.textMuted, marginBottom: '4px' }}>Desde:</label>
                <input type="date" value={filtroFechaInicio} onChange={(e) => setFiltroFechaInicio(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', display: 'block', fontWeight: '600', color: tema.textMuted, marginBottom: '4px' }}>Hasta:</label>
                <input type="date" value={filtroFechaFin} onChange={(e) => setFiltroFechaFin(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor }} />
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '0.8rem', display: 'block', fontWeight: '600', color: tema.textMuted, marginBottom: '4px' }}>Buscar:</label>
                <input type="text" placeholder="Buscar por código, proveedor, proyecto..." value={filtroBusqueda} onChange={(e) => setFiltroBusqueda(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={exportarAExcel} style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>
                  📥 Exportar Excel
                </button>
              </div>
            </div>

            {pagosFiltrados.length === 0 ? (
              <p style={{ color: tema.textMuted, background: tema.bgCard, padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${tema.border}` }}>No hay pagos registrados con los filtros seleccionados.</p>
            ) : (
              pagosFiltrados.map(p => (
                <div key={p.id} style={{ border: `1px solid ${tema.border}`, padding: '18px', borderRadius: '12px', marginBottom: '12px', background: tema.bgCard, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <p style={{ margin: '0 0 10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', display: 'inline-block' }}>
                      ✅ {p.codigo_unico} (Pagado)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: tema.textMuted, fontSize: '12px' }}>{p.fecha_legible}</span>
                      <button 
                        onClick={() => eliminarPago(p.id, p.codigo_unico)} 
                        title="Eliminar registro"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '2px' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </p>
                  <p style={{ margin: '6px 0' }}><b>Producto:</b> {p.producto}</p>
                  <p style={{ margin: '6px 0' }}><b>Proveedor:</b> {p.proveedor}</p>
                  <p style={{ margin: '6px 0' }}><b>Proyecto:</b> {p.proyecto}</p>
                  <p style={{ margin: '6px 0' }}><b>Total Pagado:</b> <span style={{ color: '#16a34a', fontWeight: 'bold' }}>S/. {p.precio_con_igv}</span></p>
                  <p style={{ margin: '6px 0' }}><b>Registrado por:</b> <span style={{ color: '#0284c7', fontWeight: '600' }}>{p.registrado_por || 'Anónimo'}</span></p>
                  <p style={{ margin: '6px 0' }}>
                    <b>Factura:</b> {p.url_archivo ? <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>📄 Ver / Descargar ({p.nombre_archivo})</a> : p.nombre_archivo}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* VISTA 4: ASISTENTE IA */}
        {vista === 'asistente' && (
          <div>
            <h3 style={{ color: modoOscuro ? '#38bdf8' : '#224248', fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px' }}>🤖 Asistente Inteligente</h3>
            <div style={{ background: tema.bgCard, padding: '16px', borderRadius: '12px', marginBottom: '16px', border: `1px solid ${tema.border}` }}>
              <input 
                type="text" 
                placeholder="Pregúntale al asistente (ej. Tai Loy, proyecto X, etc.)..." 
                value={busquedaInteligente}
                onChange={(e) => setBusquedaInteligente(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${tema.border}`, backgroundColor: tema.inputBg, color: tema.inputColor, boxSizing: 'border-box' }}
              />
            </div>
            {pagosBusquedaInteligente.map(p => (
              <div key={p.id} style={{ border: `1px solid ${tema.border}`, padding: '18px', borderRadius: '12px', marginBottom: '12px', background: tema.bgCard, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: '0 0 10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ 
                    background: p.estado === 'Pagado' ? '#dcfce7' : '#bae6fd', 
                    color: p.estado === 'Pagado' ? '#16a34a' : '#0369a1', 
                    padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', display: 'inline-block' 
                  }}>
                    {p.estado === 'Pagado' ? '✅' : '📋'} {p.codigo_unico} ({p.estado})
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: tema.textMuted, fontSize: '12px' }}>{p.fecha_legible}</span>
                    <button 
                      onClick={() => eliminarPago(p.id, p.codigo_unico)} 
                      title="Eliminar registro"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '2px' }}
                    >
                      🗑️
                    </button>
                  </div>
                </p>
                <p style={{ margin: '6px 0' }}><b>Producto:</b> {p.producto}</p>
                <p style={{ margin: '6px 0' }}><b>Proveedor:</b> {p.proveedor}</p>
                <p style={{ margin: '6px 0' }}><b>Proyecto:</b> {p.proyecto}</p>
                <p style={{ margin: '6px 0' }}><b>Total:</b> <span style={{ color: p.estado === 'Pagado' ? '#16a34a' : (modoOscuro ? '#38bdf8' : '#224248'), fontWeight: 'bold' }}>S/. {p.precio_con_igv}</span></p>
                <p style={{ margin: '6px 0' }}><b>Registrado por:</b> <span style={{ color: '#0284c7', fontWeight: '600' }}>{p.registrado_por || 'Anónimo'}</span></p>
                <p style={{ margin: '6px 0' }}>
                  <b>Factura:</b> {p.url_archivo ? <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>📄 Ver / Descargar ({p.nombre_archivo})</a> : p.nombre_archivo}
                </p>
                {p.estado === 'Por Pagar' && (
                  <button onClick={() => cambiarEstado(p.id, 'Pagado')} style={{ backgroundColor: '#d4e036', color: '#1e293b', padding: '8px 14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', marginTop: '10px' }}>
                    Marcar como Pagado
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;