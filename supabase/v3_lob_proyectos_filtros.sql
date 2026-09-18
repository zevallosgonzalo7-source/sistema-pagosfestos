-- CONTROL FESTOS V3
-- LOB de cotizaciones + estados/usuario de proyectos + nombre de contactos de clientes.
-- Ejecutar después de las migraciones anteriores.

-- 1) LOB de cotizaciones
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS lob TEXT;

UPDATE public.cotizaciones
SET lob = 'Espacio de estructuras'
WHERE lob IS NULL OR TRIM(lob) = '';

ALTER TABLE public.cotizaciones
  ALTER COLUMN lob SET DEFAULT 'Espacio de estructuras';

-- 2) Proyectos: usuario que cargó/creó el proyecto
ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Recupera el usuario desde la cotización vinculada cuando exista.
UPDATE public.proyectos p
SET created_by = c.created_by
FROM public.cotizaciones c
WHERE c.project_id = p.id
  AND COALESCE(TRIM(p.created_by), '') = ''
  AND COALESCE(TRIM(c.created_by), '') <> '';

-- 3) Normalizar estados antiguos al nuevo catálogo.
ALTER TABLE public.proyectos
  DROP CONSTRAINT IF EXISTS proyectos_estado_check;

UPDATE public.proyectos
SET estado = CASE
  WHEN UPPER(TRIM(COALESCE(estado, ''))) IN ('ACTIVO', 'EN PAUSA', 'EN PROCESO') THEN 'EN PROCESO'
  WHEN UPPER(TRIM(COALESCE(estado, ''))) = 'FINALIZADO' THEN 'FINALIZADO'
  WHEN UPPER(TRIM(COALESCE(estado, ''))) = 'FACTURADO' THEN 'FACTURADO'
  ELSE 'EN PROCESO'
END;

ALTER TABLE public.proyectos
  ADD CONSTRAINT proyectos_estado_check
  CHECK (estado IN ('EN PROCESO', 'FINALIZADO', 'FACTURADO'));

CREATE INDEX IF NOT EXISTS idx_proyectos_created_by ON public.proyectos(created_by);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_lob ON public.cotizaciones(lob);

-- 4) Contactos de clientes: se registra NOMBRE en vez de correo en la interfaz.
ALTER TABLE public.cliente_contactos
  ADD COLUMN IF NOT EXISTS nombre TEXT;

CREATE INDEX IF NOT EXISTS idx_cliente_contactos_nombre ON public.cliente_contactos(nombre);

-- El campo correo antiguo se conserva para no romper registros/migraciones anteriores,
-- pero la aplicación ya no lo muestra ni lo solicita para contactos de clientes.

-- 5) Función de aprobación: el proyecto hereda el usuario que creó la cotización.
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
        SET created_by = COALESCE(created_by, v_cotizacion.created_by, p_usuario), updated_at = NOW()
        WHERE id = v_cotizacion.project_id;
        RETURN v_cotizacion.project_id;
    END IF;

    IF v_cotizacion.proyecto_nombre IS NULL OR TRIM(v_cotizacion.proyecto_nombre) = '' THEN
        RAISE EXCEPTION 'No se puede aprobar la cotización sin un proyecto.';
    END IF;

    INSERT INTO public.proyectos (
        id, client_id, nombre, descripcion, estado, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_cotizacion.client_id,
        TRIM(v_cotizacion.proyecto_nombre),
        v_cotizacion.descripcion,
        'EN PROCESO',
        COALESCE(v_cotizacion.created_by, p_usuario),
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

-- 6) Eliminación de proyectos: solo GONZALO puede hacerlo.
-- Se elimina el permiso DELETE directo y se expone una función controlada.
drop policy if exists "festos proyectos anon access" on public.proyectos;
create policy "festos proyectos select access" on public.proyectos for select to anon, authenticated using (true);
create policy "festos proyectos insert access" on public.proyectos for insert to anon, authenticated with check (true);
create policy "festos proyectos update access" on public.proyectos for update to anon, authenticated using (true) with check (true);

create or replace function public.eliminar_proyecto_gonzalo(
  p_project_id UUID,
  p_usuario TEXT
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(trim(coalesce(p_usuario, ''))) <> 'gonzalo' then
    raise exception 'Solo GONZALO puede eliminar proyectos.';
  end if;

  update public.cotizaciones
  set project_id = null, updated_at = now()
  where project_id = p_project_id;

  delete from public.proyectos where id = p_project_id;

  if not found then
    raise exception 'El proyecto no existe.';
  end if;
end;
$$;

grant execute on function public.eliminar_proyecto_gonzalo(UUID, TEXT) to anon, authenticated;
NOTIFY pgrst, 'reload schema';
