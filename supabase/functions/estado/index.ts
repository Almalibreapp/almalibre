import { fabricanteAPI } from '../_shared/fabricante-api.ts'
import { getCache, setCache } from '../_shared/cache.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    let imei: string | undefined

    if (req.method === 'GET') {
      const url = new URL(req.url)
      imei = url.searchParams.get('imei') ?? undefined
    } else {
      const body = await req.json().catch(() => ({}))
      imei = (body as any).imei
    }

    if (!imei) {
      return new Response(JSON.stringify({ error: 'imei es requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cacheKey = `estado:${imei}`
    const cached = getCache(cacheKey)
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await fabricanteAPI.getMachineStatus(imei)

    // Parse alerts — only sellout is reliable
    const alertas: Array<{ tipo: string; mensaje: string; nivel: string }> = []
    const sellout = data.operate_sellout ?? data.sellout
    if (sellout && String(sellout) !== '0' && String(sellout).toLowerCase() !== 'normal') {
      alertas.push({
        tipo: 'agotamiento',
        mensaje: `Producto agotado: ${sellout}`,
        nivel: 'warning',
      })
    }

    const estadoGeneral = alertas.length > 0 ? 'alerta' : 'normal'

    const componentes: Record<string, unknown> = {
      temperatura: data.temperature ?? data.temp ?? null,
      señal: data.signal ?? data.rssi ?? null,
      puerta: data.door ?? data.doorStatus ?? null,
      monedero: data.coinChanger ?? data.coin ?? null,
      billetero: data.billAcceptor ?? data.bill ?? null,
    }

    const result = {
      success: true,
      estado_general: estadoGeneral,
      alertas,
      componentes,
      ultima_actualizacion: new Date().toISOString(),
      raw: data,
    }

    setCache(cacheKey, result, 180)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[estado] Error:', (error as Error).message)
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
