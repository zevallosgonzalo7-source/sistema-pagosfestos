-- ============================================================
-- FESTOS V29 SECURITY LITE · FASE 2
-- CERRAR ACCESO ANON + RLS REAL POR ROL/PERMISO
-- ============================================================
-- EJECUTA ESTA FASE SOLO DESPUES de comprobar que V29 inicia sesión
-- correctamente con al menos GONZALO usando correo + contraseña.
-- Al ejecutar esta fase, las versiones antiguas V28 dejan de ser compatibles.
-- ============================================================

BEGIN;

-- Eliminar políticas antiguas de las tablas usadas por FESTOS y revocar anon.
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clientes','cliente_contactos','proveedores','proveedor_contactos',
    'proyectos','cotizaciones','cotizacion_items','cotizacion_notificaciones',
    'pagos','facturas','roles_permisos','usuarios_sistema'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      END LOOP;
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- Helpers para crear políticas solo si la tabla existe.
DO $$ BEGIN
  IF to_regclass('public.clientes') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
    CREATE POLICY "festos clientes select" ON public.clientes FOR SELECT TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('ver_clientes'));
    CREATE POLICY "festos clientes insert" ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.festos_is_active() AND public.festos_has_permission('gestionar_clientes'));
    CREATE POLICY "festos clientes update" ON public.clientes FOR UPDATE TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('gestionar_clientes')) WITH CHECK (public.festos_is_active() AND public.festos_has_permission('gestionar_clientes'));
    CREATE POLICY "festos clientes delete" ON public.clientes FOR DELETE TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('gestionar_clientes'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.cliente_contactos') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_contactos TO authenticated;
    CREATE POLICY "festos cliente contactos select" ON public.cliente_contactos FOR SELECT TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('ver_clientes'));
    CREATE POLICY "festos cliente contactos write" ON public.cliente_contactos FOR ALL TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('gestionar_clientes')) WITH CHECK (public.festos_is_active() AND public.festos_has_permission('gestionar_clientes'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.proveedores') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedores TO authenticated;
    CREATE POLICY "festos proveedores select" ON public.proveedores FOR SELECT TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('ver_proveedores'));
    CREATE POLICY "festos proveedores insert" ON public.proveedores FOR INSERT TO authenticated WITH CHECK (public.festos_is_active() AND public.festos_has_permission('gestionar_proveedores'));
    CREATE POLICY "festos proveedores update" ON public.proveedores FOR UPDATE TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('gestionar_proveedores')) WITH CHECK (public.festos_is_active() AND public.festos_has_permission('gestionar_proveedores'));
    CREATE POLICY "festos proveedores delete" ON public.proveedores FOR DELETE TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('gestionar_proveedores'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.proveedor_contactos') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedor_contactos TO authenticated;
    CREATE POLICY "festos proveedor contactos select" ON public.proveedor_contactos FOR SELECT TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('ver_proveedores'));
    CREATE POLICY "festos proveedor contactos write" ON public.proveedor_contactos FOR ALL TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('gestionar_proveedores')) WITH CHECK (public.festos_is_active() AND public.festos_has_permission('gestionar_proveedores'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.proyectos') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.proyectos TO authenticated;
    CREATE POLICY "festos proyectos select" ON public.proyectos FOR SELECT TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('ver_proyectos'));
    CREATE POLICY "festos proyectos insert" ON public.proyectos FOR INSERT TO authenticated WITH CHECK (public.festos_is_active() AND public.festos_has_permission('gestionar_proyectos'));
    CREATE POLICY "festos proyectos update" ON public.proyectos FOR UPDATE TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('gestionar_proyectos')) WITH CHECK (public.festos_is_active() AND public.festos_has_permission('gestionar_proyectos'));
    CREATE POLICY "festos proyectos delete" ON public.proyectos FOR DELETE TO authenticated USING (public.festos_is_active() AND public.festos_is_head_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.cotizaciones') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizaciones TO authenticated;
    CREATE POLICY "festos cotizaciones select" ON public.cotizaciones FOR SELECT TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('ver_cotizaciones'));
    CREATE POLICY "festos cotizaciones insert" ON public.cotizaciones FOR INSERT TO authenticated WITH CHECK (public.festos_is_active() AND public.festos_has_permission('gestionar_cotizaciones'));
    CREATE POLICY "festos cotizaciones update" ON public.cotizaciones FOR UPDATE TO authenticated USING (public.festos_is_active() AND (public.festos_has_permission('gestionar_cotizaciones') OR public.festos_has_permission('aprobar_cotizaciones'))) WITH CHECK (public.festos_is_active() AND (public.festos_has_permission('gestionar_cotizaciones') OR public.festos_has_permission('aprobar_cotizaciones')));
    CREATE POLICY "festos cotizaciones delete" ON public.cotizaciones FOR DELETE TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('gestionar_cotizaciones'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.cotizacion_items') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizacion_items TO authenticated;
    CREATE POLICY "festos cotizacion items select" ON public.cotizacion_items FOR SELECT TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('ver_cotizaciones'));
    CREATE POLICY "festos cotizacion items write" ON public.cotizacion_items FOR ALL TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('gestionar_cotizaciones')) WITH CHECK (public.festos_is_active() AND public.festos_has_permission('gestionar_cotizaciones'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.cotizacion_notificaciones') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizacion_notificaciones TO authenticated;
    CREATE POLICY "festos cotizacion notificaciones select" ON public.cotizacion_notificaciones FOR SELECT TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('ver_cotizaciones'));
    CREATE POLICY "festos cotizacion notificaciones write" ON public.cotizacion_notificaciones FOR ALL TO authenticated USING (public.festos_is_active() AND public.festos_has_permission('gestionar_cotizaciones')) WITH CHECK (public.festos_is_active() AND public.festos_has_permission('gestionar_cotizaciones'));
  END IF;
END $$;

-- Módulos ocultos: si las tablas existen, solo HEAD ADMIN conserva acceso directo.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pagos','facturas'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.festos_is_active() AND public.festos_is_head_admin())', 'festos '||t||' select', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.festos_is_active() AND public.festos_is_head_admin()) WITH CHECK (public.festos_is_active() AND public.festos_is_head_admin())', 'festos '||t||' write', t);
    END IF;
  END LOOP;
