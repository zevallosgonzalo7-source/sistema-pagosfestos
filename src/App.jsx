import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import OneSignal from 'react-onesignal';
import './App.css';

function App() {
  const [vista, setVista] = useState('subir'); 
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Campos del formulario
  const [producto, setProducto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [montoIngresado, setMontoIngresado] = useState('');
  const [aplicarIgv, setAplicarIgv] = useState(true); // Control para activar/desactivar el IGV
  const [descripcion, setDescripcion] = useState('');
  const [proyecto, setProyecto] = useState('');
  const [archivo, setArchivo] = useState(null);

  // Filtros de fecha para el Historial
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');

  // Cálculo condicional del IGV (18%) o monto directo
  const valorBase = parseFloat(montoIngresado) || 0;
  const precioFinalCalculado = aplicarIgv ? (valorBase * 1.18).toFixed(2) : valorBase.toFixed(2);

  // Inicializar OneSignal para Notificaciones Push
  useEffect(() => {
    OneSignal.init({
      appId: "ef5bdb2f-ce76-4f50-b664-071d1c526642",
      allowLocalhostAsSecureOrigin: true, // Permite probar en localhost sin HTTPS
    }).then(() => {
      // Solicita permisos de notificación al usuario
      OneSignal.SlidedefaultPrompt.showPrompt();
    });
  }, []);

  useEffect(() => {
    obtenerPagos();
  }, []);

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

        // 1. Subir archivo al Storage de Supabase
        const { error: uploadError } = await supabase.storage
          .from('facturas')
          .upload(fileName, archivo);

        if (uploadError) throw uploadError;

        // 2. Obtener la URL pública
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
        estado: 'Pendiente',
        fecha_creacion: fechaActualStr,
        fecha_legible: new Date().toLocaleDateString()
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
      setVista('pendientes');

    } catch (error) {
      console.error(error);
      alert('Hubo un error al subir el pago o la factura.');
      setCargando(false);
    }
  };

  const cambiarEstado = async (id, nuevoEstado) => {
    const { error } = await supabase
      .from('pagos')
      .update({ estado: nuevoEstado })
      .eq('id', id);

    if (error) {
      alert('Error al actualizar el estado');
    } else {
      obtenerPagos();
    }
  };

  const pagosFiltrados = pagos.filter(p => {
    if (p.estado !== 'Pagado') return false;
    if (filtroFechaInicio && p.fecha_creacion < filtroFechaInicio) return false;
    if (filtroFechaFin && p.fecha_creacion > filtroFechaFin) return false;
    return true;
  });

  return (
    <div style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#1e293b', paddingBottom: '40px' }}>
      
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
        <div style={{ backgroundColor: '#d4e036', color: '#1e293b', fontWeight: '700', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.8rem' }}>
          FESTOS
        </div>
      </header>

      <div style={{ maxWidth: '750px', margin: '30px auto', padding: '0 16px' }}>
        
        {/* Menú de Navegación Estilizado */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '24px', backgroundColor: '#ffffff', padding: '8px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
          <button 
            onClick={() => setVista('subir')} 
            style={{ 
              fontWeight: vista === 'subir' ? '600' : '400', 
              padding: '8px 14px', 
              borderRadius: '8px', 
              border: 'none', 
              cursor: 'pointer',
              backgroundColor: vista === 'subir' ? '#224248' : 'transparent',
              color: vista === 'subir' ? '#ffffff' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            Subir Pago
          </button>
          
          <button 
            onClick={() => setVista('pendientes')} 
            style={{ 
              fontWeight: vista === 'pendientes' ? '600' : '400', 
              padding: '8px 14px', 
              borderRadius: '8px', 
              border: 'none', 
              cursor: 'pointer',
              backgroundColor: vista === 'pendientes' ? '#224248' : 'transparent',
              color: vista === 'pendientes' ? '#ffffff' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            Pendientes ({pagos.filter(p => p.estado === 'Pendiente').length})
          </button>

          <button 
            onClick={() => setVista('porPagar')} 
            style={{ 
              fontWeight: vista === 'porPagar' ? '600' : '400', 
              padding: '8px 14px', 
              borderRadius: '8px', 
              border: 'none', 
              cursor: 'pointer',
              backgroundColor: vista === 'porPagar' ? '#224248' : 'transparent',
              color: vista === 'porPagar' ? '#ffffff' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            Por Pagar ({pagos.filter(p => p.estado === 'Por Pagar').length})
          </button>

          <button 
            onClick={() => setVista('historial')} 
            style={{ 
              fontWeight: vista === 'historial' ? '600' : '400', 
              padding: '8px 14px', 
              borderRadius: '8px', 
              border: 'none', 
              cursor: 'pointer',
              backgroundColor: vista === 'historial' ? '#224248' : 'transparent',
              color: vista === 'historial' ? '#ffffff' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            Historial 📂
          </button>
        </div>

        {/* VISTA 1: SUBIR PAGO */}
        {vista === 'subir' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#224248', fontSize: '1.1rem', fontWeight: '600' }}>Registrar Nuevo Gasto y Factura</h3>
            
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Producto o Servicio *</label>
            <input type="text" value={producto} onChange={(e) => setProducto(e.target.value)} placeholder="Ej. Resmas de papel" required style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} />

            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Proveedor *</label>
            <input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej. Tai Loy" required style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} />

            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Proyecto Destinado</label>
            <input type="text" value={proyecto} onChange={(e) => setProyecto(e.target.value)} placeholder="Nombre del proyecto" style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} />

            {/* Selector de IGV */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>¿Incluye / Calcular IGV (18%)?</span>
              <input 
                type="checkbox" 
                checked={aplicarIgv} 
                onChange={(e) => setAplicarIgv(e.target.checked)} 
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#224248' }} 
              />
            </div>

            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
              {aplicarIgv ? 'Monto Base (Sin IGV) *' : 'Monto Total del Gasto *'}
            </label>
            <input type="number" step="0.01" value={montoIngresado} onChange={(e) => setMontoIngresado(e.target.value)} placeholder="0.00" required style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} />

            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
              {aplicarIgv ? 'Precio Total con IGV (Cálculo Automático 18%):' : 'Precio Final a Pagar (Sin IGV):'}
            </label>
            <input type="text" value={`S/. ${precioFinalCalculado}`} disabled style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#224248' }} />

            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Adjuntar Factura o Recibo (PDF o Foto) *</label>
            <input 
              type="file" 
              accept="image/*,.pdf" 
              onChange={(e) => setArchivo(e.target.files[0])} 
              style={{ padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', backgroundColor: '#f8fafc' }} 
            />
            {archivo && <small style={{ color: '#16a34a', fontWeight: '500' }}>Archivo seleccionado: {archivo.name}</small>}

            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Descripción</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Detalles adicionales..." rows="3" style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontFamily: 'inherit' }} />

            <button type="submit" disabled={cargando} style={{ backgroundColor: '#224248', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', marginTop: '8px', transition: 'opacity 0.2s' }}>
              {cargando ? 'Subiendo a la nube...' : 'Enviar Pago y Factura'}
            </button>
          </form>
        )}

        {/* VISTA 2: PENDIENTES */}
        {vista === 'pendientes' && (
          <div>
            <h3 style={{ color: '#224248', fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px' }}>Facturas Pendientes de Revisión</h3>
            {pagos.filter(p => p.estado === 'Pendiente').length === 0 ? (
              <p style={{ color: '#64748b', background: '#fff', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>No hay facturas pendientes.</p>
            ) : (
              pagos.filter(p => p.estado === 'Pendiente').map(p => (
                <div key={p.id} style={{ border: '1px solid #e2e8f0', padding: '18px', borderRadius: '12px', marginBottom: '12px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <p style={{ margin: '0 0 10px 0' }}>
                    <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>{p.codigo_unico}</span> 
                    <span style={{ float: 'right', color: '#64748b', fontSize: '12px' }}>{p.fecha_legible}</span>
                  </p>
                  <p style={{ margin: '6px 0' }}><b>Producto:</b> {p.producto}</p>
                  <p style={{ margin: '6px 0' }}><b>Proveedor:</b> {p.proveedor}</p>
                  <p style={{ margin: '6px 0' }}><b>Proyecto:</b> {p.proyecto}</p>
                  <p style={{ margin: '6px 0' }}><b>Monto Total:</b> <span style={{ color: '#224248', fontWeight: 'bold' }}>S/. {p.precio_con_igv}</span></p>
                  <p style={{ margin: '6px 0' }}>
                    <b>Factura:</b> {p.url_archivo ? <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>📄 Ver / Descargar ({p.nombre_archivo})</a> : p.nombre_archivo}
                  </p>
                  <p style={{ margin: '6px 0 14px 0' }}><b>Descripción:</b> {p.descripcion || 'Sin descripción'}</p>
                  <button onClick={() => cambiarEstado(p.id, 'Por Pagar')} style={{ backgroundColor: '#16a34a', color: 'white', padding: '8px 14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>
                    Aprobar (Mandar a Por Pagar)
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* VISTA 3: POR PAGAR */}
        {vista === 'porPagar' && (
          <div>
            <h3 style={{ color: '#224248', fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px' }}>Facturas Por Pagar (Aprobadas)</h3>
            {pagos.filter(p => p.estado === 'Por Pagar').length === 0 ? (
              <p style={{ color: '#64748b', background: '#fff', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>No hay facturas listas para pagar.</p>
            ) : (
              pagos.filter(p => p.estado === 'Por Pagar').map(p => (
                <div key={p.id} style={{ border: '1px solid #e2e8f0', padding: '18px', borderRadius: '12px', marginBottom: '12px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <p style={{ margin: '0 0 10px 0' }}>
                    <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>{p.codigo_unico}</span> 
                    <span style={{ float: 'right', color: '#64748b', fontSize: '12px' }}>{p.fecha_legible}</span>
                  </p>
                  <p style={{ margin: '6px 0' }}><b>Producto:</b> {p.producto}</p>
                  <p style={{ margin: '6px 0' }}><b>Proveedor:</b> {p.proveedor}</p>
                  <p style={{ margin: '6px 0' }}><b>Proyecto:</b> {p.proyecto}</p>
                  <p style={{ margin: '6px 0' }}><b>Total a Pagar:</b> <span style={{ color: '#224248', fontWeight: 'bold' }}>S/. {p.precio_con_igv}</span></p>
                  <p style={{ margin: '6px 0' }}>
                    <b>Factura:</b> {p.url_archivo ? <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>📄 Ver / Descargar ({p.nombre_archivo})</a> : p.nombre_archivo}
                  </p>
                  <button onClick={() => cambiarEstado(p.id, 'Pagado')} style={{ backgroundColor: '#d4e036', color: '#1e293b', padding: '8px 14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', marginTop: '10px' }}>
                    Marcar como Pagado
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* VISTA 4: HISTORIAL */}
        {vista === 'historial' && (
          <div>
            <h3 style={{ color: '#224248', fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px' }}>Historial de Pagos Realizados</h3>
            
            <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div>
                <label style={{ fontSize: '0.8rem', display: 'block', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Desde:</label>
                <input type="date" value={filtroFechaInicio} onChange={(e) => setFiltroFechaInicio(e.target.value)} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', display: 'block', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Hasta:</label>
                <input type="date" value={filtroFechaFin} onChange={(e) => setFiltroFechaFin(e.target.value)} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              {(filtroFechaInicio || filtroFechaFin) && (
                <button onClick={() => { setFiltroFechaInicio(''); setFiltroFechaFin(''); }} style={{ marginTop: '18px', padding: '6px 12px', cursor: 'pointer', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', color: '#334155' }}>
                  Limpiar Filtros
                </button>
              )}
            </div>

            {pagosFiltrados.length === 0 ? (
              <p style={{ color: '#64748b', background: '#fff', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>No hay pagos registrados en el historial con los filtros seleccionados.</p>
            ) : (
              pagosFiltrados.map(p => (
                <div key={p.id} style={{ border: '1px solid #cbd5e0', padding: '18px', borderRadius: '12px', marginBottom: '12px', background: '#f8fafc', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <p style={{ margin: '0 0 10px 0' }}>
                    <span style={{ background: '#e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>{p.codigo_unico}</span> 
                    <span style={{ float: 'right', color: '#16a34a', fontSize: '12px', fontWeight: 'bold' }}>Pagado el {p.fecha_legible}</span>
                  </p>
                  <p style={{ margin: '6px 0' }}><b>Producto:</b> {p.producto}</p>
                  <p style={{ margin: '6px 0' }}><b>Proveedor:</b> {p.proveedor}</p>
                  <p style={{ margin: '6px 0' }}><b>Proyecto:</b> {p.proyecto}</p>
                  <p style={{ margin: '6px 0' }}><b>Total Pagado:</b> <span style={{ color: '#224248', fontWeight: 'bold' }}>S/. {p.precio_con_igv}</span></p>
                  <p style={{ margin: '6px 0' }}>
                    <b>Factura:</b> {p.url_archivo ? <a href={p.url_archivo} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>📄 Ver / Descargar ({p.nombre_archivo})</a> : p.nombre_archivo}
                  </p>
                  {p.descripcion && <p style={{ margin: '6px 0' }}><b>Descripción:</b> {p.descripcion}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;