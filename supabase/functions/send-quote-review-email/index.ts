import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
const serviceKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const resendApiKey = Deno.env.get('RESEND_API_KEY')
const fromEmail = Deno.env.get('EMAIL_FROM') || 'FESTOS <notificaciones@festosmkt.com>'
const appUrl = Deno.env.get('APP_URL') || ''

const admin = createClient(supabaseUrl, serviceKey)

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  try {
    if (!resendApiKey) return json({ ok: false, error: 'Falta configurar RESEND_API_KEY.' }, 500)
    if (!serviceKey) return json({ ok: false, error: 'Falta la secret key de Supabase.' }, 500)

    const { quoteId, tipo = 'en_revision' } = await req.json()
    if (!quoteId) return json({ ok: false, error: 'quoteId es obligatorio.' }, 400)
    if (!['en_revision', 'aprobada'].includes(tipo)) return json({ ok: false, error: 'Tipo de notificación no válido.' }, 400)

    const { data: notification, error: notificationError } = await admin
      .from('cotizacion_notificaciones')
      .select('id, cotizacion_id, tipo, destinatarios, estado, enviado_at')
      .eq('cotizacion_id', quoteId)
      .eq('tipo', tipo)
      .maybeSingle()

    if (notificationError) throw notificationError
    if (!notification) return json({ ok: false, error: `No existe la notificación ${tipo}.` }, 404)
    if (notification.estado === 'enviado') return json({ ok: true, alreadySent: true })

    const { data: quote, error: quoteError } = await admin
      .from('cotizaciones')
      .select('id, codigo, proyecto_nombre, subtotal, total, estado, clientes(nombre, ruc)')
      .eq('id', quoteId)
      .maybeSingle()

    if (quoteError) throw quoteError
    if (!quote) return json({ ok: false, error: 'La cotización no existe.' }, 404)
    if (tipo === 'en_revision' && quote.estado !== 'En Revisión') return json({ ok: false, error: 'La cotización ya no está en revisión.' }, 409)
    if (tipo === 'aprobada' && quote.estado !== 'Aprobado') return json({ ok: false, error: 'La cotización ya no está aprobada.' }, 409)

    const recipients = Array.isArray(notification.destinatarios)
      ? notification.destinatarios.filter((email: unknown) => typeof email === 'string' && email.includes('@'))
      : []

    if (!recipients.length) return json({ ok: false, error: 'No hay destinatarios configurados.' }, 400)

    const cliente = Array.isArray(quote.clientes) ? quote.clientes[0] : quote.clientes
    const codigo = escapeHtml(quote.codigo)
    const proyecto = escapeHtml(quote.proyecto_nombre || 'Sin proyecto')
    const clienteNombre = escapeHtml(cliente?.nombre || 'Cliente sin nombre')
    const clienteRuc = escapeHtml(cliente?.ruc || '—')
    const total = Number(quote.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const valorVenta = Number(quote.subtotal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const subject = tipo === 'aprobada' ? `Cotización ${quote.codigo} aprobada` : `Cotización ${quote.codigo} requiere revisión`
    const detailUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/?cotizacion=${encodeURIComponent(quote.id)}` : ''

    const html = tipo === 'aprobada' ? `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f7f7;font-family:Arial,Helvetica,sans-serif;color:#26363a">
  <div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #dfe7e8;border-radius:16px;overflow:hidden">
    <div style="padding:26px 30px;background:#224248;color:#fff">
      <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.8">FESTOS · Sistema de gestión</div>
      <h1 style="margin:8px 0 0;font-size:24px">Cotización aprobada</h1>
    </div>
    <div style="padding:30px">
      <p style="font-size:16px;line-height:1.6;margin-top:0">La cotización <strong>${codigo}</strong> ha sido aprobada correctamente y ya puede continuar con el siguiente proceso.</p>
      <div style="background:#f4f7f7;border-radius:12px;padding:18px 20px;margin:22px 0">
        <p style="margin:0 0 10px"><strong>Código:</strong> ${codigo}</p>
        <p style="margin:0 0 10px"><strong>Cliente:</strong> ${clienteNombre}</p>
        <p style="margin:0"><strong>Proyecto:</strong> ${proyecto}</p>
      </div>
      ${detailUrl ? `<a href="${detailUrl}" style="display:inline-block;background:#224248;color:#fff;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:700">VER COTIZACIÓN</a>` : ''}
      <p style="font-size:12px;line-height:1.5;color:#718084;margin:26px 0 0">Este es un mensaje automático del Sistema de Gestión FESTOS.</p>
    </div>
  </div>
</body>
</html>` : `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f7f7;font-family:Arial,Helvetica,sans-serif;color:#26363a">
  <div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #dfe7e8;border-radius:16px;overflow:hidden">
    <div style="padding:26px 30px;background:#224248;color:#fff">
      <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.8">FESTOS · Sistema de gestión</div>
      <h1 style="margin:8px 0 0;font-size:24px">Cotización pendiente de revisión</h1>
    </div>
    <div style="padding:30px">
      <p style="font-size:16px;line-height:1.6;margin-top:0">La cotización <strong>${codigo}</strong> fue enviada a revisión y requiere atención.</p>
      <div style="background:#f4f7f7;border-radius:12px;padding:18px 20px;margin:22px 0">
        <p style="margin:0 0 10px"><strong>Código:</strong> ${codigo}</p>
        <p style="margin:0 0 10px"><strong>Cliente:</strong> ${clienteNombre}</p>
        <p style="margin:0 0 10px"><strong>RUC / documento:</strong> ${clienteRuc}</p>
        <p style="margin:0 0 10px"><strong>Proyecto:</strong> ${proyecto}</p>
        <p style="margin:0"><strong>Valor venta:</strong> S/. ${valorVenta}</p>
        <p style="margin:0"><strong>Importe con IGV:</strong> S/. ${total}</p>
      </div>
      ${detailUrl ? `<a href="${detailUrl}" style="display:inline-block;background:#224248;color:#fff;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:700">VER COTIZACIÓN</a>` : ''}
      <p style="font-size:12px;line-height:1.5;color:#718084;margin:26px 0 0">Este es un mensaje automático del Sistema de Gestión FESTOS.</p>
    </div>
  </div>
</body>
</html>`

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to: recipients, subject, html }),
    })

    const resendBody: { id?: string; message?: string } = await resendResponse.json().catch(() => ({}))
    if (!resendResponse.ok) {
      const message = resendBody?.message || 'Resend rechazó el envío.'
      await admin.from('cotizacion_notificaciones').update({ estado: 'error', error_mensaje: message }).eq('id', notification.id)
      return json({ ok: false, error: message }, 502)
    }

    const { error: updateError } = await admin
      .from('cotizacion_notificaciones')
      .update({ estado: 'enviado', enviado_at: new Date().toISOString(), error_mensaje: null })
      .eq('id', notification.id)

    if (updateError) throw updateError

    return json({ ok: true, id: resendBody?.id || null })
  } catch (error) {
    console.error(error)
    return json({ ok: false, error: error instanceof Error ? error.message : 'Error inesperado.' }, 500)
  }
})
