import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fabricanteAPI } from '../_shared/fabricante-api.ts'
import { getCache, setCache, clearCache } from '../_shared/cache.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function calcStatus(actual: number, max: number): { porcentaje: number; estado: string } {
  const porcentaje = max > 0 ? Math.round((actual / max) * 100) : 0
  const estado = porcentaje < 25 ? 'critical' : porcentaje < 50 ? 'warning' : 'ok'
  return { porcentaje, estado }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // --- GET: read stock ---
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const imei = url.searchParams.get('imei')

      if (!imei) {
        return new Response(JSON.stringify({ error: 'imei es requerido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const cacheKey = `stock:${imei}`
      const cached = getCache(cacheKey)
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: rows, error } = await supabase
        .from('stock_config')
        .select('topping_position, topping_name, unidades_actuales, capacidad_maxima, alerta_minimo')
        .eq('machine_imei', imei)
        .order('topping_position')

      if (error) throw error

      const stock = (rows ?? []).map((r) => {
        const { porcentaje, estado } = calcStatus(r.unidades_actuales, r.capacidad_maxima)
        return {
          position: r.topping_position,
          nombre: r.topping_name,
          actual: r.unidades_actuales,
          maximo: r.capacidad_maxima,
          alerta_minimo: r.alerta_minimo,
          porcentaje,
          estado,
        }
      })

      const result = { success: true, stock, imei }
      setCache(cacheKey, result, 60)

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // --- POST: update stock ---
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const { imei, position, cantidad } = body as {
        imei?: string
        position?: string
        cantidad?: number
      }

      if (!imei || !position || cantidad === undefined) {
        return new Response(
          JSON.stringify({ error: 'imei, position y cantidad son requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Sync with physical machine
      await fabricanteAPI.updateStock(imei, position, cantidad)

      // Update Supabase
      const { error } = await supabase
        .from('stock_config')
        .update({ unidades_actuales: cantidad, updated_at: new Date().toISOString() })
        .eq('machine_imei', imei)
        .eq('topping_position', position)

      if (error) throw error

      // Clear cache for this machine
      clearCache(`stock:${imei}`)

      return new Response(
        JSON.stringify({ success: true, message: 'Stock actualizado', imei, position, cantidad }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ error: 'Método no soportado' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[stock] Error:', (error as Error).message)
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
