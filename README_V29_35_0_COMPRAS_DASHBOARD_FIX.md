# FESTOS V29.35.0

Cambios incluidos:
- FIX crítico: "Compras sin adjunto" ya no deja la pantalla en blanco.
  - La causa era que el filtro invocaba `tieneAlgunAdjunto` antes de inicializar la función durante el render.
  - El helper ahora se define antes del useMemo.
- FIX edición de compras antiguas con valores null:
  - todos los `.trim()` sensibles quedan normalizados con `String(valor || '')`.
- En la tarjeta de compra se muestran, sin abrir detalle:
  - Categoría de gasto
  - Tipo de comprobante
- Esos dos campos se retiraron del detalle expandido para evitar duplicación.
- Nuevo Dashboard de Compras de prueba, conectado a Supabase:
  - Valor compra
  - Crédito fiscal
  - Precio de compra
  - Compras sin adjunto
  - Valor por categoría de gasto
  - Valor por CeCo
- En el módulo Dashboard, al pasar el cursor (o enfocar/tocar) aparece:
  - Proyectos
  - Compras
- No requiere SQL nuevo respecto a V29.34.8.
