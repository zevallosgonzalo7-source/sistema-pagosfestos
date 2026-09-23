> **Versión anterior.** V29.6 usa transcripción local; no sigas los pasos de API de pago de este documento. Lee README_V29_6_VOZ_SIN_INSTALACIONES_EXTRA.md.

# FESTOS V29.5 · Asistente inteligente con voz en Windows

Esta versión incorpora grabación directa con MediaRecorder en Electron, transcripción remota, interpretación conversacional, lectura de cifras reales de proyectos por Supabase Auth/RLS, navegación, borradores de proyectos/cotizaciones y respuesta de audio. No usa el reconocimiento de voz de Chrome que fallaba en Electron.

**IMPORTANTE: El ZIP incluye el código, NO un servicio de IA ya configurado.** El micrófono y las respuestas de voz no funcionarán hasta desplegar la Edge Function y configurar la clave privada del proveedor en Supabase. No es necesario ejecutar SQL nuevo ni modificar el correlativo PRY.

## 1. Configurar el servicio externo (requiere acceso al proyecto Supabase)

1. Crea tu propia clave de API de OpenAI para transcripción, razonamiento conversacional y voz. No envíes la clave por ChatGPT, WhatsApp ni correo ni la pegues en React, `.env` de Vite, el ejecutable o el repositorio. La API tiene facturación por uso, separada de cualquier suscripción a ChatGPT; comprueba presupuesto y límites antes de habilitarla para los cuatro usuarios.
2. Abre tu proyecto de Supabase y, en **Edge Functions → Secrets**, guarda un secreto llamado `OPENAI_API_KEY` cuyo valor sea la clave. No lo incluyas en el ZIP ni se lo compartas a tus compañeros. Asegúrate de que el proyecto tenga `SUPABASE_URL` y una clave public/anon (`SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY`) disponibles en Edge Functions; normalmente Supabase las proporciona.
3. En PowerShell, abre `C:\FESTOS_BUILD` después de extraer allí esta versión y ejecuta:

```powershell
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase functions deploy festos-assistant
```

Sustituye `TU_PROJECT_REF` por el identificador real que ves en la URL de tu proyecto Supabase. La función está en `supabase/functions/festos-assistant/index.ts`. Si la herramienta pregunta por Docker, consulta la ayuda de Supabase CLI para despliegue remoto (no necesitas ejecutar una base de datos local). **Mantén la validación JWT habilitada**, nunca uses `--no-verify-jwt`.

4. Confirma que las cuentas corporativas ya inicien sesión con Supabase Auth y que `profiles` esté configurada y marcada como activa. La función consulta `profiles` y respeta las políticas RLS de `proyectos`. Si todavía no desplegaste las fases de V29 Security Lite, complétalas y verifica los permisos antes de activar el asistente.

## 2. Probar en Windows

```powershell
cd C:\FESTOS_BUILD
npm install
npm run desktop:dev
```

Pulsa el micrófono flotante: una pulsación inicia la grabación; otra la termina. Para no dejar el micrófono abierto, se detiene automáticamente a los 24 segundos. Al hablar, se envía ese segmento de audio al servicio, se convierte en texto, se procesa la pregunta y FESTOS reproduce una respuesta audible si la opción **Responder con voz** está activada. El audio no se guarda como registro en las tablas de FESTOS.

Prueba: «Abre Dashboard general», «Crea una cotización para Xiaomi», «Abre mi perfil», «¿Cuál es el valor de venta proyectado de todos los proyectos?», «¿Cuál es la utilidad proyectada de los proyectos de Mar?», «¿Cuántos proyectos tenemos este mes?». El valor de venta es **sin IGV**, y la utilidad usa `utilidad_proyectada` o, cuando hay costo, `valor_venta - costo_estimado`; no equivalen a caja ni ventas cobradas. "Este mes" filtra fecha de creación del proyecto, no fecha real de facturación.

El asistente puede navegar solo por apartados existentes y autorizados. Si algún módulo está oculto del menú o no autorizado para tu usuario, no lo habilitará mediante voz. Los formularios de proyectos/cotizaciones se abren como borrador y **NUNCA se guardan, aprueban o eliminan por dictado**. Revisa antes de hacer clic en Guardar.

## 3. Privacidad, costos y límites

Cada dictado de voz se envía a Supabase y al proveedor externo de transcripción. El texto se envía al modelo de conversación; para métricas, la Edge Function calcula los totales con filas de proyecto autorizadas por el JWT de la persona y NO envía esas filas al modelo. La respuesta de texto se envía al servicio externo de síntesis de voz si está activado el sonido. No uses el asistente con información de un cliente sin haber autorizado ese tratamiento en tu empresa.

Hay consumo de API por transcripción, modelo y síntesis de voz; configura límites de presupuesto/cuota en la cuenta proveedora. Esta implementación no incluye límites de uso persistentes por usuario, memoria de conversaciones, acciones administrativas ni consulta de ingresos facturados. No hemos podido probar el servicio con tu cuenta de Supabase ni tu clave de API desde este entorno. En este paquete no se incluyen claves privadas.

Si la voz está disponible en Chrome pero no en la app, confirma en **Windows → Privacidad y seguridad → Micrófono** que el micrófono esté habilitado para aplicaciones de escritorio. Esta versión usa MediaRecorder y ya no llama a Web Speech Recognition.
