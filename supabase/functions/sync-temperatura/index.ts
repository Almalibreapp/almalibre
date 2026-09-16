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

    // Modo flota: sin imei/maquina_id recorremos todas las máquinas.
    // Para el cron cada 2 minutos el rango por defecto es solo el día en curso
    // (las lecturas se deduplican; el histórico antiguo ya está guardado).
    const fleet = !imei || !maquina_id

    let targets: { id: string; imei: string }[]
    let defaultStart: string

    if (fleet) {
      const { data: maquinas, error: mErr } = await supabase
        .from('maquinas')
        .select('id, mac_address')
      if (mErr) {
        return new Response(JSON.stringify({ error: mErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const seen = new Set<string>()
      targets = (maquinas || [])
        .filter((m: any) => m.mac_address && !seen.has(m.mac_address) && seen.add(m.mac_address))
        .map((m: any) => ({ id: m.id, imei: m.mac_address }))
      defaultStart = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
      if (targets.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'No hay máquinas' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      targets = [{ id: maquina_id, imei }]
      defaultStart = (() => {
        const d = new Date()
        d.setDate(d.getDate() - 2)
        return d.toISOString().split('T')[0]
      })()
    }

    const endDate = end || defaultStart
    const startDate = start || defaultStart

    const results: any[] = []

    for (const target of targets) {
      try {
        const url = `${API_BASE_URL}/temperatura/historial/${target.imei}?start=${startDate}&end=${endDate}`
        const res = await fetch(url, { headers })
        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          results.push({ imei: target.imei, error: `API ${res.status}`, details: errText.slice(0, 200) })
          continue
        }

        const data = await res.json()
        const readings = data.datos || data.data || data.lecturas || []
        if (!Array.isArray(readings) || readings.length === 0) {
          results.push({ imei: target.imei, total_lecturas: 0, inserted: 0 })
          continue
        }

        // Claves ya presentes en la BD para este rango -> evita duplicados
        // (el índice único solo cubre lecturas con sensor no vacío).
        let existingKeys = new Set<string>()
        const { data: existing } = await supabase
          .from('lecturas_temperatura')
          .select('created_at, sensor')
          .eq('maquina_id', target.id)
          .gte('created_at', `${startDate}T00:00:00Z`)
          .lte('created_at', `${endDate}T23:59:59Z`)
        if (existing) {
          existingKeys = new Set(existing.map((r: any) => `${r.created_at}|${r.sensor || ''}`))
        }

        const rows = readings
          .map((r: any) => {
            const temp = Number(r.temperatura)
            const estado = temp >= 11 ? 'critico' : temp >= 8 ? 'alerta' : 'normal'

            // La API devuelve "2026-02-23 00:00:40" o solo la hora "00:02:56"
            let createdAt: string
            if (r.timestamp) {
              const ts = String(r.timestamp).trim()
              if (ts.match(/^\d{4}-\d{2}-\d{2}/)) {
                createdAt = ts.includes('T') ? ts : ts.replace(' ', 'T')
                if (!createdAt.endsWith('Z') && !createdAt.includes('+')) createdAt += 'Z'
              } else if (ts.match(/^\d{2}:\d{2}/)) {
                createdAt = `${startDate}T${ts}Z`
              } else {
                createdAt = new Date().toISOString()
              }
            } else {
              createdAt = new Date().toISOString()
            }

            const sensor = r.sensor || ''
            return {
              maquina_id: target.id,
              temperatura: temp,
              unidad: data.estadisticas?.unidad || r.unidad || 'C',
              estado,
              created_at: createdAt,
              sensor,
              fuente: r.fuente || 'fabricante',
              imei: target.imei,
            }
          })
          .filter((row: any) => !existingKeys.has(`${row.created_at}|${row.sensor}`))

        let insertedCount = 0
        const batchSize = 500
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize)
          const { error, data: inserted } = await supabase
            .from('lecturas_temperatura')
            .insert(batch)
            .select('id')

          if (error) {
            console.warn(`[sync-temperatura] Batch insert error, falling back to individual: ${error.message}`)
            for (const row of batch) {
              const { error: singleErr } = await supabase.from('lecturas_temperatura').insert(row)
              if (!singleErr) insertedCount++
            }
          } else {
            insertedCount += inserted?.length || batch.length
          }
        }

        results.push({
          imei: target.imei,
          total_lecturas: readings.length,
          inserted: insertedCount,
          rango: { start: startDate, end: endDate },
        })
      } catch (e) {
        results.push({ imei: target.imei, error: (e as Error).message })
      }
    }

    return new Response(JSON.stringify({ success: true, fleet, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[sync-temperatura] Error:', (error as Error).message)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
