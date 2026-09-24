-- FESTOS V29.30 · Ejecutivo comercial en cotizaciones
BEGIN;

ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS ejecutivo TEXT;

UPDATE public.cotizaciones
SET ejecutivo = CASE
  WHEN UPPER(TRIM(COALESCE(created_by, ''))) = 'MAR' THEN 'MAR'
  ELSE 'GONZALO'
END
WHERE COALESCE(TRIM(ejecutivo), '') = '';

ALTER TABLE public.cotizaciones
  DROP CONSTRAINT IF EXISTS cotizaciones_ejecutivo_check;
ALTER TABLE public.cotizaciones
  ADD CONSTRAINT cotizaciones_ejecutivo_check CHECK (ejecutivo IN ('GONZALO','MAR'));

CREATE INDEX IF NOT EXISTS idx_cotizaciones_ejecutivo ON public.cotizaciones(ejecutivo);

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
  v_ejecutivo text;
BEGIN
  IF NOT public.festos_has_permission('aprobar_cotizaciones') THEN
    RAISE EXCEPTION 'No tienes permiso para aprobar cotizaciones.';
  END IF;

  v_usuario := public.festos_current_usuario();
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Sesión FESTOS no válida.';
  END IF;

  SELECT * INTO v_cotizacion FROM public.cotizaciones WHERE id = p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cotización no existe.'; END IF;

  v_ejecutivo := COALESCE(NULLIF(TRIM(v_cotizacion.ejecutivo), ''),
    CASE WHEN UPPER(TRIM(COALESCE(v_cotizacion.created_by, ''))) = 'MAR' THEN 'MAR' ELSE 'GONZALO' END);

  IF v_cotizacion.project_id IS NOT NULL THEN
    UPDATE public.cotizaciones SET estado='Aprobado', ejecutivo=v_ejecutivo, updated_by=v_usuario, updated_at=NOW() WHERE id=p_cotizacion_id;
    UPDATE public.proyectos SET
      ejecutivo=v_ejecutivo,
      lob=COALESCE(NULLIF(TRIM(lob), ''), NULLIF(TRIM(v_cotizacion.lob), ''), 'Espacio de estructuras'),
      created_by=COALESCE(created_by, v_cotizacion.created_by, v_usuario),
      valor_base=COALESCE(NULLIF(valor_base,0), v_cotizacion.subtotal),
      valor_venta=COALESCE(NULLIF(valor_venta,0), v_cotizacion.subtotal),
      costo_estimado=COALESCE(NULLIF(costo_estimado,0), v_cotizacion.costo_estimado),
      utilidad_proyectada=COALESCE(NULLIF(utilidad_proyectada,0), v_cotizacion.ganancia_estimada),
      updated_at=NOW()
    WHERE id=v_cotizacion.project_id;
    RETURN v_cotizacion.project_id;
  END IF;

  IF v_cotizacion.proyecto_nombre IS NULL OR TRIM(v_cotizacion.proyecto_nombre)='' THEN
    RAISE EXCEPTION 'No se puede aprobar la cotización sin un proyecto.';
  END IF;

  INSERT INTO public.proyectos (id,client_id,nombre,descripcion,estado,ejecutivo,lob,created_by,valor_base,valor_venta,costo_estimado,utilidad_proyectada,created_at,updated_at)
  VALUES (gen_random_uuid(),v_cotizacion.client_id,TRIM(v_cotizacion.proyecto_nombre),v_cotizacion.descripcion,'EN PROCESO',v_ejecutivo,COALESCE(NULLIF(TRIM(v_cotizacion.lob),''),'Espacio de estructuras'),COALESCE(v_cotizacion.created_by,v_usuario),v_cotizacion.subtotal,v_cotizacion.subtotal,v_cotizacion.costo_estimado,v_cotizacion.ganancia_estimada,NOW(),NOW())
  RETURNING id INTO v_project_id;

  UPDATE public.cotizaciones SET project_id=v_project_id,estado='Aprobado',ejecutivo=v_ejecutivo,updated_by=v_usuario,updated_at=NOW() WHERE id=p_cotizacion_id;
  RETURN v_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.aprobar_cotizacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprobar_cotizacion(uuid) TO authenticated;

COMMIT;

SELECT codigo, ejecutivo, proyecto_nombre, estado FROM public.cotizaciones ORDER BY created_at DESC LIMIT 20;
