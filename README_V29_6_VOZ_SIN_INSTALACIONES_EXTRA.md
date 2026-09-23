# FESTOS V29.6 · Asistente de voz integrado (fase de pruebas)

## Qué cambió
- Se dejó de depender de la API de pago de V29.5 para la transcripción, voz y consultas habituales.
- En Windows/macOS (Electron), audio -> modelo Whisper Tiny **multilingüe** ejecutado localmente mediante Transformers.js / ONNX WASM, a partir de los archivos de voz incluidos en el instalador. La salida hablada utiliza las voces del sistema (speechSynthesis).
- En Chrome/Safari web, primero se prueba el reconocimiento de voz del navegador; si no existe, se intenta el modelo de voz local **si está servido en el despliegue web**. No es seguro que Safari tenga el mismo soporte que Chrome; hay que probarlo en cada versión del navegador. Algunos servicios de reconocimiento del navegador pueden procesar voz fuera del equipo.
- Se mantienen el botón flotante, navegación, borradores de proyectos/cotizaciones sin guardado automático, y consultas de proyectos con Supabase Auth/RLS: venta proyectada sin IGV, utilidad y número de proyectos. Sin SQL nuevo.

## IMPORTANTE: este ZIP no es todavía un instalador terminado
El modelo de voz contiene decenas de megabytes y NO se incluye en este ZIP de código. **No compartas este ZIP con los tres compañeros.** El desarrollador (Gonzalo) lo descarga y empaqueta UNA SOLA VEZ con `voice:prepare` ANTES de compilar el instalador. El instalador resultante sí contendrá los componentes requeridos; los compañeros no ejecutarán npm ni instalarán motores/modelos adicionales. La descarga de los componentes necesita internet en la PC que compila, y la aplicación seguirá necesitando acceso a Supabase para consultar datos.

## Preparación en tu PC (Windows)
1. Guarda una copia de V29.5 / del instalador que ya funciona.
2. Descomprime este proyecto en `C:\FESTOS_BUILD` con `package.json` directamente en esa carpeta.
3. Abre PowerShell y ejecuta:

```powershell
cd C:\FESTOS_BUILD
npm install
npm run voice:prepare
npm run voice:check
npm run desktop:dev
```

`voice:prepare` descarga los archivos del modelo multilingüe desde Hugging Face y copia el motor ONNX del paquete npm dentro de `public/voice-assets`. Debes ver `✓ Modelo y motor de voz empaquetados`. Puede tardar y aumentar el tamaño del proyecto. `voice:check` impedirá crear instaladores con componentes de voz faltantes.

4. Prueba en Windows: «abre proyectos», «crea cotización», «¿cuál es la venta proyectada?» y «¿cuál es la utilidad proyectada?». Confirma que el texto reconocido sea correcto, que responda con voz y que los campos aparezcan como borrador.
5. **Sólo después de probar** ejecuta `npm run desktop:build`; comparte con los compañeros el nuevo archivo `.exe` de `release/`, nunca la carpeta del proyecto. No necesitamos clave de OpenAI.

## Mac
La aplicación usa el mismo modelo local en el .dmg. Para crear el instalador macOS es necesario compilar en un Mac: `npm install`, `npm run voice:prepare` si la carpeta `public/voice-assets` aún no contiene los modelos, `npm run voice:check`, `npm run desktop:build:mac`. El usuario final del Mac sólo instala el .dmg. Sin una Mac real no se ha probado el permiso del micrófono ni la velocidad del motor.

## Límites y privacidad
- La interfaz usa el motor local offline para **convertir voz a texto** dentro de Electron. No es un LLM general y los comandos fuera de la gramática pueden no interpretarse; el acierto con nombres de clientes depende del audio y de la calidad del modelo pequeño.
- El modelo y el motor no requieren claves ni cuotas de API, pero una versión web que sirva los archivos de voz consumirá ancho de banda y almacenamiento del hosting; estos recursos pueden tener costo según el proveedor. No se exige descargar software extra, aunque el navegador descarga los recursos habituales de la página web.
- Algunas voces sintetizadas pueden sonar distintas o no estar disponibles según sistema/navegador. El usuario puede escribir al asistente como alternativa.
- No se guarda ni aprueba por voz. Supabase debe tener activada la seguridad V29 para que los permisos se apliquen **en el servidor**.
- Esta integración NO ha sido compilada ni probada con un micrófono real desde este entorno. Para evitar un instalador roto, `voice:check` se ejecuta antes del build del escritorio.

## Componentes
- Transformers.js (`@huggingface/transformers` v3.8.1); modelos `Xenova/whisper-tiny` de Hugging Face. Revisa los permisos/licencias de terceros antes de distribuir comercialmente.
- Modelo Whisper Tiny multilingüe (no uses la variante `whisper-tiny.en`: sólo inglés).
- La Edge Function de pago `festos-assistant` de V29.5 sigue en el árbol como archivo de referencia, pero **esta versión no la invoca**; no es necesario desplegarla ni crear `OPENAI_API_KEY`.
