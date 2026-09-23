-- FESTOS: PREVISUALIZACIÓN SIN ESCRITURA de las 55 categorías históricas.
-- Esta consulta NO toca PRY, código, proyectos ni el correlativo.
-- Confronta cada nombre con public.proyectos; se espera que CABIFY aparezca dos veces.
-- IMPORTANTE: dos rótulos del cuadro no tienen equivalencia inequívoca con
-- las 10 categorías vigentes de FESTOS: «Espacios y estructuras» y «Producción 360°».
-- Se dejan SIN PROPUESTA hasta que confirmes a cuál categoría vigente pertenecen.
-- Tampoco se supone que «PRJ» del CSV corresponda al código PRY actual.
WITH origen (proyecto_excel, categoria_excel, categoria_propuesta) AS (
 VALUES
  ('SOMA - BACKING', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('XIAOMI - 2000 GLOBOS', 'Merchandising promocional', 'Merchandising promocional'),
  ('VIVO - KIT VIAJERO', 'Merchandising promocional', 'Merchandising promocional'),
  ('VIVO - MINI JOYERO', 'Kits, packs & especiales', 'Kits, packs y especiales'),
  ('OVERALL - PEÑA DEL CARAJO', 'Producción 360°', NULL),
  ('OVERALL - IMPRESIONES CANAL MODERNO', 'Impresos comerciales', 'Impresos comerciales'),
  ('XIAOMI - REBRANDING RULETAS', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('OVERALL - IML MINIJOYEROS', 'Kits, packs & especiales', 'Kits, packs y especiales'),
  ('OVERALL - GIFT CREMAS', 'Kits, packs & especiales', 'Kits, packs y especiales'),
  ('VIVO - CHOCOLATES VIZZIO', 'Kits, packs & especiales', 'Kits, packs y especiales'),
  ('LENOVO - ACTIVACIÓN CURACAO', 'Proyecto integral', 'Implementacion integral'),
  ('CIGTEL - EVENTO CHUTANA', 'Proyecto integral', 'Implementacion integral'),
  ('OVERALL - GALLETAS', 'Kits, packs & especiales', 'Kits, packs y especiales'),
  ('XIAOMI - REBRANDING MODULOS', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('XIAOMI - MEMORIAS Y FULL DEDOS', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('SENIORS - STAND GLORIA', 'Espacios y estructuras', NULL),
  ('VIVO - BOX TABLA QUESO', 'Kits, packs & especiales', 'Kits, packs y especiales'),
  ('XIAOMI - DEALER EVENT', 'Proyecto integral', 'Implementacion integral'),
  ('XIAOMI - LANZAMIENTO FSM CADENAS', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('LENOVO - BOX AUDIFONOS', 'Kits, packs & especiales', 'Kits, packs y especiales'),
  ('OVERALL EXECUTIVE - VASOS DIA DEL PADRE', 'Kits, packs & especiales', 'Kits, packs y especiales'),
  ('CABIFY - BOX CAFETERA', 'Kits, packs & especiales', 'Kits, packs y especiales'),
  ('CABIFY - BOX CAFETERA', 'Kits, packs & especiales', 'Kits, packs y especiales'),
  ('SENIORS - STAND GLORIA ESAN', 'Espacios y estructuras', NULL),
  ('OVERALL - INAUGURACIÓN RESTAURANTE', 'Producción 360°', NULL),
  ('XIAOMI - REBRANDING JULIO (servicios)', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('XIAOMI - REBRANDING JULIO (productos)', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('GRUPO PANA - 3 HORAS PERUANAS', 'Producción 360°', NULL),
  ('PAY JOY - MATERIALES PUBLICITARIOS', 'Material POP', 'Exhibicion y Material POP'),
  ('GRUPO PANA - ROMBOS Y PANELES BARBONES', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('GRUPO PANA - CHEQUES FOAM', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('XIAOMI - REBRANDING AGOSTO (JUEGOS)', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('GRUPO PANA - REBRANDING RULETA', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('XIAOMI - REBRANDING AGOSTO (2 módulos)', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('PAY JOY - MATERIALES POP Q3', 'Material POP', 'Exhibicion y Material POP'),
  ('PROMPERU - FESTIVAL DE CINE', 'Producción 360°', NULL),
  ('RICO POLLO - BRANDING DE CAMION', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('GRUPO PANA - JALAVISTA TOTEM', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('GRUPO PANA - ANIVERSARIO 60 AÑOS', 'Proyecto integral', 'Implementacion integral'),
  ('GRUPO PANA - TARJETA Y STICKER 60 AÑOS', 'Impresos comerciales', 'Impresos comerciales'),
  ('GRUPO PANA - TARJETAS', 'Impresos comerciales', 'Impresos comerciales'),
  ('GRUPO PANA - VINIL PARA MODULO', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('GRUPO PANA - VOLANTES TIRA Y RETIRA', 'Impresos comerciales', 'Impresos comerciales'),
  ('GRUPO PANA - AMBIENTADORES', 'Merchandising promocional', 'Merchandising promocional'),
  ('GRUPO PANA - MERCHANDISING', 'Merchandising promocional', 'Merchandising promocional'),
  ('GRUPO PANA - VASO CAFETERO BLANCO', 'Merchandising promocional', 'Merchandising promocional'),
  ('RICOH - STAND EXPOALIMENTARIA 2026', 'Espacios y estructuras', NULL),
  ('XIAOMI - REBRANDING MEMORIAS PRIMAVERA', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('GRUPO PANA - CHUTANA OVERLAND', 'Proyecto integral', 'Implementacion integral'),
  ('GRUPO PANA - PARANTE CON CARTEL SAN MIGUEL', 'Espacios y estructuras', NULL),
  ('GRUPO PANA - STICKERS OVERLAND', 'Impresos comerciales', 'Impresos comerciales'),
  ('GRUPO PANA - VOLANTES A5', 'Impresos comerciales', 'Impresos comerciales'),
  ('RICOH - BRANDEO DE OFICINA', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('XIAOMI - ROLL BANNERS FSC CLARO OCTUBRE', 'Gran formato y ambientación', 'Gran formato y ambientación'),
  ('AJINOMOTO - STAND SUMMUN 2026', 'Espacios y estructuras', NULL)
), resumen_origen AS (
 SELECT proyecto_excel, categoria_excel, categoria_propuesta, count(*) AS filas_excel
 FROM origen GROUP BY 1,2,3
), coincidencias AS (
 SELECT o.proyecto_excel, o.categoria_excel, o.categoria_propuesta, o.filas_excel,
        count(p.id) AS coincidencias_en_base,
        string_agg(p.codigo || ' (' || coalesce(p.lob,'SIN CATEGORIA') || ')', ' | ' ORDER BY p.codigo) AS codigos_actuales
 FROM resumen_origen o
 LEFT JOIN public.proyectos p
 ON regexp_replace(translate(upper(btrim(p.nombre)), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'), '[^A-Z0-9]', '', 'g') =
    regexp_replace(translate(upper(btrim(o.proyecto_excel)), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'), '[^A-Z0-9]', '', 'g')
 GROUP BY 1,2,3,4
)
SELECT proyecto_excel, categoria_excel, categoria_propuesta,
       filas_excel, coincidencias_en_base, codigos_actuales,
       CASE
         WHEN categoria_propuesta IS NULL THEN 'PENDIENTE: CONFIRMAR EQUIVALENCIA'
         WHEN filas_excel <> coincidencias_en_base THEN 'REVISAR COINCIDENCIAS ANTES DE ACTUALIZAR'
         ELSE 'LISTO PARA CLASIFICAR'
       END AS estado
FROM coincidencias ORDER BY proyecto_excel;
