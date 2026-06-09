import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import webPush from 'https://esm.sh/web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error('VAPID keys not configured')
    }

    webPush.setVapidDetails(
      'mailto:admin@almalibreacaihouse.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    )

    const body = await req.json()
    const { titulo, mensaje, url = '/', filtros } = body

    if (!titulo || !mensaje) {
      return new Response(JSON.stringify({ error: 'Título y mensaje son obligatorios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let query = supabase.from('push_subscriptions').select('*')

    if (filtros?.usuario_ids && filtros.usuario_ids.length > 0) {
      query = query.in('user_id', filtros.usuario_ids)
    }

    const { data: subscriptions, error } = await query

    if (error) throw error
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, total: 0, message: 'No hay suscripciones activas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload = JSON.stringify({
      title: titulo,
      body: mensaje,
      url,
      icon: '/logo-almalibre.png',
      badge: '/favicon.ico',
    })

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          )
          return { success: true, endpoint: sub.endpoint }
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          }
          return { success: false, endpoint: sub.endpoint, error: err.message, statusCode: err.statusCode }
        }
      })
    )

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - sent

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: subscriptions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
