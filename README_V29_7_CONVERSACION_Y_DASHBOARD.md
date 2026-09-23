# FESTOS V29.7 · Conversación continua + consultas del Dashboard proyectos

## Nuevo comportamiento del micrófono
- Un clic en el micrófono inicia una conversación que permanece activada hasta el siguiente clic. El botón muestra un cuadrado cuando el micrófono está activado.
- En la aplicación Windows/macOS (Electron), FESTOS detecta la voz y el silencio para procesar cada frase; escucha de nuevo automáticamente después de hablar. No es necesario pulsar cada vez. Espera a que termine de responder antes de hablar de nuevo.
- En Chrome/Safari, cuando exista reconocimiento de voz del navegador se reinicia para la frase siguiente. El reconocimiento del navegador puede tener límites propios; la compatibilidad real de Safari requiere una prueba en ese equipo.
- La voz se pausa mientras FESTOS procesa y lee su respuesta para no transcribir el sonido de sus propios altavoces. Puedes apagarla con otro clic en el micrófono.
- Si el ruido ambiental impide detectar el silencio, habla en frases cortas y usa un micrófono de auriculares; los segmentos de audio tienen un límite de duración.

## Preguntas nuevas
- «Hola», «¿Cómo estás?», «¿Qué hora es?», «¿Qué día es hoy?», «¿Qué puedes hacer?».
- «Dame un resumen del Dashboard», «¿Cuál es el valor de venta proyectado de Mar?», «¿Cuál es la utilidad proyectada?», «¿Cuánto es el costo estimado?», «¿Cuál es el margen?».
- «¿Cuántos proyectos están finalizados?», «Estado de proyectos», «¿Cuántas cotizaciones aprobadas hay?», «¿Cuántos clientes vinculados hay?», «¿Cuántos proveedores activos hay?».
- «Participación por ejecutivo», «Valor por línea de negocio», «Principales proyectos por valor», «Top clientes por proyectos», «Valor de proyectos por mes», «Proyectos vencidos» y «Próximas entregas» (solo si existen fechas de entrega).
- Puedes añadir «este mes», «mes pasado», «este trimestre», «todo el historial», «de Mar», «de Gonzalo» a consultas de proyectos, según corresponda.
- La venta de proyectos se calcula SIN IGV; usa el año en curso por defecto, igual que el Dashboard proyectos al abrirlo, y lo indica en la respuesta. Los filtros seleccionados manualmente en pantalla no se trasladan automáticamente a la voz: pide el período/ejecutivo por voz.
- El Dashboard ventas aún no tiene fuentes de datos y no se inventan cifras de esa vista.
- Navegación y preparación de proyectos/cotizaciones se mantienen. Guardar, aprobar y eliminar siguen requiriendo botones y permisos.

## Mejoras de transcripción
Se cambió Whisper Tiny por Whisper Base MULTILINGÜE cuantizado para mejorar la transcripción en español, con mayor tamaño de descarga e inferencia. Esto no garantiza que todas las palabras, clientes y montos se entiendan correctamente: REVISA en el panel «Escuché…» y confirma formularios manualmente. No supone usar un modelo general de IA ni un servicio de pago.

## En tu computadora de desarrollo (NO en las de tus compañeros)
1. Cierra FESTOS y guarda una copia de tu carpeta anterior, incluida `public/voice-assets`.
2. Descomprime el ZIP V29.7 encima de la carpeta del proyecto vigente (por ejemplo `sistema-pagosv2`), con `package.json` directamente en la carpeta elegida. La versión V29.7 contiene el PROYECTO, no el modelo binario ni el instalador.
3. Desde PowerShell en esa carpeta:

```powershell
npm install
npm run voice:prepare
npm run voice:check
npm run test:voice
npm run desktop:dev
```

`voice:prepare` es NECESARIO DE NUEVO: cambia a Whisper Base. Necesita internet y descarga archivos de voz más grandes **una vez en tu equipo**. No necesitas crear tablas SQL ni agregar una clave OpenAI. Si deseas conservar la versión anterior instalada, pruébala primero con `desktop:dev` y no compiles aún.

4. Prueba «Hola», «¿Qué hora es?», «Abre cotizaciones» y dos preguntas consecutivas SIN volver a tocar el micrófono. Observa «Escuché» si transcribe mal.
5. Cuando todo funcione, copia el proyecto preparado (incluido `public/voice-assets`) fuera de OneDrive a `C:\FESTOS_BUILD` y compila allí: `npm run desktop:build`. Instala el EXE resultante en TU PC y prueba el acceso directo y el micrófono antes de pasarlo a los compañeros. Ellos instalan únicamente FESTOS; no necesitan npm, modelos o motores extra. La aplicación consulta Supabase por internet.

## Estado de validación
Se ejecutaron pruebas unitarias del intérprete, saludos, calendario y clasificación del Dashboard, y comprobaciones de sintaxis en archivos JS. No se completó `npm install` en este entorno (agotó el tiempo); por eso no se pudo compilar Vite ni comprobar la captura real del micrófono o el nuevo modelo en Windows/Mac. Debes realizar la prueba local indicada antes de distribuir la versión.
