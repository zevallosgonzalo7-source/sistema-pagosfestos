# FESTOS V29.38.2 — Bienvenida por voz IA (OpenAI)

## Qué cambia
La bienvenida del Inicio usa una voz TTS de OpenAI más natural. Si el servicio no está disponible, FESTOS cae automáticamente a la voz local del navegador.

Ejemplo para Rodrigo:
> Buenos días, Rodrigo. Bienvenido a FESTOS Gestión. Tienes acceso como desarrollador de software. Tu espacio de trabajo está listo.

## Configuración en Vercel
Agregar una variable de entorno SOLO en Vercel:

- `OPENAI_API_KEY` = tu API key de OpenAI

No uses `VITE_OPENAI_API_KEY`: una variable `VITE_` queda expuesta al navegador.

La función serverless también usa las variables existentes de Supabase. Acepta cualquiera de estas combinaciones:

- `SUPABASE_URL` + `SUPABASE_ANON_KEY`
- o las ya existentes `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

Después de guardar las variables, vuelve a desplegar el proyecto en Vercel.

## Seguridad
`/api/festos-welcome-voice` exige un JWT válido de Supabase antes de consumir OpenAI. La API key de OpenAI nunca se envía al frontend.

## Transparencia
En Inicio aparece la indicación “Voz de bienvenida generada por IA”.

## Nota técnica
Esta versión usa `gpt-4o-mini-tts-2025-12-15` con la voz `marin`. OpenAI ha anunciado el retiro de la familia GPT-4o mini TTS para el 6 de enero de 2027; antes de esa fecha deberá migrarse a la opción Realtime vigente.
