# FESTOS V29.32.5 — Excel con ítems basado en referencia V29.29

- Exportación Excel reconstruida siguiendo la estructura del archivo `COTIZACION_FESTOS_REFERENCIA_V29_29.xlsx`.
- Los ítems se leen directamente desde `cotizacion_items` en Supabase antes de generar el archivo.
- Si no hay ítems guardados, la app avisa y no genera un Excel vacío.
- Se eliminó el congelado de 22 filas, que podía dejar la tabla de ítems fuera del área visible al abrir Excel.
- Se eliminó la imagen binaria embebida y el autofiltro para maximizar compatibilidad con Microsoft Excel de Windows.
- Encabezados de ítems: N°, Descripción, Cantidad, Valor unitario, Valor venta, Costo unitario, Costo total, Margen (%).
- Se agrega una fila TOTAL indicando cuántos ítems fueron exportados.
