-- FESTOS V29.8 · SOLO VERIFICACIÓN
-- NO modifica nada y NO toca codigo / PRY.

SELECT
  COUNT(*) AS total_proyectos,
  COUNT(*) FILTER (WHERE fecha_pedido IS NOT NULL) AS con_fecha_pedido,
  COUNT(*) FILTER (WHERE upper(trim(coalesce(ejecutivo,''))) = 'MAR') AS vendedor_mar,
  COUNT(*) FILTER (WHERE upper(trim(coalesce(ejecutivo,''))) = 'GONZALO') AS vendedor_gonzalo
FROM public.proyectos;

SELECT
  codigo,
  nombre,
  fecha_pedido,
  ejecutivo,
  valor_venta,
  valor_base
FROM public.proyectos
ORDER BY fecha_pedido NULLS LAST, codigo;
