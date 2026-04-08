import { fabricanteAPI } from '../_shared/fabricante-api.ts'
import { convertChinaToSpain, formatSpainTime, formatSpainDate } from '../_shared/timezone.ts'
import { getCache, setCache } from '../_shared/cache.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const decodeHtml = (text: string): string =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

function detectPaymentMethod(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return 'efectivo'
  if (s.includes('刷卡') || s.includes('card') || s.includes('tarjeta') || s.includes('credito') || s.includes('débito')) return 'tarjeta'
  if (s.includes('bizum')) return 'bizum'
  if (s.includes('apple')) return 'apple pay'
  if (s.includes('google')) return 'google pay'
  if (s.includes('串码') || s.includes('coupon') || s.includes('cupón') || s.includes('cupon')) return 'cupón'
  if (s.includes('cash') || s.includes('efectivo') || s.includes('metálico') || s.includes('metalico')) return 'efectivo'
  return s
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { imei, fecha } = body as { imei?: string; fecha?: string }

    if (!imei || !fecha) {
      return new Response(JSON.stringify({ error: 'imei y fecha son requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check cache
    const cacheKey = `ventas:${imei}:${fecha}`
    const cached = getCache(cacheKey)
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { orders } = await fabricanteAPI.getOrders(imei, fecha)

    const ventas = (orders as Record<string, unknown>[]).map((o) => {
      const chinaDatetime = `${o.fecha ?? o.date ?? fecha} ${o.hora ?? o.time ?? '00:00:00'}`
      const spainIso = convertChinaToSpain(chinaDatetime)

      return {
        id: o.id ?? o.numero_orden ?? o.order_no,
        producto: decodeHtml(String(o.producto ?? o.goodsName ?? o.goods_name ?? '')),
        precio: Number(o.precio ?? o.price ?? o.amount ?? 0),
        cantidad: Number(o.cantidad ?? o.cantidad_unidades ?? o.qty ?? 1),
        metodo_pago: detectPaymentMethod(o.metodo_pago ?? o.pay_type ?? o.payType ?? o.payment_method),
        estado: String(o.estado ?? o.status ?? 'exitoso'),
        fecha_china: chinaDatetime.trim(),
        fecha_spain: formatSpainDate(spainIso),
        hora_spain: formatSpainTime(spainIso),
        iso_spain: spainIso,
        toppings: o.toppings ?? o.toppings_usados ?? [],
        numero_orden: o.numero_orden ?? o.order_no ?? null,
      }
    })

    const result = { success: true, ventas, total: ventas.length, fecha, imei }
    setCache(cacheKey, result, 60)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[ventas] Error:', (error as Error).message)
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
