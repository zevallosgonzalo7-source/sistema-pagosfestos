# FESTOS V29.41 — Premium Intro + Continuidad de Compras

## 1. Intro premium FESTOS
- Se activa únicamente después de un login real.
- No se repite por cambio de pestaña ni por refresh del token de Supabase.
- Duración aproximada: 2.4 s.
- Wordmark FESTOS con blur/glow y entrada suave.
- Teléfono 3D con preview interno del sistema.
- Responsive para escritorio y móvil.
- Adaptación light/dark.
- Botón Omitir.

## 2. Registro de Compras — Continuar registro
- El formulario nuevo se guarda automáticamente como borrador local por usuario.
- Si se cierra el modal, se cambia de módulo o se recarga el navegador, FESTOS ofrece “Continuar registro”.
- Banner con acciones Continuar / Descartar.
- Al completar la compra correctamente, el borrador se elimina automáticamente.
- Los datos del formulario se recuperan; por seguridad del navegador, archivos locales deben volver a seleccionarse tras una recarga completa.
- No requiere cambios SQL ni tablas nuevas.

## 3. Base visual
Conserva las mejoras V29.40.2 Motion Luxe + densidad visual, fondo reactivo y microinteracciones.

## Validación
La revisión estática de los cambios fue completada. El build local no pudo ejecutarse en el entorno de empaquetado porque `vite` no estaba disponible y la instalación de dependencias agotó el tiempo permitido. Ejecutar en el equipo de desarrollo:

npm install
npm run build
npm run dev
