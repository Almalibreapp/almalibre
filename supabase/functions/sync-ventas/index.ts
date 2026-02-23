import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_BASE_URL = 'https://nonstopmachine.com/wp-json/helados/v1'
const API_TOKEN = 'b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE'

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
}

const decodeHtmlEntities = (text: string) => {
  if (!text) return ''
  return text
    .replace(/&ccedil;/g, 'ç')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ')
}

const normalizePaymentMethod = (value: unknown) => {
  const raw = decodeHtmlEntities(String(value || '')).trim().toLowerCase()
  if (!raw) return 'efectivo'

  if (raw.includes('tarjeta') || raw.includes('card') || raw.includes('credito') || raw.includes('débito') || raw.includes('debito')) {
    return 'tarjeta'
  }
  if (raw.includes('bizum')) return 'bizum'
  if (raw.includes('apple')) return 'apple pay'
  if (raw.includes('google')) return 'google pay'
  if (raw.includes('cash') || raw.includes('efectivo') || raw.includes('metalico') || raw.includes('metálico')) {
    return 'efectivo'
  }

  return raw
}

const extractToppingsFromProduct = (productText: string) => {
  const decoded = decodeHtmlEntities(productText)
  const [, toppingsText] = decoded.split(':')
  if (!toppingsText) return []

  return toppingsText
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => ({
      posicion: `txt-${index + 1}`,
      nombre: name,
      cantidad: '1',
    }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Note: Admin access is enforced by RLS on ventas_historico table
    // Only admin users can read the synced data

    const body = await req.json().catch(() => ({}))
    const { imei, maquina_id, fecha, dias_atras } = body

    // If specific machine + date
    if (imei && maquina_id) {
      const results = []
      const daysBack = dias_atras || 30
      
      for (let i = 0; i < daysBack; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        
        if (fecha && dateStr !== fecha) continue

        try {
          const url = `${API_BASE_URL}/ventas-detalle/${imei}?fecha=${dateStr}`
          const res = await fetch(url, { headers })
          if (!res.ok) continue
          
          const data = await res.json()
          if (!data.ventas || data.ventas.length === 0) continue

          // Insert sales using upsert (ON CONFLICT DO NOTHING)
          const rows = data.ventas.map((v: any) => {
            const rawPayment = v.metodo_pago ?? v.payment_method ?? v.pay_type ?? v.payType ?? v.metodoPago ?? v.tipo_pago
            const product = decodeHtmlEntities(v.producto || '')
            const toppings = Array.isArray(v.toppings) && v.toppings.length > 0
              ? v.toppings
              : extractToppingsFromProduct(product)

            return {
              maquina_id,
              imei,
              venta_api_id: v.id,
              fecha: dateStr,
              hora: v.hora,
              producto: product,
              precio: v.precio || 0,
              cantidad_unidades: v.cantidad_unidades || 1,
              metodo_pago: normalizePaymentMethod(rawPayment),
              numero_orden: v.numero_orden || v.order_no || null,
              estado: v.estado || 'exitoso',
              toppings,
            }
          })

          const { error, count } = await supabase
            .from('ventas_historico')
            .upsert(rows, { onConflict: 'imei,venta_api_id' })

          results.push({ fecha: dateStr, ventas: rows.length, error: error?.message })
        } catch (e) {
          results.push({ fecha: dateStr, error: e.message })
        }
      }

      // Update sync log
      await supabase.from('ventas_sync_log').upsert({
        maquina_id,
        imei,
        ultima_fecha_sync: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'imei' })

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Sync ALL machines
    const { data: maquinas } = await supabase.from('maquinas').select('id, mac_address')
    if (!maquinas || maquinas.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No hay máquinas' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const allResults = []
    for (const maq of maquinas) {
      const daysBack = dias_atras || 7
      for (let i = 0; i < daysBack; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]

        try {
          const url = `${API_BASE_URL}/ventas-detalle/${maq.mac_address}?fecha=${dateStr}`
          const res = await fetch(url, { headers })
          if (!res.ok) continue

          const data = await res.json()
          if (!data.ventas || data.ventas.length === 0) continue

          const rows = data.ventas.map((v: any) => {
            const rawPayment = v.metodo_pago ?? v.payment_method ?? v.pay_type ?? v.payType ?? v.metodoPago ?? v.tipo_pago
            const product = decodeHtmlEntities(v.producto || '')
            const toppings = Array.isArray(v.toppings) && v.toppings.length > 0
              ? v.toppings
              : extractToppingsFromProduct(product)

            return {
              maquina_id: maq.id,
              imei: maq.mac_address,
              venta_api_id: v.id,
              fecha: dateStr,
              hora: v.hora,
              producto: product,
              precio: v.precio || 0,
              cantidad_unidades: v.cantidad_unidades || 1,
              metodo_pago: normalizePaymentMethod(rawPayment),
              numero_orden: v.numero_orden || v.order_no || null,
              estado: v.estado || 'exitoso',
              toppings,
            }
          })

          await supabase
            .from('ventas_historico')
            .upsert(rows, { onConflict: 'imei,venta_api_id' })

          allResults.push({ maquina: maq.mac_address, fecha: dateStr, ventas: rows.length })
        } catch (e) {
          allResults.push({ maquina: maq.mac_address, fecha: dateStr, error: e.message })
        }
      }

      await supabase.from('ventas_sync_log').upsert({
        maquina_id: maq.id,
        imei: maq.mac_address,
        ultima_fecha_sync: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'imei' })
    }

    return new Response(JSON.stringify({ success: true, results: allResults }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
