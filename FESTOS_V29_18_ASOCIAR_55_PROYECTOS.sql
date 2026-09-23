-- FESTOS V29.18: clasificación explícita de 55 proyectos. Ejecutar en Supabase SQL Editor.
-- Transacción atómica: ante duplicados o nombres sin coincidencia, no se actualiza nada.
-- Se modifica únicamente proyectos.lob; no se borran proyectos ni otros campos.
BEGIN;
CREATE TEMP TABLE festos_asignaciones (nombre text PRIMARY KEY, categoria text NOT NULL) ON COMMIT DROP;
INSERT INTO festos_asignaciones(nombre,categoria) VALUES
    ('SOMA - BACKING', 'Gran formato y ambientación'),
    ('XIAOMI - REBRANDING RULETAS', 'Gran formato y ambientación'),
    ('XIAOMI - REBRANDING MODULOS', 'Gran formato y ambientación'),
    ('XIAOMI - MEMORIAS Y FULL DEDOS', 'Gran formato y ambientación'),
    ('XIAOMI - LANZAMIENTO FSM CADENAS', 'Gran formato y ambientación'),
    ('XIAOMI - REBRANDING JULIO (servicios)', 'Gran formato y ambientación'),
    ('XIAOMI - REBRANDING JULIO (productos)', 'Gran formato y ambientación'),
    ('GRUPO PANA - ROMBOS Y PANELES BARBONES', 'Gran formato y ambientación'),
    ('GRUPO PANA - CHEQUES FOAM', 'Gran formato y ambientación'),
    ('XIAOMI - REBRANDING AGOSTO (JUEGOS)', 'Gran formato y ambientación'),
    ('GRUPO PANA - REBRANDING RULETA', 'Gran formato y ambientación'),
    ('XIAOMI - REBRANDING AGOSTO (2 módulos)', 'Gran formato y ambientación'),
    ('RICO POLLO - BRANDING DE CAMION', 'Gran formato y ambientación'),
    ('GRUPO PANA - JALAVISTA TOTEM', 'Gran formato y ambientación'),
    ('GRUPO PANA - VINIL PARA MODULO', 'Gran formato y ambientación'),
    ('XIAOMI - REBRANDING MEMORIAS PRIMAVERA', 'Gran formato y ambientación'),
    ('RICOH - BRANDEO DE OFICINA', 'Gran formato y ambientación'),
    ('XIAOMI - ROLL BANNERS FSC CLARO OCTUBRE', 'Gran formato y ambientación'),
    ('XIAOMI - 2000 GLOBOS', 'Merchandising promocional'),
    ('VIVO - KIT VIAJERO', 'Merchandising promocional'),
    ('GRUPO PANA - AMBIENTADORES', 'Merchandising promocional'),
    ('GRUPO PANA - MERCHANDISING', 'Merchandising promocional'),
    ('GRUPO PANA - VASO CAFETERO BLANCO', 'Merchandising promocional'),
    ('VIVO - MINI JOYERO', 'Kits, packs & especiales'),
    ('OVERALL - IML MINIJOYEROS', 'Kits, packs & especiales'),
    ('OVERALL - GIFT CREMAS', 'Kits, packs & especiales'),
    ('VIVO - CHOCOLATES VIZZIO', 'Kits, packs & especiales'),
    ('OVERALL - GALLETAS', 'Kits, packs & especiales'),
    ('VIVO - BOX TABLA QUESO', 'Kits, packs & especiales'),
    ('LENOVO - BOX AUDIFONOS', 'Kits, packs & especiales'),
    ('OVERALL EXECUTIVE - VASOS DIA DEL PADRE', 'Kits, packs & especiales'),
    ('CABIFY - BOX CAFETERA 2', 'Kits, packs & especiales'),
    ('CABIFY - BOX CAFETERA', 'Kits, packs & especiales'),
    ('OVERALL - PEÑA DEL CARAJO', 'Producción 360°'),
    ('OVERALL - INAUGURACIÓN RESTAURANTE', 'Producción 360°'),
    ('GRUPO PANA - 3 HORAS PERUANAS', 'Producción 360°'),
    ('PROMPERU - FESTIVAL DE CINE', 'Producción 360°'),
    ('OVERALL - IMPRESIONES CANAL MODERNO', 'Impresos comerciales'),
    ('GRUPO PANA - TARJETA Y STICKER 60 AÑOS', 'Impresos comerciales'),
    ('GRUPO PANA - TARJETAS', 'Impresos comerciales'),
    ('GRUPO PANA - VOLANTES TIRA Y RETIRA', 'Impresos comerciales'),
    ('GRUPO PANA - STICKERS OVERLAND', 'Impresos comerciales'),
    ('GRUPO PANA - VOLANTES A5', 'Impresos comerciales'),
    ('LENOVO - ACTIVACIÓN CURACAO', 'Proyecto integral'),
    ('CIGTEL - EVENTO CHUTANA', 'Proyecto integral'),
    ('XIAOMI - DEALER EVENT', 'Proyecto integral'),
    ('GRUPO PANA - ANIVERSARIO 60 AÑOS', 'Proyecto integral'),
    ('GRUPO PANA - CHUTANA OVERLAND', 'Proyecto integral'),
    ('SENIORS - STAND GLORIA', 'Espacios y estructuras'),
    ('SENIORS - STAND GLORIA ESAN', 'Espacios y estructuras'),
    ('RICOH - STAND EXPOALIMENTARIA 2026', 'Espacios y estructuras'),
    ('GRUPO PANA - PARANTE CON CARTEL SAN MIGUEL', 'Espacios y estructuras'),
    ('AJINOMOTO - STAND SUMMUN 2026', 'Espacios y estructuras'),
    ('PAY JOY - MATERIALES PUBLICITARIOS', 'Material POP'),
    ('PAY JOY - MATERIALES POP Q3', 'Material POP');
DO $$
DECLARE inconsistencias text;
BEGIN
  SELECT string_agg(a.nombre || ' (coincidencias: ' || (SELECT count(*) FROM public.proyectos p WHERE lower(regexp_replace(btrim(p.nombre), '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(btrim(a.nombre), '[[:space:]]+', ' ', 'g'))) || ')', E'\n') INTO inconsistencias
  FROM festos_asignaciones a
  WHERE (SELECT count(*) FROM public.proyectos p WHERE lower(regexp_replace(btrim(p.nombre), '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(btrim(a.nombre), '[[:space:]]+', ' ', 'g'))) <> 1;
  IF inconsistencias IS NOT NULL THEN
    RAISE EXCEPTION 'No se realizó ningún cambio. Revisar proyectos faltantes o duplicados: %', inconsistencias;
  END IF;
END $$;
UPDATE public.proyectos p SET lob=a.categoria FROM festos_asignaciones a
WHERE lower(regexp_replace(btrim(p.nombre), '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(btrim(a.nombre), '[[:space:]]+', ' ', 'g'))
  AND p.lob IS DISTINCT FROM a.categoria;
-- Verificación de las 55 asignaciones antes de confirmar.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM festos_asignaciones a JOIN public.proyectos p ON lower(regexp_replace(btrim(p.nombre), '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(btrim(a.nombre), '[[:space:]]+', ' ', 'g')) WHERE p.lob IS DISTINCT FROM a.categoria) THEN
 RAISE EXCEPTION 'Quedan categorías sin actualizar; se revierte la transacción'; END IF;
END $$;
COMMIT;
-- Consulta opcional: SELECT lob, count(*) FROM public.proyectos GROUP BY lob ORDER BY lob;
