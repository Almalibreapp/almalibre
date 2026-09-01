import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_BASE_URL = 'https://nonstopmachine.com/wp-json'
const API_TOKEN = 'b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE'

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
}

const decodeHtmlEntities = (text: string) => {
  if (!text) return ''
  return text
    .replace(/&Ccedil;/g, 'Ç').replace(/&ccedil;/g, 'ç')
    .replace(/&Ntilde;/g, 'Ñ').replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á').replace(/&aacute;/g, 'á')
    .replace(/&Eacute;/g, 'É').replace(/&eacute;/g, 'é')
    .replace(/&Iacute;/g, 'Í').replace(/&iacute;/g, 'í')
    .replace(/&Oacute;/g, 'Ó').replace(/&oacute;/g, 'ó')
    .replace(/&Uacute;/g, 'Ú').replace(/&uacute;/g, 'ú')
    .replace(/&atilde;/g, 'ã').replace(/&otilde;/g, 'õ')
}

// El efectivo está bloqueado a nivel de ejecución en todas las máquinas:
// cualquier valor desconocido o "efectivo" se registra como tarjeta.
const normalizePaymentMethod = (value: unknown) => {
  const raw = decodeHtmlEntities(String(value || '')).trim().toLowerCase()
  if (!raw) return 'tarjeta'
  if (raw.includes('bizum')) return 'bizum'
  if (raw.includes('apple')) return 'apple pay'
  if (raw.includes('google')) return 'google pay'
  if (raw.includes('cupon') || raw.includes('cupón') || raw.includes('coupon')) return 'cupon'
  return 'tarjeta'
}

const extractToppingsFromProduct = (productText: string) => {
  const decoded = decodeHtmlEntities(productText)
  const [, toppingsText] = decoded.split(':')
  if (!toppingsText) return []
  return toppingsText
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => ({ posicion: `txt-${index + 1}`, nombre: name, cantidad: '1' }))
}

// La API mezcla dos formatos y a veces devuelve la hora en hora china (UTC+8).
// Fuente de verdad: el número de pedido "2348AAAAMMDDHHMMSS..." codifica la hora
// china exacta; restándole 6 h obtenemos la hora española (verificado contra myPOS).
// Si el pedido viene identificado con el IMEI, la `fecha` de la API también es china.
const shiftChinaToSpain = (date: string, time: string) => {
  const [Y, M, D] = date.split('-').map(Number)
  const [h, m] = time.split(':').map(Number)
  const d = new Date(Date.UTC(Y, M - 1, D, h - 6, m))
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    fecha: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    hora: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  }
}

