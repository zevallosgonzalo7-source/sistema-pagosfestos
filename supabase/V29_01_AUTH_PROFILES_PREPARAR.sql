-- ============================================================
-- FESTOS V29 SECURITY LITE · FASE 1
-- SUPABASE AUTH + PROFILES + RPC SEGURAS
-- ============================================================
-- EJECUTAR DESPUES de crear manualmente estas 4 cuentas en:
-- Supabase > Authentication > Users
--
-- gonzalo@festosmkt.com
-- administracion@festosmkt.com
-- mar@festosmkt.com
-- rodrigo@festosmkt.com
--
-- Esta fase NO elimina el login antiguo ni cierra las políticas antiguas.
-- Permite probar V29 antes de bloquear V28.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_festos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  usuario text NOT NULL UNIQUE,
  nombre text,
  rol_label text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  permisos jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_festos_updated_at();

-- Perfiles de los cuatro usuarios. Solo se insertan si la cuenta Auth ya existe.
INSERT INTO public.profiles (user_id, email, usuario, nombre, rol_label, activo, permisos)
SELECT u.id, lower(u.email), 'gonzalo', 'GONZALO', 'HEAD ADMIN', true,
  jsonb_build_object(
    'ver_clientes', true, 'gestionar_clientes', true,
    'ver_proveedores', true, 'gestionar_proveedores', true,
    'ver_proyectos', true, 'gestionar_proyectos', true,
    'ver_cotizaciones', true, 'gestionar_cotizaciones', true,
    'aprobar_cotizaciones', true, 'gestionar_roles', true
  )
FROM auth.users u
WHERE lower(u.email) = 'gonzalo@festosmkt.com'
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  usuario = EXCLUDED.usuario,
  nombre = EXCLUDED.nombre,
  rol_label = EXCLUDED.rol_label,
  activo = true,
  permisos = EXCLUDED.permisos;

INSERT INTO public.profiles (user_id, email, usuario, nombre, rol_label, activo, permisos)
SELECT u.id, lower(u.email), 'jesus', 'JESUS', 'ADMIN', true,
  jsonb_build_object(
    'ver_clientes', true, 'gestionar_clientes', true,
    'ver_proveedores', true, 'gestionar_proveedores', true,
    'ver_proyectos', true, 'gestionar_proyectos', true,
    'ver_cotizaciones', true, 'gestionar_cotizaciones', true,
    'aprobar_cotizaciones', true, 'gestionar_roles', false
  )
FROM auth.users u
WHERE lower(u.email) = 'administracion@festosmkt.com'
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  usuario = EXCLUDED.usuario,
  nombre = EXCLUDED.nombre,
  rol_label = EXCLUDED.rol_label,
  activo = true,
  permisos = EXCLUDED.permisos;

INSERT INTO public.profiles (user_id, email, usuario, nombre, rol_label, activo, permisos)
SELECT u.id, lower(u.email), 'mar', 'MAR', 'OPERADORA COMERCIAL', true,
  jsonb_build_object(
    'ver_clientes', true, 'gestionar_clientes', false,
    'ver_proveedores', true, 'gestionar_proveedores', false,
    'ver_proyectos', true, 'gestionar_proyectos', false,
    'ver_cotizaciones', true, 'gestionar_cotizaciones', true,
    'aprobar_cotizaciones', false, 'gestionar_roles', false
  )
FROM auth.users u
WHERE lower(u.email) = 'mar@festosmkt.com'
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  usuario = EXCLUDED.usuario,
  nombre = EXCLUDED.nombre,
  rol_label = EXCLUDED.rol_label,
  activo = true,
  permisos = EXCLUDED.permisos;

INSERT INTO public.profiles (user_id, email, usuario, nombre, rol_label, activo, permisos)
SELECT u.id, lower(u.email), 'rodrigo', 'RODRIGO', 'DESARROLLADOR SOFTWARE', true,
  jsonb_build_object(
    'ver_clientes', true, 'gestionar_clientes', true,
    'ver_proveedores', true, 'gestionar_proveedores', true,
    'ver_proyectos', true, 'gestionar_proyectos', true,
    'ver_cotizaciones', true, 'gestionar_cotizaciones', true,
    'aprobar_cotizaciones', true, 'gestionar_roles', false
  )
FROM auth.users u
WHERE lower(u.email) = 'rodrigo@festosmkt.com'
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  usuario = EXCLUDED.usuario,
  nombre = EXCLUDED.nombre,
  rol_label = EXCLUDED.rol_label,
  activo = true,
  permisos = EXCLUDED.permisos;

-- Funciones de identidad. SECURITY DEFINER evita recursión de RLS al consultar profiles.
CREATE OR REPLACE FUNCTION public.festos_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.activo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.festos_current_usuario()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT p.usuario
  FROM public.profiles p
  WHERE p.user_id = auth.uid() AND p.activo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.festos_is_head_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.activo = true
      AND p.rol_label = 'HEAD ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.festos_has_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN p.rol_label = 'HEAD ADMIN' THEN true
      ELSE COALESCE((p.permisos ->> p_permission)::boolean, false)
    END
    FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.activo = true
    LIMIT 1
  ), false);
$$;

REVOKE ALL ON FUNCTION public.festos_is_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.festos_current_usuario() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.festos_is_head_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.festos_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.festos_is_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.festos_current_usuario() TO authenticated;
GRANT EXECUTE ON FUNCTION public.festos_is_head_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.festos_has_permission(text) TO authenticated;

