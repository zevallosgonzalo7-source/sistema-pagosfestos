-- CONTROL FESTOS V4
-- Ejecutivo + LOB en proyectos y mejora de aprobación automática.
-- Ejecutar una sola vez en Supabase SQL Editor.

ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS ejecutivo TEXT;

ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS lob TEXT;

-- Recuperar datos de proyectos existentes desde su cotización vinculada.
UPDATE public.proyectos p
SET ejecutivo = COALESCE(NULLIF(TRIM(p.ejecutivo), ''), NULLIF(TRIM(c.created_by), ''), NULLIF(TRIM(p.created_by), ''))
FROM public.cotizaciones c
WHERE c.project_id = p.id
  AND COALESCE(TRIM(p.ejecutivo), '') = ''
  AND COALESCE(TRIM(c.created_by), '') <> '';

UPDATE public.proyectos p
SET lob = COALESCE(NULLIF(TRIM(p.lob), ''), NULLIF(TRIM(c.lob), ''), 'Espacio de estructuras')
FROM public.cotizaciones c
WHERE c.project_id = p.id
  AND (p.lob IS NULL OR TRIM(p.lob) = '');

UPDATE public.proyectos
SET ejecutivo = 'GONZALO'
WHERE COALESCE(TRIM(ejecutivo), '') = '';

UPDATE public.proyectos
SET lob = 'Espacio de estructuras'
WHERE lob IS NULL OR TRIM(lob) = '';

CREATE INDEX IF NOT EXISTS idx_proyectos_ejecutivo ON public.proyectos(ejecutivo);
CREATE INDEX IF NOT EXISTS idx_proyectos_lob ON public.proyectos(lob);

-- Al aprobar una cotización, el proyecto hereda ejecutivo y LOB de la cotización.
CREATE OR REPLACE FUNCTION public.aprobar_cotizacion(
    p_cotizacion_id UUID,
    p_usuario TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cotizacion public.cotizaciones%ROWTYPE;
    v_project_id UUID;
BEGIN
    SELECT * INTO v_cotizacion
    FROM public.cotizaciones
    WHERE id = p_cotizacion_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cotización no existe.';
    END IF;

    IF v_cotizacion.project_id IS NOT NULL THEN
        UPDATE public.cotizaciones
        SET estado = 'Aprobado', updated_by = p_usuario, updated_at = NOW()
        WHERE id = p_cotizacion_id;

        UPDATE public.proyectos
        SET ejecutivo = COALESCE(NULLIF(TRIM(ejecutivo), ''), NULLIF(TRIM(v_cotizacion.created_by), ''), NULLIF(TRIM(p_usuario), ''), 'GONZALO'),
            lob = COALESCE(NULLIF(TRIM(lob), ''), NULLIF(TRIM(v_cotizacion.lob), ''), 'Espacio de estructuras'),
            created_by = COALESCE(created_by, v_cotizacion.created_by, p_usuario),
            updated_at = NOW()
        WHERE id = v_cotizacion.project_id;
        RETURN v_cotizacion.project_id;
    END IF;

    IF v_cotizacion.proyecto_nombre IS NULL OR TRIM(v_cotizacion.proyecto_nombre) = '' THEN
        RAISE EXCEPTION 'No se puede aprobar la cotización sin un proyecto.';
    END IF;

    INSERT INTO public.proyectos (
        id, client_id, nombre, descripcion, estado, ejecutivo, lob, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_cotizacion.client_id,
        TRIM(v_cotizacion.proyecto_nombre),
        v_cotizacion.descripcion,
        'EN PROCESO',
        COALESCE(NULLIF(TRIM(v_cotizacion.created_by), ''), NULLIF(TRIM(p_usuario), ''), 'GONZALO'),
        COALESCE(NULLIF(TRIM(v_cotizacion.lob), ''), 'Espacio de estructuras'),
        COALESCE(v_cotizacion.created_by, p_usuario),
        NOW(),
        NOW()
    )
    RETURNING id INTO v_project_id;

    UPDATE public.cotizaciones
    SET project_id = v_project_id,
        estado = 'Aprobado',
        updated_by = p_usuario,
        updated_at = NOW()
    WHERE id = p_cotizacion_id;

    RETURN v_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprobar_cotizacion(UUID, TEXT) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
