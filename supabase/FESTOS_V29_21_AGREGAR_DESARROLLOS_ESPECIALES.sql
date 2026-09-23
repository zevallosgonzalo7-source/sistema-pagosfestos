-- FESTOS V29.21 | Catálogo opcional usado si se ejecutó el SQL de V29.20.
-- La aplicación V29.21 toma las 9 opciones de src/categories.js;
-- esta inserción NO cambia proyectos, cotizaciones ni sus categorías actuales.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.categorias_festos') IS NOT NULL THEN
    INSERT INTO public.categorias_festos (nombre, activo)
    VALUES ('Desarrollos especiales', TRUE)
    ON CONFLICT (nombre) DO UPDATE SET activo = TRUE;
  ELSE
    RAISE NOTICE 'La tabla categorias_festos no existe: FESTOS V29.21 usa el catálogo del frontend. No se requiere migración para mostrar la opción.';
  END IF;
END $$;
COMMIT;