-- RLS de perfiles: cada usuario lee su perfil; HEAD ADMIN lee/edita todos.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "festos profiles select" ON public.profiles;
DROP POLICY IF EXISTS "festos profiles head admin update" ON public.profiles;
CREATE POLICY "festos profiles select"
ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.festos_is_head_admin());
CREATE POLICY "festos profiles head admin update"
ON public.profiles FOR UPDATE TO authenticated
USING (public.festos_is_head_admin())
WITH CHECK (public.festos_is_head_admin());
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- Protege que el HEAD ADMIN no quede desactivado accidentalmente.
CREATE OR REPLACE FUNCTION public.proteger_head_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.usuario = 'gonzalo' THEN
      RAISE EXCEPTION 'No se puede eliminar el perfil HEAD ADMIN.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.usuario = 'gonzalo' AND (NEW.activo IS DISTINCT FROM true OR NEW.rol_label IS DISTINCT FROM 'HEAD ADMIN') THEN
    RAISE EXCEPTION 'El perfil HEAD ADMIN debe permanecer activo y conservar su rol.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_head_admin_profile ON public.profiles;
CREATE TRIGGER trg_proteger_head_admin_profile
BEFORE UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.proteger_head_admin_profile();

-- RPC segura para aprobar cotizaciones. Ya no recibe el nombre del usuario desde el frontend.
CREATE OR REPLACE FUNCTION public.aprobar_cotizacion(p_cotizacion_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_cotizacion public.cotizaciones%ROWTYPE;
  v_project_id uuid;
  v_usuario text;
BEGIN
  IF NOT public.festos_has_permission('aprobar_cotizaciones') THEN
    RAISE EXCEPTION 'No tienes permiso para aprobar cotizaciones.';
  END IF;

  v_usuario := public.festos_current_usuario();
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Sesión FESTOS no válida.';
  END IF;

  SELECT * INTO v_cotizacion
  FROM public.cotizaciones
  WHERE id = p_cotizacion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cotización no existe.';
  END IF;

  IF v_cotizacion.project_id IS NOT NULL THEN
    UPDATE public.cotizaciones
    SET estado = 'Aprobado', updated_by = v_usuario, updated_at = NOW()
    WHERE id = p_cotizacion_id;

    UPDATE public.proyectos
    SET ejecutivo = COALESCE(NULLIF(TRIM(ejecutivo), ''), NULLIF(TRIM(v_cotizacion.created_by), ''), upper(v_usuario)),
        lob = COALESCE(NULLIF(TRIM(lob), ''), NULLIF(TRIM(v_cotizacion.lob), ''), 'Espacio de estructuras'),
        created_by = COALESCE(created_by, v_cotizacion.created_by, v_usuario),
        valor_base = COALESCE(NULLIF(valor_base, 0), v_cotizacion.subtotal),
        valor_venta = COALESCE(NULLIF(valor_venta, 0), v_cotizacion.subtotal),
        costo_estimado = COALESCE(NULLIF(costo_estimado, 0), v_cotizacion.costo_estimado),
        utilidad_proyectada = COALESCE(NULLIF(utilidad_proyectada, 0), v_cotizacion.ganancia_estimada),
        updated_at = NOW()
    WHERE id = v_cotizacion.project_id;

    RETURN v_cotizacion.project_id;
  END IF;

  IF v_cotizacion.proyecto_nombre IS NULL OR TRIM(v_cotizacion.proyecto_nombre) = '' THEN
    RAISE EXCEPTION 'No se puede aprobar la cotización sin un proyecto.';
  END IF;

  INSERT INTO public.proyectos (
    id, client_id, nombre, descripcion, estado,
    ejecutivo, lob, created_by,
    valor_base, valor_venta, costo_estimado, utilidad_proyectada,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_cotizacion.client_id,
    TRIM(v_cotizacion.proyecto_nombre),
    v_cotizacion.descripcion,
    'EN PROCESO',
    COALESCE(NULLIF(TRIM(v_cotizacion.created_by), ''), upper(v_usuario)),
    COALESCE(NULLIF(TRIM(v_cotizacion.lob), ''), 'Espacio de estructuras'),
    COALESCE(v_cotizacion.created_by, v_usuario),
    v_cotizacion.subtotal,
    v_cotizacion.subtotal,
    v_cotizacion.costo_estimado,
    v_cotizacion.ganancia_estimada,
    NOW(), NOW()
  ) RETURNING id INTO v_project_id;

  UPDATE public.cotizaciones
  SET project_id = v_project_id,
      estado = 'Aprobado',
      updated_by = v_usuario,
      updated_at = NOW()
  WHERE id = p_cotizacion_id;

  RETURN v_project_id;
END;
$$;
REVOKE ALL ON FUNCTION public.aprobar_cotizacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprobar_cotizacion(uuid) TO authenticated;

-- RPC segura para eliminar proyecto. El servidor comprueba HEAD ADMIN con auth.uid().
CREATE OR REPLACE FUNCTION public.eliminar_proyecto_gonzalo(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.festos_is_head_admin() THEN
    RAISE EXCEPTION 'Solo HEAD ADMIN puede eliminar proyectos.';
  END IF;

  UPDATE public.cotizaciones
  SET project_id = NULL,
      updated_by = public.festos_current_usuario(),
      updated_at = NOW()
  WHERE project_id = p_project_id;

  DELETE FROM public.proyectos WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El proyecto no existe.';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.eliminar_proyecto_gonzalo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eliminar_proyecto_gonzalo(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- ============================================================
-- VERIFICACION
-- Deben aparecer 4 filas. Si falta alguna, crea primero esa cuenta
-- en Authentication > Users y vuelve a ejecutar este archivo.
-- ============================================================
SELECT email, usuario, rol_label, activo
FROM public.profiles
ORDER BY usuario;
