import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { CAMPOS_PERMISOS, PERMISOS_VACIOS } from '../permissions';
import { FestosIcon } from '../FestosIcon';
import { nombreCompletoUsuario } from '../teamDirectory';

function agruparCampos() {
  const grupos = {};
  CAMPOS_PERMISOS.forEach(campo => {
    if (!grupos[campo.grupo]) grupos[campo.grupo] = [];
    grupos[campo.grupo].push(campo);
  });
  return grupos;
}

function BloquePermisos({ usuario, permisos, esGonzalo, guardando, onGuardar }) {
  const base = { ...PERMISOS_VACIOS, ...(permisos || {}) };
  const [borrador, setBorrador] = useState(base);
  const [editando, setEditando] = useState(false);
  const grupos = agruparCampos();

  useEffect(() => { setBorrador(base); }, [permisos]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiado = JSON.stringify(borrador) !== JSON.stringify(base);
  const alternar = key => {
    if (esGonzalo) return;
    setBorrador(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const guardar = async () => {
    await onGuardar(usuario, borrador);
    setEditando(false);
  };

  return (
    <div className="role-permisos-groups">
      {Object.entries(grupos).map(([grupo, campos]) => (
        <div key={grupo} className="role-permisos-group">
          <span className="role-group-title">{grupo}</span>
          <div className="role-permisos-grid">
            {campos.map(campo => {
              const activo = esGonzalo ? true : !!borrador[campo.key];
              return (
                <button
                  type="button"
                  key={campo.key}
                  className={`role-permiso-switch ${activo ? 'is-on' : ''} ${esGonzalo || !editando ? 'is-locked' : ''}`}
                  disabled={esGonzalo || !editando}
                  onClick={() => alternar(campo.key)}
                  aria-pressed={activo}
                >
                  <span className="role-permiso-copy"><strong>{campo.label}</strong><small>{activo ? 'Permitido' : 'Sin acceso'}</small></span>
                  <span className="role-switch-track" aria-hidden="true"><i /></span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!esGonzalo && (
        <div className="modal-actions" style={{ marginTop: 4 }}>
          {editando ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => { setBorrador(base); setEditando(false); }}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={guardar} disabled={guardando || !cambiado}>
                {guardando ? 'Guardando...' : 'Guardar permisos'}
              </button>
            </>
          ) : (
            <button type="button" className="btn-muted" onClick={() => setEditando(true)}>
              <FestosIcon name="Pencil" size={16} /> Editar permisos
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TarjetaUsuario({ perfil, guardandoPermisos, procesando, onGuardarPermisos, onToggleActivo }) {
  const esGonzalo = perfil.usuario === 'gonzalo';
  return (
    <div className="glass-card form-card role-card">
      <div className="section-header role-card-head">
        <div>
          <h4 className="panel-title" style={{ margin: 0, textTransform: 'capitalize' }}>
            {nombreCompletoUsuario(perfil.usuario, perfil.usuario)}{' '}
            <span className="code-tag tag-paid" style={{ marginLeft: 8 }}>{perfil.rol_label}</span>
            <span className={`code-tag ${perfil.activo ? 'tag-paid' : 'tag-pending'}`} style={{ marginLeft: 6 }}>
              {perfil.activo ? 'Activo' : 'Desactivado'}
            </span>
          </h4>
          <p className="panel-note" style={{ marginTop: 6 }}>
            {perfil.email}
          </p>
          {esGonzalo && (
            <p className="panel-note" style={{ marginTop: 6 }}>
              HEAD ADMIN: acceso total protegido por Supabase. Esta cuenta no puede desactivarse desde FESTOS.
            </p>
          )}
        </div>
        {!esGonzalo && (
          <div className="record-actions">
            <button
              type="button"
              className={perfil.activo ? 'btn-delete' : 'btn-approve'}
              disabled={procesando}
              onClick={() => onToggleActivo(perfil.usuario, perfil.activo)}
            >
              {perfil.activo ? 'Desactivar acceso' : 'Activar acceso'}
            </button>
          </div>
        )}
      </div>

      <div className="profile-security-note" style={{ marginBottom: 14 }}>
        <FestosIcon name="LockKeyhole" size={16} />
        <span>La contraseña pertenece a Supabase Auth y no es visible ni editable por otros usuarios.</span>
      </div>

      <BloquePermisos
        usuario={perfil.usuario}
        permisos={perfil.permisos}
        esGonzalo={esGonzalo}
        guardando={guardandoPermisos}
        onGuardar={onGuardarPermisos}
      />
    </div>
  );
}

export function GestionRoles({ usuarioActual, onNotify, onAudit, onCambio }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorSistema, setErrorSistema] = useState('');
  const [guardandoUsuario, setGuardandoUsuario] = useState(null);
  const [procesandoUsuario, setProcesandoUsuario] = useState(null);

  const cargarTodo = async () => {
    setCargandoLista(true);
    setErrorSistema('');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,email,usuario,nombre,rol_label,activo,permisos,updated_at')
        .order('usuario');
      if (error) throw error;
      setUsuarios(data || []);
    } catch (err) {
      console.error(err);
      setErrorSistema('No se pudo cargar los perfiles seguros. Verifica que la migración de permisos V29.38 esté ejecutada y que tu cuenta sea HEAD ADMIN o DESARROLLADOR SOFTWARE.');
    } finally {
      setCargandoLista(false);
    }
  };

  useEffect(() => { cargarTodo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleActivo = async (usuario, activo) => {
    setProcesandoUsuario(usuario);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ activo: !activo, updated_by: usuarioActual })
        .eq('usuario', usuario);
      if (error) throw error;
      onNotify?.(`Acceso ${!activo ? 'activado' : 'desactivado'} para ${nombreCompletoUsuario(usuario, usuario)}`, 'edicion');
      onAudit?.('Edición', `Seguridad · ${nombreCompletoUsuario(usuario, usuario)} ${!activo ? 'activado' : 'desactivado'} por ${nombreCompletoUsuario(usuarioActual, usuarioActual)}`);
      await cargarTodo();
      onCambio?.();
    } catch (err) {
      alert(`No se pudo actualizar el acceso. ${err?.message || ''}`);
    } finally {
      setProcesandoUsuario(null);
    }
  };

  const guardarPermisos = async (usuario, nuevosPermisos) => {
    setGuardandoUsuario(usuario);
    try {
      const permisos = { ...nuevosPermisos };
      delete permisos.rol_label;
      const { error } = await supabase
        .from('profiles')
        .update({ permisos, updated_by: usuarioActual })
        .eq('usuario', usuario);
      if (error) throw error;
      onNotify?.(`Permisos actualizados para ${nombreCompletoUsuario(usuario, usuario)}`, 'edicion');
      onAudit?.('Edición', `Seguridad · permisos de ${nombreCompletoUsuario(usuario, usuario)} actualizados por ${nombreCompletoUsuario(usuarioActual, usuarioActual)}`);
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
          <h3 className="section-title"><FestosIcon name="ShieldCheck" size={21} /> Roles y Permisos</h3>
          <p className="panel-note">
            V29 Security Lite: las cuentas se autentican por correo con Supabase Auth. Aquí HEAD ADMIN y DESARROLLADOR SOFTWARE pueden controlar
            si una cuenta FESTOS está activa y qué operaciones puede realizar.
          </p>
        </div>
      </div>

      <div className="glass-card form-card" style={{ marginBottom: 18 }}>
        <h4 className="panel-title icon-heading"><FestosIcon name="Mail" size={18} /> Cuentas corporativas</h4>
        <p className="panel-note" style={{ marginBottom: 6 }}>
          Por seguridad, FESTOS ya no crea usuarios ni conoce las contraseñas de otras personas. Las cuatro cuentas
          se crean una sola vez en Supabase → Authentication → Users. Cada usuario cambia su propia contraseña desde su perfil.
        </p>
      </div>

      {errorSistema && (
        <div className="glass-card form-card" style={{ marginBottom: 18 }}>
          <p className="record-note" style={{ color: '#ef4444' }}>{errorSistema}</p>
        </div>
      )}

      {cargandoLista ? (
        <p className="empty-hint">Cargando perfiles seguros...</p>
      ) : (
        <div className="roles-grid">
          {usuarios.map(perfil => (
            <TarjetaUsuario
              key={perfil.user_id}
              perfil={perfil}
              guardandoPermisos={guardandoUsuario === perfil.usuario}
              onGuardarPermisos={guardarPermisos}
              onToggleActivo={toggleActivo}
              procesando={procesandoUsuario === perfil.usuario}
            />
          ))}
        </div>
      )}
    </div>
  );
}
