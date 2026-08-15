// Proxy directo al endpoint del fabricante (vía nonstopmachine.com).
// Se usa como respaldo cuando la API de telemetría devuelve la rama
// "historico" vacía para el día chino en curso (ventas posteriores a las
// 18:00 hora española, que para el fabricante ya pertenecen al día siguiente).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_BASE_URL = 'https://nonstopmachine.com/wp-json'
const API_TOKEN = Deno.env.get('WORDPRESS_API_TOKEN') ?? 'b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE'

const decodeHtmlEntities = (text: string) =>
  String(text || '')
    .replace(/&Ccedil;/g, 'Ç').replace(/&ccedil;/g, 'ç')
    .replace(/&Iacute;/g, 'Í').replace(/&iacute;/g, 'í')
    .replace(/&Ntilde;/g, 'Ñ').replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á').replace(/&aacute;/g, 'á')
    .replace(/&Eacute;/g, 'É').replace(/&eacute;/g, 'é')
    .replace(/&Oacute;/g, 'Ó').replace(/&oacute;/g, 'ó')
    .replace(/&Uacute;/g, 'Ú').replace(/&uacute;/g, 'ú')
    .replace(/&atilde;/g, 'ã').replace(/&otilde;/g, 'õ')
    .replace(/&amp;/g, '&')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    let imei = url.searchParams.get('imei') ?? ''
    let fecha = url.searchParams.get('fecha') ?? ''

    if ((!imei || !fecha) && req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      imei = imei || body.imei
      fecha = fecha || body.fecha
    }

    if (!imei || !fecha) {
      return new Response(JSON.stringify({ success: false, error: 'Missing imei or fecha' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let page = 1
    let totalPages = 1
    const ordenes: any[] = []

    while (page <= totalPages && page <= 20) {
      const res = await fetch(
        `${API_BASE_URL}/fabricante-ext/v1/ordenes/${imei}?fecha=${fecha}&page=${page}`,
        { headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' } }
      )
      if (!res.ok) {
        if (page === 1) throw new Error(`Fabricante HTTP ${res.status}`)
        break
      }
      const data = await res.json()
      const items = data?.ordenes ?? data?.ventas ?? []
      ordenes.push(...items)
      totalPages = Number(data?.total_pages || 1)
      page++
    }

    const ventas = ordenes.map((v: any, index: number) => ({
      id: String(v.id ?? v.numero_orden ?? `${imei}-${fecha}-${index}`),
      // El campo "fecha" del fabricante ya viene como "YYYY-MM-DD HH:mm:ss",
      // mismo formato/semántica que fecha_hora_china de la API de telemetría.
      fecha_hora_china: String(v.fecha ?? ''),
      hora: String(v.hora ?? '').substring(0, 5),
      producto: decodeHtmlEntities(v.producto ?? ''),
      precio: Number(v.precio ?? 0),
      cantidad_unidades: Number(v.cantidad_unidades ?? v.cantidad ?? 1),
      metodo_pago: String(v.metodo_pago ?? ''),
      numero_orden: v.numero_orden ?? null,
      estado: String(v.estado ?? 'exitoso'),
      toppings: Array.isArray(v.toppings) ? v.toppings : [],
    }))

    return new Response(
      JSON.stringify({ success: true, imei, fecha, total: ventas.length, ventas, fuente: 'fabricante' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
