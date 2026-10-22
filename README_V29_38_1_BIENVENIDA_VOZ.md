# FESTOS V29.38.1 — Bienvenida por voz

## Cambio principal
Se agregó una bienvenida hablada automática al ingresar a FESTOS.

Ejemplo para Rodrigo:

> Buenos días, Rodrigo. Bienvenido a FESTOS Gestión. Tienes acceso como desarrollador de software. Tu espacio de trabajo está listo.

## Comportamiento
- Cambia automáticamente entre Buenos días / Buenas tardes / Buenas noches.
- Usa el primer nombre real del perfil FESTOS.
- Lee el cargo real del perfil.
- Para DESARROLLADOR SOFTWARE se pronuncia "desarrollador de software".
- Se reproduce una sola vez durante la sesión actual para evitar repetirse al refrescar.
- Al cerrar sesión se reinicia, por lo que sonará nuevamente en el próximo ingreso.
- Usa `window.speechSynthesis`; no requiere API ni servicio externo.
- Prioriza una voz `es-PE` disponible en el dispositivo y, si no existe, cualquier voz en español.

## Archivos modificados
- `src/App.jsx`

## Nota
El navegador/sistema operativo determina la voz concreta disponible. El texto, velocidad e idioma se configuran desde FESTOS.
