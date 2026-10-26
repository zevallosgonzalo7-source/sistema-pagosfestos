# FESTOS V29.39.5 — Navegación y sesión

## Corregido
- Cambiar de pestaña del navegador ya NO devuelve al usuario a Inicio.
- Volver a FESTOS después de estar en otra pestaña conserva el módulo actual.
- Los eventos SIGNED_IN/TOKEN_REFRESHED de Supabase solo refrescan el perfil.
- Inicio se fuerza en un login real y al cargar la aplicación con una sesión válida.
- La bienvenida por voz se mantiene solo para un login real.

## Causa
Supabase puede emitir eventos de autenticación al recuperar el foco o refrescar el token. Antes, cada uno llamaba a `setVista('inicio')`.
