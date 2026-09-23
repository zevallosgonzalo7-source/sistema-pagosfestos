-- FESTOS V28: agregar fechas REALES de inicio y entrega.
-- Opcional. Revisar en Supabase SQL Editor antes de ejecutar en producción.
-- No modifica códigos PRY, valores de venta, estados ni proyectos actuales.
-- Las columnas nuevas quedan NULL para registros históricos.

BEGIN;

ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS fecha_inicio DATE;

ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS fecha_entrega DATE;

COMMENT ON COLUMN public.proyectos.fecha_inicio IS
  'Fecha operativa de inicio registrada por el equipo; NULL si no se conoce.';
COMMENT ON COLUMN public.proyectos.fecha_entrega IS
  'Fecha operativa de entrega registrada por el equipo; NULL si no se conoce.';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Confirmar que ambas columnas existen, ANTES de registrar fechas:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'proyectos'
  AND column_name IN ('fecha_inicio', 'fecha_entrega')
ORDER BY column_name;

-- Para registrar fechas, usar la interfaz FESTOS con permiso para editar proyectos.
-- NO inventar fechas históricas para llenar el calendario.
