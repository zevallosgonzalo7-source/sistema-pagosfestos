-- FESTOS V29.14 · RESTRICCION DE ALTA DE CLIENTES
-- Ejecutar SOLO si la fase V29_02_ACTIVAR_RLS_SEGURA.sql ya esta aplicada.
-- Esta migracion SOLO cambia una politica INSERT de public.clientes.
-- NO modifica proyectos, cotizaciones, clientes, datos historicos ni codigos PRY.
-- Antes de ejecutarla: confirmar que las cuatro cuentas entran por Supabase Auth.

BEGIN;

DO $$
DECLARE
  v_policies integer;
  v_expected integer;
  v_enabled boolean;
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.clientes') IS NULL THEN
    RAISE EXCEPTION 'FESTOS: no existe profiles o clientes; no se aplica cambio de permisos.';
  END IF;

  SELECT c.relrowsecurity INTO v_enabled
  FROM pg_class c WHERE c.oid = 'public.clientes'::regclass;
  IF v_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FESTOS: la tabla clientes no tiene RLS habilitado. Primero verifica la Fase 2 de V29 en un entorno de prueba.';
  END IF;

  SELECT count(*) INTO v_expected
  FROM pg_policies
  WHERE schemaname='public' AND tablename='clientes'
    AND policyname='festos clientes insert' AND cmd='INSERT';
  SELECT count(*) INTO v_policies
  FROM pg_policies
  WHERE schemaname='public' AND tablename='clientes'
    AND cmd IN ('INSERT','ALL');

  -- No se modifica una base con politicas distintas/desconocidas: una politica
  -- permisiva adicional permitiria esquivar la restriccion por rol.
  IF v_expected <> 1 OR v_policies <> 1 THEN
    RAISE EXCEPTION 'FESTOS: politicas INSERT de clientes inesperadas (esperadas 1, halladas %). Revisa pg_policies; no se aplico ningun cambio.', v_policies;
  END IF;

  IF to_regprocedure('public.festos_is_active()') IS NULL
     OR to_regprocedure('public.festos_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'FESTOS: faltan funciones de seguridad V29; no se aplico ningun cambio.';
  END IF;
END;
$$;

DROP POLICY "festos clientes insert" ON public.clientes;

CREATE POLICY "festos clientes insert" ON public.clientes
FOR INSERT TO authenticated
WITH CHECK (
  public.festos_is_active()
  AND public.festos_has_permission('gestionar_clientes')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.activo = true
      AND p.rol_label IN ('HEAD ADMIN', 'ADMIN', 'DESARROLLADOR SOFTWARE')
  )
);

COMMIT;

-- Verificacion solo lectura (ejecutar aparte si deseas):
-- SELECT policyname, cmd, roles, with_check
-- FROM pg_policies
-- WHERE schemaname='public' AND tablename='clientes' AND cmd IN ('INSERT','ALL');
