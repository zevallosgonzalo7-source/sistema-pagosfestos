-- CONTROL FESTOS V12
-- Cotizaciones + proyecto obligatorio + aprobación atómica

ALTER TABLE public.cotizaciones
ADD COLUMN IF NOT EXISTS proyecto_nombre TEXT;

ALTER TABLE public.cotizaciones
ALTER COLUMN project_id DROP NOT NULL;

-- Recuperar el nombre de proyecto para cotizaciones antiguas que ya tenían project_id.
UPDATE public.cotizaciones c
SET proyecto_nombre = p.nombre
FROM public.proyectos p
WHERE c.project_id = p.id
  AND COALESCE(TRIM(c.proyecto_nombre), '') = '';

CREATE INDEX IF NOT EXISTS idx_cotizaciones_proyecto_nombre
ON public.cotizaciones(proyecto_nombre);

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
        RETURN v_cotizacion.project_id;
    END IF;

    IF v_cotizacion.proyecto_nombre IS NULL
       OR TRIM(v_cotizacion.proyecto_nombre) = '' THEN
        RAISE EXCEPTION 'No se puede aprobar la cotización sin un proyecto.';
    END IF;

    INSERT INTO public.proyectos (
        id, client_id, nombre, descripcion, estado, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_cotizacion.client_id,
        TRIM(v_cotizacion.proyecto_nombre),
        v_cotizacion.descripcion,
        'Activo',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_project_id;

    UPDATE public.cotizaciones
    SET
        project_id = v_project_id,
        estado = 'Aprobado',
        updated_by = p_usuario,
        updated_at = NOW()
    WHERE id = p_cotizacion_id;

    RETURN v_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprobar_cotizacion(UUID, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
