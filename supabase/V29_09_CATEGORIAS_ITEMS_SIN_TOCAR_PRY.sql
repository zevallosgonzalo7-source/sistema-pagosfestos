-- FESTOS V29.9 · NUEVAS CATEGORÍAS / CATEGORÍA POR ÍTEM
-- EJECUTA PRIMERO EN SUPABASE SQL EDITOR, ANTES DE ABRIR V29.9
-- NO modifica proyectos.codigo, ninguna secuencia PRY, trigger, valor ni fecha.
-- Los proyectos/cotizaciones históricos se conservan con su antigua clasificación.
-- No existe equivalencia inequívoca entre las 3 LOB antiguas y las 10 categorías nuevas.
BEGIN;

-- Columna nueva para la categoría de CADA ítem (incluye ítems de cotizaciones existentes).
ALTER TABLE public.cotizacion_items
  ADD COLUMN IF NOT EXISTS categoria TEXT;

COMMENT ON COLUMN public.cotizacion_items.categoria IS
  'Categoría comercial de este ítem de cotización; no se infiere desde la categoría general.';

-- Mantenemos el nombre físico `lob` en estas tablas porque el RPC seguro
-- aprobar_cotizacion y otras versiones de FESTOS ya lo utilizan.
-- En V29.9 su contenido se muestra/edita como «Categoría».
ALTER TABLE public.proyectos
  ALTER COLUMN lob SET DEFAULT 'Espacios de marca';
ALTER TABLE public.cotizaciones
  ALTER COLUMN lob SET DEFAULT 'Espacios de marca';

-- Verificación no destructiva: códigos y clasificación histórica se mantienen.
SELECT 'proyectos' AS origen, COUNT(*) AS registros,
  COUNT(*) FILTER (WHERE codigo LIKE 'PRY-%') AS codigos_pry,
  COUNT(*) FILTER (WHERE lob IS NULL OR trim(lob) = '') AS sin_categoria
FROM public.proyectos
UNION ALL
SELECT 'cotizaciones', COUNT(*), 0,
  COUNT(*) FILTER (WHERE lob IS NULL OR trim(lob) = '')
FROM public.cotizaciones;

SELECT COUNT(*) AS items_totales, COUNT(*) FILTER (WHERE categoria IS NOT NULL) AS items_con_categoria
FROM public.cotizacion_items;
COMMIT;
