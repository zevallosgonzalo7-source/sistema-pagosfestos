-- CONTROL FESTOS V15
-- Gestión real de usuarios: alta de usuarios, cambio de contraseña,
-- activar/desactivar y eliminar, todo desde el apartado "Roles y Permisos".
-- Ejecutar en Supabase SQL Editor DESPUÉS de supabase_roles_v14.sql.
--
-- IMPORTANTE SOBRE SEGURIDAD:
-- Las contraseñas se guardan en texto plano en la tabla usuarios_sistema,
-- igual que antes estaban escritas directamente en el código de la app.
-- Para no empeorar eso, esta tabla NO tiene ninguna política que permita
-- leer filas directamente (no hay "select" para anon): todo el acceso
-- (login, listar usuarios, crear, cambiar password, activar/desactivar,
-- eliminar) pasa por funciones (RPC) que nunca devuelven la contraseña,
-- excepto la función de login, que solo confirma sí/no.
-- Aun así, cualquiera con la llave pública (anon key) del proyecto podría
-- llamar a estas funciones sin haber iniciado sesión "de verdad" en
-- Supabase, porque esta app no usa Supabase Auth. Es el mismo nivel de
-- seguridad que ya tenía el sistema (contraseñas fijas en el frontend),
-- pero ahora administrable desde la interfaz. Si en el futuro quieren
-- una seguridad más fuerte, lo ideal sería migrar a Supabase Auth.

create extension if not exists pgcrypto;

create table if not exists public.usuarios_sistema (
  usuario text primary key,
  password text not null,
  rol_label text not null default 'Usuario',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

drop trigger if exists trg_usuarios_sistema_updated_at on public.usuarios_sistema;
create trigger trg_usuarios_sistema_updated_at
before update on public.usuarios_sistema
for each row execute function public.set_festos_updated_at();

-- Se cargan los 4 usuarios originales con sus contraseñas actuales,
-- solo si la tabla está vacía (no pisa nada si ya la habías configurado).
insert into public.usuarios_sistema (usuario, password, rol_label) values
('gonzalo', 'ADMIN9090', 'HEAD ADMIN'),
('rodrigo', 'ADMIN8080', 'Desarrollador Software'),
('mar', 'ADMIN7070', 'COMERCIAL'),
('jesus', 'ADMIN6060', 'ADMIN')
on conflict (usuario) do nothing;

alter table public.usuarios_sistema enable row level security;
-- A propósito NO se crea ninguna política "for select"/"for all" abierta:
-- con RLS activado y sin políticas, anon/authenticated no pueden leer ni
-- escribir la tabla directamente. Todo pasa por las funciones de abajo.

-- 1) Verificar login sin exponer la contraseña.
create or replace function public.verificar_login(p_usuario text, p_password text)
returns table(usuario text, rol_label text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select u.usuario, u.rol_label
    from public.usuarios_sistema u
    where lower(u.usuario) = lower(trim(p_usuario))
      and u.password = p_password
      and u.activo = true;
end;
$$;
grant execute on function public.verificar_login(text, text) to anon, authenticated;

-- 2) Listar usuarios para el panel de administración (sin password).
create or replace function public.listar_usuarios()
returns table(usuario text, rol_label text, activo boolean, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select usuario, rol_label, activo, updated_at
  from public.usuarios_sistema
  order by usuario;
$$;
grant execute on function public.listar_usuarios() to anon, authenticated;

-- 3) Crear usuario nuevo (y su fila de permisos, vacía por defecto).
create or replace function public.crear_usuario(
  p_usuario text, p_password text, p_rol_label text, p_actor text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario text := lower(trim(p_usuario));
begin
  if v_usuario is null or v_usuario = '' then
    raise exception 'El nombre de usuario es obligatorio.';
  end if;
  if p_password is null or length(trim(p_password)) < 4 then
    raise exception 'La contraseña debe tener al menos 4 caracteres.';
  end if;

  insert into public.usuarios_sistema (usuario, password, rol_label, updated_by)
  values (v_usuario, p_password, coalesce(nullif(trim(p_rol_label), ''), 'Usuario'), p_actor);

  insert into public.roles_permisos (usuario, rol_label, permisos)
  values (v_usuario, coalesce(nullif(trim(p_rol_label), ''), 'Usuario'), jsonb_build_object(
    'ver_clientes', false, 'gestionar_clientes', false,
    'ver_proyectos', false, 'gestionar_proyectos', false,
    'ver_cotizaciones', false, 'gestionar_cotizaciones', false,
    'aprobar_cotizaciones', false, 'gestionar_roles', false
  ))
  on conflict (usuario) do nothing;
end;
$$;
grant execute on function public.crear_usuario(text, text, text, text) to anon, authenticated;

-- 4) Cambiar contraseña de un usuario existente.
create or replace function public.cambiar_password(
  p_usuario text, p_password_nueva text, p_actor text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_password_nueva is null or length(trim(p_password_nueva)) < 4 then
    raise exception 'La contraseña debe tener al menos 4 caracteres.';
  end if;
  update public.usuarios_sistema
  set password = p_password_nueva, updated_by = p_actor
  where lower(usuario) = lower(trim(p_usuario));
  if not found then
    raise exception 'El usuario no existe.';
  end if;
end;
$$;
grant execute on function public.cambiar_password(text, text, text) to anon, authenticated;

-- 5) Activar / desactivar un usuario (desactivado = no puede iniciar sesión).
create or replace function public.set_estado_usuario(
  p_usuario text, p_activo boolean, p_actor text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(trim(p_usuario)) = 'gonzalo' and p_activo = false then
    raise exception 'No se puede desactivar al HEAD ADMIN.';
  end if;
  update public.usuarios_sistema
  set activo = p_activo, updated_by = p_actor
  where lower(usuario) = lower(trim(p_usuario));
  if not found then
    raise exception 'El usuario no existe.';
  end if;
end;
$$;
grant execute on function public.set_estado_usuario(text, boolean, text) to anon, authenticated;

-- 6) Eliminar un usuario (y sus permisos asociados). Protege a Gonzalo.
create or replace function public.eliminar_usuario(p_usuario text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario text := lower(trim(p_usuario));
begin
  if v_usuario = 'gonzalo' then
    raise exception 'No se puede eliminar al HEAD ADMIN.';
  end if;
  delete from public.usuarios_sistema where lower(usuario) = v_usuario;
  delete from public.roles_permisos where lower(usuario) = v_usuario;
end;
$$;
grant execute on function public.eliminar_usuario(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
