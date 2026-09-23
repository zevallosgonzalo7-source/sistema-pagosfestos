# FESTOS · Preparación del instalador Windows (V26.4)

Este ZIP contiene **el código fuente preparado para generar el instalador**. **No es el instalador `.exe`**.

## En tu computadora Windows (solo quien prepara la app)
1. Descomprime el ZIP y abre la carpeta `festos_v25_win`.
2. Instala **Node.js 22 LTS o una versión compatible con Vite 8**, si aún no lo tienes.
3. Conéctate a Internet y haz doble clic en `CREAR_INSTALADOR_WINDOWS.cmd` (o abre PowerShell en esta carpeta y ejecuta `npm ci` y luego `npm run desktop:build`).
4. Si termina correctamente, busca `release/FESTOS-Gestion-Empresarial-Setup-1.0.0.exe`.
5. **Prueba primero el instalador completo en tu propio Windows**, no solo el EXE en `release/win-unpacked`. Comprueba inicio, login, gráficos, creación de proyecto y PDF.
6. Después sube **solo el archivo Setup `.exe`** a Drive, OneDrive u otro método autorizado por tu empresa y comparte el enlace con tu compañero.

## En el Windows de tu compañero
- Descarga el `Setup .exe`, ejecútalo, selecciona la carpeta si la solicita y abre FESTOS desde el acceso directo.
- **No necesita Node.js, npm ni descomprimir el proyecto.**
- Necesita Internet para acceder a la misma base Supabase de FESTOS y un usuario autorizado.
- El instalador aún no lleva firma digital: Windows puede mostrar una advertencia de editor desconocido. Comprueba la procedencia y solicita firma de código para distribución empresarial; no desactives las protecciones de Windows.

## Cambios técnicos de esta preparación
- Base de recursos de Vite relativa (`./`) para evitar pantalla vacía al cargar desde Electron (`file://`).
- Logos y manual usan rutas compatibles con web y app de escritorio.
- OneSignal web no se intenta inicializar en `file://`, donde no funciona como en HTTPS.
- Se suprimió el inicio de sesión con contraseñas de respaldo insertadas en código cliente. **Debe funcionar el RPC de Supabase `verificar_login`** para entrar al programa; configura un usuario individual para tu compañero antes de entregarlo.
- No se han cambiado datos, tablas ni el correlativo en Supabase.

## Seguridad (importante antes de compartir)
El proyecto todavía utiliza una sesión de aplicación en `localStorage`, por lo que quitar las credenciales de respaldo **no convierte el sistema en una autenticación de seguridad completa**. Antes de compartirlo fuera del equipo, revisa autenticación real con Supabase Auth y políticas RLS por usuario/rol. No almacenes claves `service_role` ni contraseñas de administradores en la app.

## Limitación de verificación
El proyecto fue preparado en un entorno distinto de Windows. El instalador `.exe` debe compilarse y probarse en un equipo Windows. Este ZIP no certifica que la compilación de Electron o el instalador se hayan ejecutado correctamente.
