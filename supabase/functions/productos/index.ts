import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCache, setCache, clearCache } from '../_shared/cache.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const imei = url.searchParams.get('imei')

      if (!imei) {
        return new Response(JSON.stringify({ error: 'imei es requerido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const cacheKey = `productos:${imei}`
      const cached = getCache(cacheKey)
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: rows, error } = await supabase
        .from('stock_config')
        .select('topping_position, topping_name, unidades_actuales')
        .eq('machine_imei', imei)
        .order('topping_position')

      if (error) throw error

      const productos = (rows ?? [])
        .map((row) => ({
          position: Number(row.topping_position),
          goodsName: row.topping_name || `Posición ${row.topping_position}`,
          price: '0',
          imagePath: '',
          stock: Number(row.unidades_actuales ?? 0),
          enable: 1,
        }))
        .filter((producto) => Number.isFinite(producto.position))

      const result = { success: true, productos, imei }
      setCache(cacheKey, result, 60)

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const { imei, position, nombre } = body as {
        imei?: string
        position?: string | number
        nombre?: string
      }

      if (!imei || position === undefined) {
        return new Response(JSON.stringify({ error: 'imei y position son requeridos' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!nombre || !nombre.trim()) {
        return new Response(JSON.stringify({ error: 'Solo se soporta actualizar el nombre del producto en esta función' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error } = await supabase
        .from('stock_config')
        .update({
          topping_name: nombre.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('machine_imei', imei)
        .eq('topping_position', String(position))

      if (error) throw error

      clearCache(`productos:${imei}`)
      clearCache(`stock:${imei}`)

      return new Response(JSON.stringify({ success: true, imei, position, nombre: nombre.trim() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Método no soportado' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[productos] Error:', (error as Error).message)
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
