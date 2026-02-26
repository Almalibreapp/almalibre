import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured')

    const ADMIN_EMAIL = Deno.env.get('ADMIN_NOTIFICATION_EMAIL')
    if (!ADMIN_EMAIL) throw new Error('ADMIN_NOTIFICATION_EMAIL is not configured')

    const body = await req.json()

    // Support both direct call and database webhook payload
    const record = body.record || body
    const { producto, precio, metodo_pago, hora, fecha, imei, cantidad_unidades, toppings } = record

    // Look up machine name
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let machineName = imei || 'Desconocida'
    try {
      const { data } = await supabase
        .from('maquinas')
        .select('nombre_personalizado')
        .eq('mac_address', imei)
        .limit(1)
        .single()
      if (data?.nombre_personalizado) machineName = data.nombre_personalizado
    } catch { /* use IMEI as fallback */ }

    // Format toppings
    const toppingsList = Array.isArray(toppings) && toppings.length > 0
      ? toppings.map((t: any) => t.nombre || t.posicion || '').filter(Boolean).join(', ')
      : 'Sin toppings'

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🍦 Nueva Venta Registrada</h1>
        </div>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Máquina</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${machineName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Producto</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${producto || 'N/A'}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Toppings</td><td style="padding: 8px 0; text-align: right;">${toppingsList}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Cantidad</td><td style="padding: 8px 0; text-align: right;">${cantidad_unidades || 1} ud.</td></tr>
            <tr style="border-top: 2px solid #e5e7eb;"><td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Precio</td><td style="padding: 12px 0; font-weight: bold; font-size: 20px; color: #059669; text-align: right;">${Number(precio || 0).toFixed(2)}€</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Método de pago</td><td style="padding: 8px 0; text-align: right;">${metodo_pago || 'efectivo'}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Fecha</td><td style="padding: 8px 0; text-align: right;">${fecha || 'N/A'}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Hora</td><td style="padding: 8px 0; text-align: right;">${hora || 'N/A'}</td></tr>
          </table>
          <p style="margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">Almalibre — Notificación automática de venta</p>
        </div>
      </div>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Almalibre <onboarding@resend.dev>',
        to: [ADMIN_EMAIL],
        subject: `🍦 Nueva Venta: ${Number(precio || 0).toFixed(2)}€ — ${machineName}`,
        html: htmlBody,
      }),
    })

    const emailData = await emailRes.json()
    if (!emailRes.ok) {
      console.error('[notify-new-sale] Resend error:', JSON.stringify(emailData))
      throw new Error(`Resend API error [${emailRes.status}]: ${JSON.stringify(emailData)}`)
    }

    console.log('[notify-new-sale] Email sent:', emailData.id)
    return new Response(JSON.stringify({ success: true, emailId: emailData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[notify-new-sale] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
