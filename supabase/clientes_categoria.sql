-- Categoría de cliente (opcional)
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS categoria text;

-- Índice opcional para búsquedas/filtros por categoría
CREATE INDEX IF NOT EXISTS idx_clientes_categoria
ON public.clientes (categoria);
