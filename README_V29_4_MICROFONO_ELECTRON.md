# FESTOS V29.4 — Micrófono en Electron

## Corrección
La V29.3 denegaba **todos los permisos de medios** en `electron/main.cjs`. Esta versión permite solicitudes de **solo audio** a la ventana principal FESTOS, sin permitir cámara, captura de pantalla ni sitios externos. Mantiene el asistente, formularios y funciones de V29.3.

## Prueba
1. En Windows, habilita acceso al micrófono y a aplicaciones de escritorio en Configuración → Privacidad y seguridad → Micrófono.
2. Ejecuta `npm install` y `npm run desktop:dev` desde la carpeta con `package.json`.
3. Pulsa el micrófono flotante y pronuncia «abre proyectos». Confirma cualquier petición de permiso que aparezca.

## Límite importante
Permitir el micrófono **no garantiza** que el servicio `SpeechRecognition` funcione en Electron: según el motor Chromium, puede producir `service-not-allowed` o `network`. Esta versión corrige el bloqueo de permisos que sí se detectó; no integra un motor de transcripción alternativo. Si sigues viendo un error de servicio, hace falta una transcripción por backend (p. ej. Edge Function con clave privada), o dictar con Windows + H en el campo de texto. No introduzcas una clave privada de IA en el frontend o en Electron.

## Seguridad
El reconocimiento disponible en Chromium puede transmitir audio a un proveedor externo. Evita dictar datos confidenciales hasta conocer y aprobar el proveedor de voz. No se cambia RLS ni las tablas Supabase. Ningún registro se guarda, aprueba o elimina por voz.
