-- ============================================================
-- FESTOS · ACTUALIZAR FECHA DE PEDIDO + VENDEDOR/EJECUTIVO
-- Fuente: ECONOMICS FESTOS(REG (1).csv
-- Filas del Excel: 55
--
-- MUY IMPORTANTE:
-- 1) ESTE SCRIPT NO MODIFICA public.proyectos.codigo.
-- 2) NO usa "ID PROYECTO" del Excel (PRJ), a propósito.
-- 3) NO inserta proyectos nuevos.
-- 4) NO reinicia, recalcula ni renumera el correlativo PRY.
-- 5) Solo:
--      - agrega fecha_pedido si no existe
--      - actualiza fecha_pedido
--      - actualiza ejecutivo con el VENDEDOR del Excel
-- 6) Si no encuentra exactamente 1 proyecto por cada fila del Excel,
--    el script se detiene y hace ROLLBACK.
-- 7) También guarda una foto temporal de todos los códigos PRY/codigo
--    y aborta si alguno cambia durante la operación.
--
-- Vendedores detectados:
--   MAR: 48
--   GONZALO: 7
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. PROTECCIÓN DEL CORRELATIVO / CÓDIGO
-- ------------------------------------------------------------
CREATE TEMP TABLE tmp_codigos_antes ON COMMIT DROP AS
SELECT id, codigo
FROM public.proyectos;

-- ------------------------------------------------------------
-- 1. NUEVO CAMPO DE FECHA
--    No alteramos created_at: esa fecha sigue siendo la fecha
--    técnica en la que el registro se creó en FESTOS.
-- ------------------------------------------------------------
ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS fecha_pedido DATE;

COMMENT ON COLUMN public.proyectos.fecha_pedido IS
  'Fecha de pedido/origen comercial del proyecto. Fuente histórica: Excel ECONOMICS FESTOS.';