const splitFechaHora = (v: any, fallbackDate: string, machineImei = '') => {
  const orderNo = String(v.numero_orden || v.order_no || '')

  // 1) Número de pedido con timestamp chino embebido -> fuente de verdad.
  const stamped = orderNo.match(/^\d{4}(20\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/)
  if (stamped) {
    const [, Y, M, D, h, m] = stamped
    return shiftChinaToSpain(`${Y}-${M}-${D}`, `${h}:${m}`)
  }

  const raw = String(v.fecha || '').replace('T', ' ').trim()
  const [datePart, timePart] = raw.split(' ')
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(datePart || '') ? datePart : fallbackDate
  const hora = (timePart || v.hora || '00:00').substring(0, 5)

  // 2) Pedido identificado por IMEI: la API entrega hora china sin convertir.
  if (machineImei && orderNo.startsWith(machineImei)) {
    return shiftChinaToSpain(fecha, hora)
  }

  return { fecha, hora }
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

    const body = await req.json().catch(() => ({}))
    const { imei, maquina_id, fecha, dias_atras } = body

    const fetchOrders = async (machineImei: string, dateStr: string) => {
      let allOrders: any[] = []
      let page = 1
      let totalPages = 1
      let ok = false

      while (page <= totalPages && page <= 20) {
        const url = `${API_BASE_URL}/fabricante-ext/v1/ordenes/${machineImei}?fecha=${dateStr}&page=${page}`
        const res = await fetch(url, { headers })
        if (!res.ok) {
          console.log(`[sync-ventas] HTTP ${res.status} for ${url}`)
          if (page === 1) return null
          break
        }
        const data = await res.json().catch(() => null)
        if (!data) { if (page === 1) return null; break }
        ok = true
        const orders = data?.ordenes || data?.ventas || []
        allOrders = allOrders.concat(orders)
        totalPages = Number(data.total_pages || 1)
        page++
      }

      return ok ? allOrders : null
    }

    const mapOrdersToRows = (orders: any[], machineId: string, machineImei: string, dateStr: string) => {
      if (!Array.isArray(orders) || orders.length === 0) return []
      return orders.map((v: any) => {
        const product = decodeHtmlEntities(v.producto || '')
        const toppingsRaw = Array.isArray(v.toppings) && v.toppings.length > 0
          ? v.toppings
          : (Array.isArray(v.toppings_usados) && v.toppings_usados.length > 0
            ? v.toppings_usados
            : extractToppingsFromProduct(product))
        const toppings = toppingsRaw.map((t: any) => ({
          ...t,
          nombre: decodeHtmlEntities(t?.nombre || ''),
        }))
        const { fecha: f, hora: h } = splitFechaHora(v, dateStr)

        // Identificador canónico: el número de pedido de la máquina (empieza por
        // el IMEI). Es el único estable entre fuentes; usar v.id creaba duplicados.
        const deviceOrder = String(v.numero_orden || v.order_no || '')
        const canonicalId = deviceOrder.startsWith(machineImei)
          ? deviceOrder
          : String(v.id || deviceOrder || `${f}-${h}-${v.precio}`)

        return {
          maquina_id: machineId,
          imei: machineImei,
          venta_api_id: canonicalId,
          fecha: f,
          hora: h,
          producto: product,
          precio: Number(v.precio || 0),
          cantidad_unidades: Number(v.cantidad_unidades || v.cantidad || 1),
          metodo_pago: normalizePaymentMethod(
            v.metodo_pago ?? v.payment_method ?? v.pay_type ?? v.payType ?? v.metodoPago ?? v.tipo_pago
          ),
          numero_orden: v.numero_orden || v.order_no || null,
          estado: v.estado || 'exitoso',
          toppings,
        }
      })
    }

    const upsertRows = async (rows: any[]) => {
      if (rows.length === 0) return null
      const { error } = await supabase
        .from('ventas_historico')
        .upsert(rows, { onConflict: 'imei,venta_api_id', ignoreDuplicates: false })
      if (error) console.log('[sync-ventas] upsert error:', error.message)
      return error?.message || null
    }

    const targets = imei && maquina_id
      ? [{ id: maquina_id, mac_address: imei }]
      : ((await supabase.from('maquinas').select('id, mac_address')).data || [])

    if (targets.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No hay máquinas' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Evitar duplicar máquinas repetidas por IMEI
    const seen = new Set<string>()
    const machines = targets.filter((m: any) => {
      if (!m.mac_address || seen.has(m.mac_address)) return false
      seen.add(m.mac_address)
      return true
    })

    const daysBack = fecha ? 1 : (dias_atras || 3)
    const results: any[] = []

    for (const maq of machines) {
      for (let i = 0; i < daysBack; i++) {
        const dateStr = fecha
          ? fecha
          : new Date(Date.now() - i * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })

        try {
          const orders = await fetchOrders(maq.mac_address, dateStr)
          if (!orders) { results.push({ maquina: maq.mac_address, fecha: dateStr, error: 'api_error' }); continue }
          const rows = mapOrdersToRows(orders, maq.id, maq.mac_address, dateStr)
          if (rows.length === 0) continue
          const err = await upsertRows(rows)
          results.push({ maquina: maq.mac_address, fecha: dateStr, ventas: rows.length, error: err })
        } catch (e) {
          results.push({ maquina: maq.mac_address, fecha: dateStr, error: (e as Error).message })
        }
      }

      await supabase.from('ventas_sync_log').upsert({
        maquina_id: maq.id,
        imei: maq.mac_address,
        ultima_fecha_sync: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'imei' })
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[sync-ventas] Error:', (error as Error).message)
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
