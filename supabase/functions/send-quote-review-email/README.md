# Envío de correos de cotizaciones en revisión

Esta Edge Function toma una fila pendiente de `cotizacion_notificaciones`, verifica el estado de la cotización según el tipo (`en_revision` o `aprobada`), envía el correo con Resend y marca la notificación como `enviado`.

## Secretos de Supabase

Configura en **Supabase > Edge Functions > Secrets**:

- `RESEND_API_KEY` = tu API key de Resend
- `EMAIL_FROM` = por ejemplo `FESTOS <notificaciones@festosmkt.com>` (el dominio debe estar verificado en Resend)
- `APP_URL` = URL pública de tu aplicación, por ejemplo `https://app.festosmkt.com`

Supabase expone automáticamente `SUPABASE_URL` y las claves internas de servidor a las Edge Functions.

## Despliegue

Desde la carpeta del proyecto:

```bash
npx supabase login
npx supabase functions deploy send-quote-review-email --project-ref fhygacwwzhuxndownvve
```

## Prueba

Después de desplegar, entra al sistema y envía una cotización a **En Revisión**. La aplicación registra la notificación y llama a esta función.

Si Resend acepta el mensaje, `cotizacion_notificaciones.estado` pasa a `enviado` y se guarda `enviado_at`.
