# FESTOS V29.12 · Activación por voz y consultas puntuales en vivo

## Qué se implementó

- Opción individual «Activar con Hola Festos» en el panel flotante de voz. El usuario la habilita una vez y concede el permiso de micrófono del sistema/navegador; en las siguientes aperturas de FESTOS se intenta restablecer el modo de espera automáticamente tras iniciar sesión. Se guarda por correo y equipo, no en Supabase.
- Tras escuchar «Hola Festos», inicia la conversación sin pulsar botón; admite «Hola Festos, abre proyectos» en una frase. Se mantiene escuchando para preguntas sucesivas; «Hasta luego Festos» vuelve al modo de espera. Se puede apagar totalmente desmarcando la opción; el botón manual sigue disponible.
- Consultas de lectura por nombre/código de proyectos y cotizaciones, y por nombre de clientes y proveedores. Obtiene datos de Supabase en el momento de cada pregunta con la sesión y RLS de ese usuario. Si hay varios resultados pide precisión; NO ejecuta escrituras ni SQL libre.
- Continúan disponibles las consultas agregadas del Dashboard proyectos, la creación de borradores de proyectos y cotizaciones y la navegación por apartados permitidos.

## Límites importantes

- Esta versión NO integra un modelo generativo para responder literalmente cualquier pregunta o razonar sobre toda la base: sus respuestas cubren las preguntas y campos programados. Para consultas libres complejas necesita integrar un modelo local empaquetado (mayor instalador, carga de CPU/RAM) o un servicio remoto (tarifa y privacidad/configuración). Tampoco puede consultar el Dashboard ventas no conectado ni archivos externos sin integración adicional.
- «En tiempo real» significa consulta actual a Supabase al formular cada pregunta, no streaming de audio ni garantía de respuesta instantánea. Whisper Base en Electron transcribe fragmentos y puede tardar; escuchar continuamente consume CPU y batería.
- En modo espera se captan y transcriben fragmentos para detectar la frase; no se almacenan deliberadamente ni se procesan como comandos si no hay coincidencia. En Chrome/Safari el reconocimiento integrado puede depender del proveedor del navegador. Activa esta opción solo con conocimiento de quienes comparten la habitación.
- Solo escucha mientras FESTOS está abierto y la sesión iniciada. El navegador puede suspender el micrófono en segundo plano o exigir una interacción inicial; permisos denegados requieren intervención manual. En escritorio requiere el modelo local ya preparado con `npm run voice:prepare`.
- **No hay cambios en Supabase, PRY, migraciones SQL o roles**. Se respetan Auth, RLS y permisos de pantalla. Las acciones de guardar/aprobar/eliminar siguen requiriendo confirmación manual.

## Actualización y pruebas

1. Respalda `sistema-pagosv2` y reemplaza el código con V29.12 sin borrar `public/voice-assets/` ya preparado. Si el modelo está ausente, ejecuta `npm run voice:prepare` una vez en el equipo de desarrollo.
2. Desde la carpeta con `package.json`, ejecuta `npm install`, `npm run test:voice` y `npm run desktop:dev`.
3. Abre el panel pequeño junto al micrófono y habilita «Activar con Hola Festos» una vez. Autoriza el micrófono si te lo solicita el sistema. Verás «En espera: di Hola Festos».
4. Di «Hola Festos», después «Abre Proyectos», «¿Cuál es la utilidad proyectada?» y «Hasta luego Festos». Sin tocar botones, di «Hola Festos, dime el estado del proyecto PRY-202609-055». Los datos varían según permisos y registros reales.
5. Desmarca la opción y comprueba que el indicador de escucha se apaga. Cierra y abre FESTOS, habilita de nuevo y prueba el arranque automático con permisos concedidos.
6. Compila y prueba el instalador en Windows antes de compartir. Chrome y Safari necesitan pruebas separadas, sobre todo para activación de micrófono tras recargar.

Esta versión está entregada como **integración para pruebas**, no como producto ya validado en Windows/macOS/Safari: la compilación Vite y la escucha real deben comprobarse en tu instalación.