-- ------------------------------------------------------------
-- 2. DATOS DEL EXCEL
--    Se omite deliberadamente ID PROYECTO / PRJ.
-- ------------------------------------------------------------
CREATE TEMP TABLE tmp_festos_fechas_vendedores (
  cliente_excel TEXT NOT NULL,
  proyecto_excel TEXT NOT NULL,
  fecha_pedido DATE NOT NULL,
  vendedor TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_festos_fechas_vendedores
(cliente_excel, proyecto_excel, fecha_pedido, vendedor)
VALUES
  ('B & G ENTERTAINMENT S.A.C.', 'SOMA - BACKING', DATE '2026-04-15', 'GONZALO'),
  ('MARKETING POWER S.A.C.', 'XIAOMI - 2000 GLOBOS', DATE '2026-04-23', 'MAR'),
  ('FORESAIL PERU SOCIEDAD ANONIMA CERRADA', 'VIVO - KIT VIAJERO', DATE '2026-04-24', 'MAR'),
  ('FORESAIL PERU SOCIEDAD ANONIMA CERRADA', 'VIVO - MINI JOYERO', DATE '2026-04-24', 'MAR'),
  ('MARKETING POWER S.A.C.', 'OVERALL - PEÑA DEL CARAJO', DATE '2026-04-27', 'MAR'),
  ('MARKETING POWER S.A.C.', 'OVERALL - IMPRESIONES CANAL MODERNO', DATE '2026-04-28', 'MAR'),
  ('MARKETING POWER S.A.C.', 'XIAOMI - REBRANDING RULETAS', DATE '2026-05-05', 'MAR'),
  ('INDUSTRY & LOGISTICS MANAGEMENT SOCIEDAD ANONIMA', 'OVERALL - IML MINIJOYEROS', DATE '2026-05-05', 'MAR'),
  ('MARKETING POWER S.A.C.', 'OVERALL - GIFT CREMAS', DATE '2026-05-06', 'MAR'),
  ('FORESAIL PERU SOCIEDAD ANONIMA CERRADA', 'VIVO - CHOCOLATES VIZZIO', DATE '2026-05-08', 'MAR'),
  ('MARKETING POWER S.A.C.', 'LENOVO - ACTIVACIÓN CURACAO', DATE '2026-05-21', 'MAR'),
  ('CORPORATE INVESTMENT GROUP AND SERVICE S.A.C.', 'CIGTEL - EVENTO CHUTANA', DATE '2026-05-22', 'GONZALO'),
  ('OVERALL ORIENTE S.A.C.', 'OVERALL - GALLETAS', DATE '2026-05-22', 'MAR'),
  ('MARKETING POWER S.A.C.', 'XIAOMI - REBRANDING MODULOS', DATE '2026-05-22', 'MAR'),
  ('MARKETING POWER S.A.C.', 'XIAOMI - MEMORIAS Y FULL DEDOS', DATE '2026-05-27', 'MAR'),
  ('SENIORS AGENCIA S.A.C', 'SENIORS - STAND GLORIA', DATE '2026-05-29', 'MAR'),
  ('FORESAIL PERU SOCIEDAD ANONIMA CERRADA', 'VIVO - BOX TABLA QUESO', DATE '2026-05-30', 'MAR'),
  ('MARKETING POWER S.A.C.', 'XIAOMI - DEALER EVENT', DATE '2026-06-04', 'MAR'),
  ('MARKETING POWER S.A.C.', 'XIAOMI - LANZAMIENTO FSM CADENAS', DATE '2026-06-04', 'MAR'),
  ('MARKETING POWER S.A.C.', 'LENOVO - BOX AUDIFONOS', DATE '2026-06-09', 'MAR'),
  ('EXECUTIVE SOLUTIONS SOCIEDAD ANONIMA', 'OVERALL EXECUTIVE - VASOS DIA DEL PADRE', DATE '2026-06-10', 'MAR'),
  ('MAXI MOBILITY PERU S.A.C.', 'CABIFY - BOX CAFETERA', DATE '2026-06-10', 'MAR'),
  ('CABIFY LOGISTICS PERU S.A.C.', 'CABIFY - BOX CAFETERA', DATE '2026-06-10', 'MAR'),
  ('SENIORS AGENCIA S.A.C', 'SENIORS - STAND GLORIA ESAN', DATE '2026-06-19', 'GONZALO'),
  ('OVERALL ORIENTE S.A.C.', 'OVERALL - INAUGURACIÓN RESTAURANTE', DATE '2026-06-30', 'MAR'),
  ('MARKETING POWER S.A.C.', 'XIAOMI - REBRANDING JULIO (servicios)', DATE '2026-07-01', 'MAR'),
  ('MARKETING POWER S.A.C.', 'XIAOMI - REBRANDING JULIO (productos)', DATE '2026-07-01', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - 3 HORAS PERUANAS', DATE '2026-07-03', 'GONZALO'),
  ('MARKETING POWER S.A.C.', 'PAY JOY - MATERIALES PUBLICITARIOS', DATE '2026-07-08', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - ROMBOS Y PANELES BARBONES', DATE '2026-07-08', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - CHEQUES FOAM', DATE '2026-07-08', 'MAR'),
  ('MARKETING POWER S.A.C.', 'XIAOMI - REBRANDING AGOSTO (JUEGOS)', DATE '2026-08-03', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - REBRANDING RULETA', DATE '2026-08-04', 'MAR'),
  ('MARKETING POWER S.A.C.', 'XIAOMI - REBRANDING AGOSTO (2 módulos)', DATE '2026-08-05', 'MAR'),
  ('MARKETING POWER S.A.C.', 'PAY JOY - MATERIALES POP Q3', DATE '2026-08-05', 'MAR'),
  ('COMISION DE PROMOCION DEL PERU PARA LA EXPORTACION Y EL TURISMO - PROMPERU', 'PROMPERU - FESTIVAL DE CINE', DATE '2026-08-05', 'GONZALO'),
  ('MARKETING POWER S.A.C.', 'RICO POLLO - BRANDING DE CAMION', DATE '2026-08-13', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - JALAVISTA TOTEM', DATE '2026-08-14', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - ANIVERSARIO 60 AÑOS', DATE '2026-08-14', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - TARJETA Y STICKER 60 AÑOS', DATE '2026-08-17', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - TARJETAS', DATE '2026-08-25', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - VINIL PARA MODULO', DATE '2026-08-25', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - VOLANTES TIRA Y RETIRA', DATE '2026-08-25', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - AMBIENTADORES', DATE '2026-08-27', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - MERCHANDISING', DATE '2026-09-01', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - VASO CAFETERO BLANCO', DATE '2026-09-01', 'MAR'),
  ('RICOH DEL PERU S .A.C.', 'RICOH - STAND EXPOALIMENTARIA 2026', DATE '2026-09-01', 'MAR'),
  ('MARKETING POWER S.A.C.', 'XIAOMI - REBRANDING MEMORIAS PRIMAVERA', DATE '2026-09-01', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - CHUTANA OVERLAND', DATE '2026-09-01', 'GONZALO'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - PARANTE CON CARTEL SAN MIGUEL', DATE '2026-09-03', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - STICKERS OVERLAND', DATE '2026-09-03', 'MAR'),
  ('GRUPO PANA S.A.', 'GRUPO PANA - VOLANTES A5', DATE '2026-09-08', 'MAR'),
  ('RICOH DEL PERU S .A.C.', 'RICOH - BRANDEO DE OFICINA', DATE '2026-09-15', 'MAR'),
  ('MARKETING POWER S.A.C.', 'XIAOMI - ROLL BANNERS FSC CLARO OCTUBRE', DATE '2026-09-15', 'MAR'),
  ('SENIORS AGENCIA S.A.C', 'AJINOMOTO - STAND SUMMUN 2026', DATE '2026-09-18', 'GONZALO');

-- ------------------------------------------------------------
-- 3. EMPAREJAMIENTO SEGURO
--    Coincide por:
--      CLIENTE + NOMBRE DEL PROYECTO
--    No coincide por PRJ/PRY.
-- ------------------------------------------------------------
CREATE TEMP TABLE tmp_festos_matches ON COMMIT DROP AS
SELECT
  t.cliente_excel,
  t.proyecto_excel,
  t.fecha_pedido,
  t.vendedor,
  p.id AS proyecto_id,
  p.codigo AS codigo_actual,
  c.nombre AS cliente_bd,
  p.nombre AS proyecto_bd
FROM tmp_festos_fechas_vendedores t
LEFT JOIN public.clientes c
  ON regexp_replace(upper(trim(c.nombre)), '[^A-Z0-9]', '', 'g')
   = regexp_replace(upper(trim(t.cliente_excel)), '[^A-Z0-9]', '', 'g')
LEFT JOIN public.proyectos p
  ON p.client_id = c.id
 AND regexp_replace(upper(trim(p.nombre)), '[^A-Z0-9]', '', 'g')
   = regexp_replace(upper(trim(t.proyecto_excel)), '[^A-Z0-9]', '', 'g');

-- ------------------------------------------------------------
-- 4. PREVISUALIZACIÓN
-- ------------------------------------------------------------
SELECT
  cliente_excel,
  proyecto_excel,
  fecha_pedido,
  vendedor,
  codigo_actual,
  CASE
    WHEN proyecto_id IS NULL THEN 'NO ENCONTRADO'
    ELSE 'OK'
  END AS estado
FROM tmp_festos_matches
ORDER BY fecha_pedido, proyecto_excel;

SELECT
  COUNT(*) AS filas_excel,
  COUNT(proyecto_id) AS coincidencias,
  COUNT(*) FILTER (WHERE proyecto_id IS NULL) AS no_encontrados
FROM tmp_festos_matches;

-- ------------------------------------------------------------
-- 5. VALIDACIÓN FUERTE
--    Deben existir exactamente 55 coincidencias únicas.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_total INTEGER;
  v_encontrados INTEGER;
  v_ids_unicos INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(proyecto_id),
    COUNT(DISTINCT proyecto_id)
  INTO
    v_total,
    v_encontrados,
    v_ids_unicos
  FROM tmp_festos_matches;

  IF v_total <> 55 THEN
    RAISE EXCEPTION
      'FESTOS: se esperaban 55 filas del Excel y se cargaron %.', v_total;
  END IF;

  IF v_encontrados <> 55 THEN
    RAISE EXCEPTION
      'FESTOS: solo se encontraron % de 55 proyectos. NO se aplicó ningún cambio.', v_encontrados;
  END IF;

  IF v_ids_unicos <> 55 THEN
    RAISE EXCEPTION
      'FESTOS: hay coincidencias duplicadas/ambiguas. Proyectos únicos: %. NO se aplicó ningún cambio.', v_ids_unicos;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. ACTUALIZACIÓN
--    ÚNICAMENTE fecha_pedido y ejecutivo.
-- ------------------------------------------------------------
UPDATE public.proyectos p
SET
  fecha_pedido = m.fecha_pedido,
  ejecutivo = CASE
    WHEN m.vendedor = 'MAR' THEN 'MAR'
    WHEN m.vendedor = 'GONZALO' THEN 'GONZALO'
    ELSE p.ejecutivo
  END
FROM tmp_festos_matches m
WHERE p.id = m.proyecto_id;

-- ------------------------------------------------------------
-- 7. COMPROBACIÓN: EL CÓDIGO / PRY DEBE QUEDAR IDÉNTICO
-- ------------------------------------------------------------
DO $$
DECLARE
  v_cambios_codigo INTEGER;
  v_cantidad_antes INTEGER;
  v_cantidad_despues INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_cambios_codigo
  FROM tmp_codigos_antes a
  JOIN public.proyectos p ON p.id = a.id
  WHERE p.codigo IS DISTINCT FROM a.codigo;

  SELECT COUNT(*) INTO v_cantidad_antes FROM tmp_codigos_antes;
  SELECT COUNT(*) INTO v_cantidad_despues FROM public.proyectos;

  IF v_cambios_codigo > 0 THEN
    RAISE EXCEPTION
      'SEGURIDAD PRY: se detectaron % códigos modificados. Se cancela todo.', v_cambios_codigo;
  END IF;

  IF v_cantidad_antes <> v_cantidad_despues THEN
    RAISE EXCEPTION
      'SEGURIDAD PRY: cambió la cantidad de proyectos (% -> %). Se cancela todo.',
      v_cantidad_antes, v_cantidad_despues;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 8. VERIFICACIÓN FINAL
-- ------------------------------------------------------------
SELECT
  p.codigo,
  c.nombre AS cliente,
  p.nombre AS proyecto,
  p.fecha_pedido,
  p.ejecutivo
FROM public.proyectos p
LEFT JOIN public.clientes c ON c.id = p.client_id
JOIN tmp_festos_matches m ON m.proyecto_id = p.id
ORDER BY p.fecha_pedido, p.codigo;

COMMIT;

-- ============================================================
-- RESULTADO ESPERADO
-- ============================================================
-- - 55 proyectos actualizados.
-- - fecha_pedido cargada desde F.PEDIDO.
-- - ejecutivo cargado desde VENDEDOR (MAR/GONZALO).
-- - codigo / PRY exactamente igual que antes.
-- - ningún proyecto nuevo.
-- - ningún correlativo recalculado.
-- ============================================================
