-- SOLO LECTURA. No modifica proyectos, códigos PRY ni categorías.
SELECT p.codigo, p.nombre, p.lob AS categoria_almacenada,
       p.fecha_pedido, p.created_at, p.valor_base, p.valor_venta,
       p.ejecutivo
FROM public.proyectos p
WHERE upper(coalesce(p.lob, '')) LIKE '%TEXTIL%'
   OR upper(coalesce(p.nombre, '')) LIKE '%PRUEBA%'
ORDER BY p.created_at DESC LIMIT 50;