END $$;

-- La tabla nueva profiles mantiene sus políticas creadas en Fase 1.

-- Bloquear RPC antiguas que confiaban en parámetros enviados por el frontend.
DO $$ BEGIN
  IF to_regprocedure('public.verificar_login(text,text)') IS NOT NULL THEN REVOKE ALL ON FUNCTION public.verificar_login(text,text) FROM anon, authenticated; END IF;
  IF to_regprocedure('public.listar_usuarios()') IS NOT NULL THEN REVOKE ALL ON FUNCTION public.listar_usuarios() FROM anon, authenticated; END IF;
  IF to_regprocedure('public.crear_usuario(text,text,text,text)') IS NOT NULL THEN REVOKE ALL ON FUNCTION public.crear_usuario(text,text,text,text) FROM anon, authenticated; END IF;
  IF to_regprocedure('public.cambiar_password(text,text,text)') IS NOT NULL THEN REVOKE ALL ON FUNCTION public.cambiar_password(text,text,text) FROM anon, authenticated; END IF;
  IF to_regprocedure('public.set_estado_usuario(text,boolean,text)') IS NOT NULL THEN REVOKE ALL ON FUNCTION public.set_estado_usuario(text,boolean,text) FROM anon, authenticated; END IF;
  IF to_regprocedure('public.eliminar_usuario(text)') IS NOT NULL THEN REVOKE ALL ON FUNCTION public.eliminar_usuario(text) FROM anon, authenticated; END IF;
END $$;

DROP FUNCTION IF EXISTS public.aprobar_cotizacion(uuid, text);
DROP FUNCTION IF EXISTS public.eliminar_proyecto_gonzalo(uuid, text);

-- Asegurar que las nuevas RPC solo se usen autenticados.
REVOKE ALL ON FUNCTION public.aprobar_cotizacion(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.eliminar_proyecto_gonzalo(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.aprobar_cotizacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_proyecto_gonzalo(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verificación rápida: anon ya no debe tener permisos sobre las tablas principales.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('clientes','proveedores','proyectos','cotizaciones','cotizacion_items')
  AND grantee IN ('anon','authenticated')
ORDER BY table_name, grantee, privilege_type;
