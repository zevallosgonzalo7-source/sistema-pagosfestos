-- Control Festos: habilitar Realtime para los directorios principales.
-- Ejecutar una sola vez en Supabase SQL Editor.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.proveedores;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.proyectos;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cotizaciones;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE public.clientes REPLICA IDENTITY FULL;
ALTER TABLE public.proveedores REPLICA IDENTITY FULL;
ALTER TABLE public.proyectos REPLICA IDENTITY FULL;
ALTER TABLE public.cotizaciones REPLICA IDENTITY FULL;
