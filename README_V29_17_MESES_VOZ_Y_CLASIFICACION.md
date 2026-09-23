# FESTOS V29.17 — Dashboard y clasificación histórica pendiente de confirmar

- El gráfico Valor por categoría reconoce proyectos Textil y variantes de mayúsculas/acentos, y muestra las 10 categorías vigentes. Se corrigió la grafía visible «Gran formato y ambientación», manteniendo reconocimiento del valor antiguo «Gran formato y Ambietacion».
- Los meses del gráfico son clicables y abren Proyectos filtrados por el mes elegido. Al pasar el cursor sobre un punto aparece solo el valor en soles junto al punto, sin círculos blancos permanentes ni panel inferior.
- FESTOS Voz queda oculto y sin capturar micrófono. Su código se conserva para una futura reactivación.
- Este ZIP no modifica Supabase, proyectos ni códigos PRY. No necesita ejecutar SQL para los cambios visuales.
- El archivo supabase/V29_17_PREVISUALIZAR_55_CATEGORIAS_SIN_TOCAR_PRY.sql solo consulta la base; prepara la tabla de 55 categorías históricas con sus 55 nombres y detecta coincidencias y dos equivalencias por confirmar. **NO actualiza la base.**
- Las categorías «Espacios y estructuras» y «Producción 360°» de la tabla nueva no aparecen entre las diez categorías aprobadas antes. No se convertirán silenciosamente a otras etiquetas: confirma las equivalencias primero y entonces se podrá entregar el SQL final de actualización con transacción, controles de coincidencia y protección PRY.
- Haz copia de seguridad del proyecto antes de reemplazar archivos. Conserva public/voice-assets (no está incluido en el ZIP). Prueba el Dashboard y los filtros en tu Windows antes de compilar un instalador para tus compañeros.
