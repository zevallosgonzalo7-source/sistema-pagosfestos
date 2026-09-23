-- SOLO LECTURA: comprueba categoría física (lob), fecha comercial y monto.
-- No modifica ni códigos PRY ni el resto de registros.
SELECT codigo, nombre, lob AS categoria_guardada, valor_base AS valor_sin_igv,
       valor_venta, fecha_pedido, created_at
FROM public.proyectos
WHERE upper(coalesce(lob,'')) LIKE '%TEXTIL%'
   OR upper(coalesce(nombre,'')) LIKE '%PRUEBA%'
ORDER BY created_at DESC
LIMIT 30;
