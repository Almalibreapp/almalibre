import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const url = new URL(req.url)
    const imei = url.searchParams.get('imei')

    if (!imei) {
      return new Response(JSON.stringify({ error: 'imei es requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the latest temperature readings for this IMEI from the DB
    const { data: readings, error } = await supabase
      .from('lecturas_temperatura')
      .select('temperatura, unidad, estado, created_at, sensor')
      .eq('imei', imei)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const datos = (readings ?? []).map((r: any) => ({
      temperatura: r.temperatura,
      unidad: r.unidad || 'C',
      estado: r.estado || 'normal',
      timestamp: r.created_at,
      sensor: r.sensor,
    }))

    const latest = datos.length > 0 ? datos[0] : null

    return new Response(JSON.stringify({
      success: true,
      temperatura: latest?.temperatura ?? null,
      unidad: latest?.unidad || 'C',
      estado: latest?.estado || 'normal',
      timestamp: latest?.timestamp || new Date().toISOString(),
      datos,
      total: datos.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[temperatura] Error:', (error as Error).message)
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
