-- Solo lectura. No cambia datos, códigos PRY ni correlativos.
SELECT codigo, nombre, lob AS categoria_guardada, fecha_pedido, created_at
FROM public.proyectos
WHERE upper(nombre) LIKE '%TEXTIL%' OR upper(coalesce(lob,'')) LIKE '%TEXTIL%'
ORDER BY created_at DESC LIMIT 25;
SELECT coalesce(lob, '(sin categoría)') AS categoria_guardada, count(*) AS proyectos
FROM public.proyectos GROUP BY lob ORDER BY proyectos DESC;
