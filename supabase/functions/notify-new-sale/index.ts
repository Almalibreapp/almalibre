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
    const body = await req.json()
    const record = body.record || body
    const { producto, precio, metodo_pago, hora, fecha, imei, cantidad_unidades, toppings } = record

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ---- Resolve ALL owners by IMEI (a MAC can appear on more than one machine record) ----
    let machineName = imei || 'Desconocida'
    let ownerUserIds: string[] = []
    try {
      const { data: machines } = await supabase
        .from('maquinas')
        .select('nombre_personalizado, usuario_id')
        .eq('mac_address', imei)
      if (machines && machines.length > 0) {
        machineName = machines[0].nombre_personalizado || machineName
        ownerUserIds = Array.from(
          new Set(machines.map((m: any) => m.usuario_id).filter(Boolean))
        )
      }
    } catch (err) {
      console.error('[notify-new-sale] machine lookup error:', err)
    }

    let pushResult: any = { attempted: false }

    // ---- Push to every franchisee owning this machine ----
    if (ownerUserIds.length > 0) {
      try {
        // Filter owners whose preferences do NOT explicitly disable sales push
        const { data: prefs } = await supabase
          .from('preferencias_notificaciones')
          .select('usuario_id, nuevas_ventas, canal_push')
          .in('usuario_id', ownerUserIds)

        const disabled = new Set(
          (prefs || [])
            .filter((p: any) => p.nuevas_ventas === false || p.canal_push === false)
            .map((p: any) => p.usuario_id)
        )
        const recipients = ownerUserIds.filter((u) => !disabled.has(u))

        if (recipients.length > 0) {
          const { data: pushData, error: pushErr } = await supabase.functions.invoke('send-push', {
            body: {
              titulo: `🍦 Nueva venta · ${Number(precio || 0).toFixed(2)}€`,
              mensaje: `${producto || 'Producto'} en ${machineName}`,
              url: '/',
              filtros: { usuario_ids: recipients },
            },
          })
          pushResult = { attempted: true, recipients, data: pushData, error: pushErr?.message }
          console.log('[notify-new-sale] Push sent', JSON.stringify(pushResult))
        } else {
          pushResult = { attempted: true, recipients: [], reason: 'all disabled' }
        }
      } catch (err: any) {
        console.error('[notify-new-sale] Push error:', err?.message || err)
        pushResult = { attempted: true, error: err?.message || String(err) }
      }
    } else {
      console.log('[notify-new-sale] No owners for IMEI', imei)
    }

    // ---- Optional admin email (never blocks the push above) ----
    let emailResult: any = { attempted: false }
    try {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      const ADMIN_EMAIL = Deno.env.get('ADMIN_NOTIFICATION_EMAIL')
      if (RESEND_API_KEY && ADMIN_EMAIL) {
        emailResult.attempted = true
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
                <tr><td>Máquina</td><td style="text-align:right;"><b>${machineName}</b></td></tr>
                <tr><td>Producto</td><td style="text-align:right;"><b>${producto || 'N/A'}</b></td></tr>
                <tr><td>Toppings</td><td style="text-align:right;">${toppingsList}</td></tr>
                <tr><td>Cantidad</td><td style="text-align:right;">${cantidad_unidades || 1} ud.</td></tr>
                <tr><td>Precio</td><td style="text-align:right;color:#059669;"><b>${Number(precio || 0).toFixed(2)}€</b></td></tr>
                <tr><td>Pago</td><td style="text-align:right;">${metodo_pago || 'efectivo'}</td></tr>
                <tr><td>Fecha</td><td style="text-align:right;">${fecha || 'N/A'} ${hora || ''}</td></tr>
              </table>
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
          console.error('[notify-new-sale] Resend non-fatal error:', JSON.stringify(emailData))
          emailResult.error = emailData
        } else {
          emailResult.id = emailData.id
        }
      }
    } catch (err: any) {
      console.error('[notify-new-sale] Email error (non-fatal):', err?.message || err)
      emailResult.error = err?.message || String(err)
    }

    return new Response(JSON.stringify({ success: true, push: pushResult, email: emailResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[notify-new-sale] Fatal error:', error?.message || error)
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
