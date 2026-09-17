import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { CAMPOS_PERMISOS, PERMISOS_VACIOS } from '../permissions';

// Agrupa los campos de permisos por su "grupo" (Clientes, Proyectos, etc.)
function agruparCampos() {
  const grupos = {};
  CAMPOS_PERMISOS.forEach(campo => {
    if (!grupos[campo.grupo]) grupos[campo.grupo] = [];
    grupos[campo.grupo].push(campo);
  });
  return grupos;
}

function BloquePermisos({ usuario, permisos, esGonzalo, guardando, onGuardar }) {
  const base = permisos || { ...PERMISOS_VACIOS };
  const [borrador, setBorrador] = useState(base);
  const [editando, setEditando] = useState(false);
  const grupos = agruparCampos();

  useEffect(() => { setBorrador(base); }, [permisos]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiado = JSON.stringify(borrador) !== JSON.stringify(base);

  const alternar = (key) => {
    if (esGonzalo) return;
    setBorrador(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const guardar = async () => {
    await onGuardar(usuario, borrador);
    setEditando(false);
  };

  const cancelar = () => {
    setBorrador(base);
    setEditando(false);
  };

  return (
    <div className="role-permisos-groups">
      {Object.entries(grupos).map(([grupo, campos]) => (
        <div key={grupo} className="role-permisos-group">
          <span className="role-group-title">{grupo}</span>
          <div className="role-permisos-grid">
            {campos.map(campo => (
              <label
                key={campo.key}
                className={`checkbox-label role-permiso-item ${esGonzalo ? 'disabled' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={esGonzalo ? true : !!borrador[campo.key]}
                  disabled={esGonzalo || !editando}
                  onChange={() => alternar(campo.key)}
                />
                {campo.label}
              </label>
            ))}
          </div>
        </div>
      ))}

      {!esGonzalo && (
        <div className="modal-actions" style={{ marginTop: 4 }}>
          {editando ? (
            <>
              <button type="button" className="btn-secondary" onClick={cancelar}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={guardar} disabled={guardando || !cambiado}>
                {guardando ? 'Guardando...' : 'Guardar permisos'}
              </button>
            </>
          ) : (
            <button type="button" className="btn-muted" onClick={() => setEditando(true)}>✏️ Editar permisos</button>
          )}
        </div>
      )}
    </div>
  );
}

function TarjetaUsuario({ usuario, permisos, guardandoPermisos, onGuardarPermisos, onCambiarPassword, onToggleActivo, onEliminar, procesando }) {
  const esGonzalo = usuario.usuario === 'gonzalo';
  const [passwordNueva, setPasswordNueva] = useState('');
  const [mostrandoPassword, setMostrandoPassword] = useState(false);

  const enviarPassword = async (e) => {
    e.preventDefault();
    if (passwordNueva.trim().length < 4) return alert('La contraseña debe tener al menos 4 caracteres.');
    await onCambiarPassword(usuario.usuario, passwordNueva.trim());
    setPasswordNueva('');
    setMostrandoPassword(false);
  };

  return (
    <div className="glass-card form-card role-card">
      <div className="section-header role-card-head">
        <div>
          <h4 className="panel-title" style={{ margin: 0, textTransform: 'capitalize' }}>
            {usuario.usuario}{' '}
            <span className="code-tag tag-paid" style={{ marginLeft: 8 }}>{usuario.rol_label}</span>
            <span className={`code-tag ${usuario.activo ? 'tag-paid' : 'tag-pending'}`} style={{ marginLeft: 6 }}>
              {usuario.activo ? 'Activo' : 'Desactivado'}
            </span>
          </h4>
          {esGonzalo && (
            <p className="panel-note" style={{ marginTop: 6 }}>
              Acceso total fijo — HEAD ADMIN siempre puede hacer todo, incluyendo gestionar roles. No se puede desactivar ni eliminar.
            </p>
          )}
        </div>
        {!esGonzalo && (
          <div className="record-actions">
            <button
              type="button"
              className={usuario.activo ? 'btn-delete' : 'btn-approve'}
              disabled={procesando}
              onClick={() => onToggleActivo(usuario.usuario, usuario.activo)}
            >
              {usuario.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button type="button" className="btn-delete" disabled={procesando} onClick={() => onEliminar(usuario.usuario)}>
              🗑️ Eliminar
            </button>
          </div>
        )}
      </div>

      <div className="role-password-row">
        {mostrandoPassword ? (
          <form onSubmit={enviarPassword} className="role-password-form">
            <input
              type="password"
              placeholder="Nueva contraseña (mín. 4 caracteres)"
              value={passwordNueva}
              onChange={e => setPasswordNueva(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary btn-small">Guardar</button>
            <button type="button" className="btn-secondary btn-small" onClick={() => { setMostrandoPassword(false); setPasswordNueva(''); }}>Cancelar</button>
          </form>
        ) : (
          <button type="button" className="btn-muted" onClick={() => setMostrandoPassword(true)}>🔑 Cambiar contraseña</button>
        )}
      </div>

      <BloquePermisos
        usuario={usuario.usuario}
        permisos={permisos}
        esGonzalo={esGonzalo}
        guardando={guardandoPermisos}
        onGuardar={onGuardarPermisos}
      />
    </div>
  );
}

export function GestionRoles({ usuarioActual, onNotify, onAudit, onCambio }) {
  const [usuarios, setUsuarios] = useState([]);
  const [permisosMapa, setPermisosMapa] = useState({});
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorSistema, setErrorSistema] = useState('');
  const [guardandoUsuario, setGuardandoUsuario] = useState(null);
  const [procesandoUsuario, setProcesandoUsuario] = useState(null);

  const [formNuevo, setFormNuevo] = useState({ usuario: '', password: '', rol_label: '' });
  const [creando, setCreando] = useState(false);

  const cargarTodo = async () => {
    setCargandoLista(true);
    setErrorSistema('');
    try {
      const [{ data: listaUsuarios, error: eu }, { data: listaPermisos, error: ep }] = await Promise.all([
        supabase.rpc('listar_usuarios'),
        supabase.from('roles_permisos').select('*'),
      ]);
      if (eu) throw eu;
      if (ep) throw ep;
      setUsuarios(listaUsuarios || []);
      const mapa = {};
      (listaPermisos || []).forEach(fila => { mapa[fila.usuario] = { rol_label: fila.rol_label, ...fila.permisos }; });
      setPermisosMapa(mapa);
    } catch (err) {
      console.error(err);
      setErrorSistema(
        'No se pudo cargar la gestión de usuarios desde Supabase. Es probable que falte ejecutar ' +
        'el archivo supabase_usuarios_v15.sql (y supabase_roles_v14.sql) en el SQL Editor de Supabase.'
      );
    } finally {
      setCargandoLista(false);
    }
  };

  useEffect(() => { cargarTodo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const crearUsuario = async (e) => {
    e.preventDefault();
    const usuarioLimpio = formNuevo.usuario.trim().toLowerCase();
    if (!usuarioLimpio) return alert('Escribe el nombre de usuario.');
    if (formNuevo.password.trim().length < 4) return alert('La contraseña debe tener al menos 4 caracteres.');
    setCreando(true);
    try {
      const { error } = await supabase.rpc('crear_usuario', {
        p_usuario: usuarioLimpio,
        p_password: formNuevo.password.trim(),
        p_rol_label: formNuevo.rol_label.trim() || 'Usuario',
        p_actor: usuarioActual,
      });
      if (error) throw error;
      onNotify?.(`Nuevo usuario creado: ${usuarioLimpio}`, 'nuevo');
      onAudit?.('Creación', `Roles y Permisos · usuario creado: ${usuarioLimpio}`);
      setFormNuevo({ usuario: '', password: '', rol_label: '' });
      await cargarTodo();
      onCambio?.();
    } catch (err) {
      alert(`No se pudo crear el usuario. ${err?.message || ''}`);
    } finally {
      setCreando(false);
    }
  };

  const cambiarPassword = async (usuario, passwordNueva) => {
    try {
      const { error } = await supabase.rpc('cambiar_password', {
        p_usuario: usuario, p_password_nueva: passwordNueva, p_actor: usuarioActual,
      });
      if (error) throw error;
      onNotify?.(`Contraseña actualizada para ${usuario}`, 'edicion');
      onAudit?.('Edición', `Roles y Permisos · contraseña actualizada: ${usuario}`);
    } catch (err) {
      alert(`No se pudo cambiar la contraseña. ${err?.message || ''}`);
    }
  };

  const toggleActivo = async (usuario, activo) => {
    setProcesandoUsuario(usuario);
    try {
      const { error } = await supabase.rpc('set_estado_usuario', {
        p_usuario: usuario, p_activo: !activo, p_actor: usuarioActual,
      });
      if (error) throw error;
      onAudit?.('Edición', `Roles y Permisos · ${usuario} ${!activo ? 'activado' : 'desactivado'}`);
      await cargarTodo();
      onCambio?.();
    } catch (err) {
      alert(`No se pudo actualizar el estado. ${err?.message || ''}`);
    } finally {
      setProcesandoUsuario(null);
    }
  };

  const eliminarUsuario = async (usuario) => {
    const ok = window.confirm(`¿Eliminar al usuario "${usuario}"? No podrá volver a iniciar sesión y esta acción no se puede deshacer.`);
    if (!ok) return;
    setProcesandoUsuario(usuario);
    try {
      const { error } = await supabase.rpc('eliminar_usuario', { p_usuario: usuario });
      if (error) throw error;
      onNotify?.(`Usuario eliminado: ${usuario}`, 'eliminado');
      onAudit?.('Eliminación', `Roles y Permisos · usuario eliminado: ${usuario}`);
      await cargarTodo();
      onCambio?.();
    } catch (err) {
      alert(`No se pudo eliminar el usuario. ${err?.message || ''}`);
    } finally {
      setProcesandoUsuario(null);
    }
  };

  const guardarPermisos = async (usuario, nuevosPermisos) => {
    setGuardandoUsuario(usuario);
    try {
      const { rol_label, ...resto } = nuevosPermisos;
      const { error } = await supabase.from('roles_permisos').upsert({
        usuario,
        rol_label: rol_label || 'Usuario',
        permisos: resto,
        updated_by: usuarioActual,
      });
      if (error) throw error;
      onNotify?.(`Permisos actualizados para ${usuario}`, 'edicion');
      onAudit?.('Edición', `Roles y Permisos · ${usuario} actualizado por ${usuarioActual}`);
      await cargarTodo();
      onCambio?.();
    } catch (err) {
      alert(`No se pudo guardar los permisos. ${err?.message || ''}`);
    } finally {
      setGuardandoUsuario(null);
    }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h3 className="section-title">🔐 Roles y Permisos</h3>
          <p className="panel-note">
            Crea usuarios, cambia contraseñas, activa/desactiva accesos y controla qué puede ver y
            hacer cada uno en Clientes, Proyectos y Cotizaciones. Solo HEAD ADMIN entra a este apartado.
          </p>
        </div>
      </div>

      {errorSistema && (
        <div className="glass-card form-card" style={{ marginBottom: 18 }}>
          <p className="record-note" style={{ color: '#ef4444' }}>{errorSistema}</p>
        </div>
      )}

      <div className="glass-card form-card" style={{ marginBottom: 18 }}>
        <h4 className="panel-title">➕ Agregar nuevo usuario</h4>
        <form onSubmit={crearUsuario} className="form-grid-2" style={{ alignItems: 'end' }}>
          <div className="form-row">
            <label>Usuario *</label>
            <input
              value={formNuevo.usuario}
              onChange={e => setFormNuevo({ ...formNuevo, usuario: e.target.value })}
              placeholder="Ej. carla"
              required
            />
          </div>
          <div className="form-row">
            <label>Contraseña *</label>
            <input
              type="text"
              value={formNuevo.password}
              onChange={e => setFormNuevo({ ...formNuevo, password: e.target.value })}
              placeholder="Mínimo 4 caracteres"
              required
            />
          </div>
          <div className="form-row">
            <label>Rol / cargo (texto libre)</label>
            <input
              value={formNuevo.rol_label}
              onChange={e => setFormNuevo({ ...formNuevo, rol_label: e.target.value })}
              placeholder="Ej. Asistente Comercial"
            />
          </div>
          <div className="form-row">
            <button type="submit" className="btn-primary" disabled={creando}>
              {creando ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
        <p className="panel-note" style={{ marginTop: 4 }}>
          El usuario nuevo nace sin ningún permiso activado; actívalos abajo en su tarjeta.
        </p>
      </div>

      {cargandoLista ? (
        <p className="empty-hint">Cargando usuarios...</p>
      ) : (
        <div className="roles-grid">
          {usuarios.map(u => (
            <TarjetaUsuario
              key={u.usuario}
              usuario={u}
              permisos={permisosMapa[u.usuario]}
              guardandoPermisos={guardandoUsuario === u.usuario}
              onGuardarPermisos={guardarPermisos}
              onCambiarPassword={cambiarPassword}
              onToggleActivo={toggleActivo}
              onEliminar={eliminarUsuario}
              procesando={procesandoUsuario === u.usuario}
            />
          ))}
        </div>
      )}
    </div>
  );
}
