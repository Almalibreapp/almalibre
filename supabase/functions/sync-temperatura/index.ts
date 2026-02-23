import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_BASE_URL = 'https://nonstopmachine.com/wp-json/fabricante-ext/v1'
const API_TOKEN = 'b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE'

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
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
    const { imei, maquina_id, start, end } = body

    if (!imei || !maquina_id) {
      return new Response(JSON.stringify({ error: 'imei and maquina_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Default: last 48 hours
    const endDate = end || new Date().toISOString().split('T')[0]
    const startDate = start || (() => {
      const d = new Date()
      d.setDate(d.getDate() - 2)
      return d.toISOString().split('T')[0]
    })()

    const url = `${API_BASE_URL}/temperatura/historial/${imei}?start=${startDate}&end=${endDate}`
    console.log(`[sync-temperatura] Fetching: ${url}`)

    const res = await fetch(url, { headers })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`[sync-temperatura] HTTP ${res.status}: ${errText}`)
      return new Response(JSON.stringify({ error: `API returned ${res.status}`, details: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    console.log(`[sync-temperatura] Got ${data.total_lecturas || 0} readings, stats:`, JSON.stringify(data.estadisticas || {}))

    const readings = data.datos || data.data || data.lecturas || []
    if (!Array.isArray(readings) || readings.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No readings from API',
        estadisticas: data.estadisticas || null,
        total_lecturas: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Map readings to DB rows
    const rows = readings.map((r: any) => {
      const temp = Number(r.temperatura)
      // Determine estado based on temperature
      const estado = temp >= 11 ? 'critico' : temp >= 8 ? 'alerta' : 'normal'

      // Parse timestamp - API returns "2026-02-23 00:00:40" or just time "00:02:56"
      let createdAt: string
      if (r.timestamp) {
        const ts = String(r.timestamp).trim()
        if (ts.match(/^\d{4}-\d{2}-\d{2}/)) {
          // Full datetime: "2026-02-23 00:00:40"
          createdAt = ts.includes('T') ? ts : ts.replace(' ', 'T')
          if (!createdAt.endsWith('Z') && !createdAt.includes('+')) createdAt += 'Z'
        } else if (ts.match(/^\d{2}:\d{2}/)) {
          // Time only: "00:02:56" - prepend the start date
          createdAt = `${startDate}T${ts}Z`
        } else {
          createdAt = new Date().toISOString()
        }
      } else {
        createdAt = new Date().toISOString()
      }

      return {
        maquina_id: maquina_id,
        temperatura: temp,
        unidad: data.estadisticas?.unidad || r.unidad || 'C',
        estado,
        created_at: createdAt,
        sensor: r.sensor || '',
        fuente: r.fuente || 'fabricante',
        imei: imei,
      }
    })

    // Insert in batches of 500, ignoring duplicates
    let insertedCount = 0
    const batchSize = 500
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const { error, data: inserted } = await supabase
        .from('lecturas_temperatura')
        .insert(batch)
        .select('id')

      if (error) {
        // If batch fails (likely duplicates), insert one by one ignoring errors
        console.warn(`[sync-temperatura] Batch insert error, falling back to individual: ${error.message}`)
        for (const row of batch) {
          const { error: singleErr } = await supabase.from('lecturas_temperatura').insert(row)
          if (!singleErr) insertedCount++
        }
      } else {
        insertedCount += inserted?.length || batch.length
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_lecturas: readings.length,
      inserted: insertedCount,
      estadisticas: data.estadisticas || null,
      rango: { start: startDate, end: endDate },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[sync-temperatura] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
