import React, { useState } from 'react';
import { FestosIcon } from '../FestosIcon';
const BASE = [
 {usuario:'Rodrigo', rol:'DESARROLLADOR SOFTWARE', nivel:'total'},
 {usuario:'Gonzalo', rol:'HEAD ADMIN', nivel:'total'},
 {usuario:'Jesus', rol:'ADMIN', nivel:'admin'},
 {usuario:'Mar', rol:'COMERCIAL', nivel:'comercial'},
];
export function Roles(){
 const [usuarios,setUsuarios]=useState(BASE); const [nuevo,setNuevo]=useState(''); const [rol,setRol]=useState('COMERCIAL');
 const guardar=()=>{if(!nuevo.trim())return;setUsuarios(p=>[...p,{usuario:nuevo.trim(),rol,nivel:rol==='COMERCIAL'?'comercial':rol==='ADMIN'?'admin':'total'}]);setNuevo('');};
 return <div><div className="section-header"><div><h3 className="section-title"><FestosIcon name="ShieldCheck" size={21} /> Gestión de roles</h3><p className="panel-note">Solo Gonzalo puede administrar este apartado.</p></div></div><div className="glass-card form-card"><h4 className="panel-title">Usuarios permitidos</h4><div className="record-list">{usuarios.map(u=><div className="record-card" key={u.usuario}><div><h4 className="record-title">{u.usuario}</h4><p className="record-meta">ROL: {u.rol}</p></div><span className="code-tag tag-paid">{u.nivel==='total'?'TOTAL':u.nivel==='admin'?'ADMIN':'COMERCIAL'}</span></div>)}</div><hr/><h4 className="panel-title">Crear nuevo usuario</h4><div className="form-grid-2"><input placeholder="Nombre de usuario" value={nuevo} onChange={e=>setNuevo(e.target.value)}/><select value={rol} onChange={e=>setRol(e.target.value)}><option>COMERCIAL</option><option>ADMIN</option><option>HEAD ADMIN</option><option>DESARROLLADOR SOFTWARE</option></select></div><button className="btn-primary" onClick={guardar}>Crear usuario</button></div></div>;
}
