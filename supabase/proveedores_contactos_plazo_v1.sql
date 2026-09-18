-- CSSFESTOS: Proveedores - condición de pago, plazo y contactos por nombre
-- Ejecutar una sola vez en Supabase SQL Editor.

ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS plazo_dias integer NOT NULL DEFAULT 0;

ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS contacto_nombre text;

UPDATE public.proveedores
SET condicion_pago = 'CONTADO'
WHERE condicion_pago IS NULL
   OR upper(condicion_pago) NOT IN ('CONTADO', 'CREDITO');

UPDATE public.proveedores
SET plazo_dias = 0
WHERE upper(coalesce(condicion_pago, 'CONTADO')) = 'CONTADO';

ALTER TABLE public.proveedores
  ALTER COLUMN condicion_pago SET DEFAULT 'CONTADO';

ALTER TABLE public.proveedor_contactos
  ADD COLUMN IF NOT EXISTS nombre text;

-- Los contactos ahora usan Teléfono + Nombre. Se conserva la columna correo
-- para no borrar información histórica existente.

CREATE INDEX IF NOT EXISTS idx_proveedores_plazo_dias
  ON public.proveedores(plazo_dias);

CREATE INDEX IF NOT EXISTS idx_proveedor_contactos_nombre
  ON public.proveedor_contactos(nombre);

NOTIFY pgrst, 'reload schema';
