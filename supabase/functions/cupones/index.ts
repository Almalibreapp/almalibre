import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_BASE = 'https://hxapi.huaxinvending.com'
const MCH_ID = '485410120201108'
const MCH_SECRET = 'Victor20260110Ab'
const SIGN = '742ec60a88d8224587cec0fc5755454ed'

let cachedAuth: { authorization: string; jsessionId: string; expiresAt: number } | null = null

async function authenticate() {
  if (cachedAuth && Date.now() < cachedAuth.expiresAt - 60_000) return cachedAuth

  const res = await fetch(`${API_BASE}/api/mch/mchLogin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mch_id: MCH_ID, mch_secret: MCH_SECRET, sign: SIGN }),
  })

  const text = await res.text()
  if (text.includes('<!DOCTYPE') || text.includes('<html')) {
    throw new Error('Manufacturer API temporarily unavailable')
  }

  const data = JSON.parse(text)
  const authorization = data.authorization ?? data.data?.authorization ?? ''
  const jsessionId = data.jsessionId ?? data.data?.jsessionId ?? data.JSESSIONID ?? ''

  if (!authorization) throw new Error('Auth failed: no authorization token')

  cachedAuth = { authorization, jsessionId, expiresAt: Date.now() + 30 * 60 * 1000 }
  return cachedAuth
}

async function apiRequest(path: string, body: Record<string, unknown> = {}) {
  const auth = await authenticate()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': auth.authorization,
  }
  if (auth.jsessionId) headers['Cookie'] = `JSESSIONID=${auth.jsessionId}`

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (text.includes('<!DOCTYPE') || text.includes('<html')) {
    throw new Error(`API ${path} temporarily unavailable`)
  }

  return JSON.parse(text)
}

function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'list'
    const supabase = getSupabaseClient()

    // ===== LIST COUPONS =====
    if (action === 'list') {
      // Try manufacturer API first
      let apiCupones: any[] = []
      let apiSuccess = false

      try {
        const data = await apiRequest('/api/mch/getCouponList', { page: 1, pageSize: 100 })
        console.log('[cupones] Manufacturer list response:', JSON.stringify(data).substring(0, 500))
        
        const list = data.list ?? data.data?.list ?? data.cupones ?? data.rows ?? []
        if (Array.isArray(list)) {
          apiCupones = list
          apiSuccess = true
        }
      } catch (err) {
        console.log('[cupones] Manufacturer API unavailable for list, using local cache:', err.message)
      }

      // If API returned coupons, cache them locally
      if (apiSuccess && apiCupones.length > 0) {
        for (const c of apiCupones) {
          const externalId = String(c.couponId ?? c.id ?? '')
          if (!externalId) continue

          await supabase.from('cupones_cache').upsert({
            external_id: externalId,
            nombre: c.couponName ?? c.nombre ?? '',
            tipo: String(c.couponType ?? c.tipo ?? '0'),
            contenido: c.content ?? c.contenido ?? null,
            fecha_inicio: c.startTime ?? c.fecha_inicio ?? null,
            fecha_fin: c.endTime ?? c.fecha_fin ?? null,
            dias_validez: Number(c.validDay ?? c.dias_validez ?? 0),
            ubicacion: c.localName ?? c.ubicacion ?? '',
            maquinas: c.deviceImeis ?? c.maquinas ?? '',
            cantidad_codigos: Number(c.totalCount ?? c.codeNum ?? c.cantidad_codigos ?? 0),
            raw_data: c,
          }, { onConflict: 'external_id' })
        }
      }

      // Always return from local cache (most reliable)
      const { data: cached, error: cacheErr } = await supabase
        .from('cupones_cache')
        .select('*')
        .order('created_at', { ascending: false })

      if (cacheErr) {
        console.error('[cupones] Cache read error:', cacheErr.message)
      }

      const cupones = (cached ?? []).map((c: any) => {
        let descuento = '0'
        try {
          const cont = typeof c.contenido === 'string' ? JSON.parse(c.contenido) : c.contenido
          descuento = cont?.money ?? '0'
        } catch {}

        return {
          id: c.external_id || c.id,
          nombre: c.nombre,
          tipo: c.tipo === '0' ? 'descuento' : c.tipo === '1' ? 'una_copa' : 'tarjeta_multiple',
          descuento,
          fecha_inicio: c.fecha_inicio,
          fecha_fin: c.fecha_fin,
          dias_validez: c.dias_validez,
          ubicacion: c.ubicacion,
          maquinas: c.maquinas,
          cantidad_codigos: c.cantidad_codigos,
          contenido: c.contenido,
        }
      })

      return new Response(JSON.stringify({
        success: true,
        cupones,
        total: cupones.length,
        pagina_actual: 1,
        total_paginas: 1,
        fuente: apiSuccess ? 'api+cache' : 'cache',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ===== CREATE COUPON =====
    if (action === 'edit' && req.method === 'POST') {
      const body = await req.json()
      console.log('[cupones] Creating coupon:', JSON.stringify(body))

      let apiResult: any = null
      let apiSuccess = false

      // Try manufacturer API
      try {
        apiResult = await apiRequest('/api/mch/editCoupon', body)
        console.log('[cupones] Create result:', JSON.stringify(apiResult))
        apiSuccess = true
      } catch (err) {
        console.log('[cupones] Manufacturer API unavailable for create, caching locally:', err.message)
      }

      // Always cache locally
      const externalId = String(apiResult?.couponId ?? apiResult?.id ?? `local_${Date.now()}`)

      await supabase.from('cupones_cache').upsert({
        external_id: externalId,
        nombre: body.couponName ?? '',
        tipo: String(body.couponType ?? '0'),
        contenido: body.content ?? null,
        fecha_inicio: body.startTime ?? null,
        fecha_fin: body.endTime ?? null,
        dias_validez: Number(body.validDay ?? 0),
        ubicacion: body.localName ?? '',
        maquinas: body.deviceImeis ?? '',
        cantidad_codigos: Number(body.totalCount ?? 0),
        raw_data: { ...body, result: apiResult },
      }, { onConflict: 'external_id' })

      return new Response(JSON.stringify({
        success: true,
        resultado: true,
        mensaje: apiSuccess
          ? (apiResult?.msg ?? apiResult?.message ?? 'Cupón creado')
          : 'Cupón guardado localmente (API del fabricante no disponible)',
        couponId: externalId,
        api_synced: apiSuccess,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ===== DELETE COUPON =====
    if (action === 'delete' && req.method === 'POST') {
      const body = await req.json()
      const couponIds = body.couponIds ?? body.ids ?? []

      // Try manufacturer API
      try {
        for (const id of couponIds) {
          await apiRequest('/api/mch/delCoupon', { couponId: id })
        }
      } catch (err) {
        console.log('[cupones] Delete from manufacturer failed:', err.message)
      }

      // Always delete from local cache
      for (const id of couponIds) {
        await supabase.from('cupones_cache').delete().eq('external_id', id)
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ===== GET COUPON CODES/RECORDS =====
    if (action === 'records') {
      const couponId = url.searchParams.get('couponId') ?? ''
      const page = Number(url.searchParams.get('page') ?? 1)

      let codigos: any[] = []
      let apiSuccess = false

      // Try manufacturer API (skip for locally-created coupons)
      if (!couponId.startsWith('local_')) {
        try {
          const data = await apiRequest('/api/mch/getCouponRecordList', {
            couponId,
            page,
            pageSize: 100,
          })
          console.log('[cupones] Records response:', JSON.stringify(data).substring(0, 500))
          
          const rawCodigos = data.list ?? data.data?.list ?? data.records ?? data.codigos ?? []
          codigos = (Array.isArray(rawCodigos) ? rawCodigos : []).map((item: any) => ({
            id: String(item.couponRecordId ?? item.id ?? item.code ?? ''),
            codigo: String(item.code ?? item.codigo ?? ''),
            estado: Number(item.status ?? 0) === 0 ? 'disponible' : 'usado',
            usado: Number(item.status ?? 0) !== 0,
            fecha_expiracion: item.endTime ?? item.fecha_expiracion ?? '',
            fecha_creacion: item.createTime ?? item.fecha_creacion ?? '',
          }))
          apiSuccess = true
        } catch (err) {
          console.log('[cupones] Manufacturer API unavailable for records:', err.message)
        }
      }

      return new Response(JSON.stringify({
        success: true,
        codigos,
        total: codigos.length,
        fuente: couponId.startsWith('local_') ? 'local' : (apiSuccess ? 'api' : 'cache'),
        nota: !apiSuccess && !couponId.startsWith('local_') 
          ? 'API del fabricante no disponible temporalmente' 
          : couponId.startsWith('local_') 
            ? 'Cupón guardado localmente - los códigos se generarán cuando la API esté disponible'
            : undefined,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ===== GENERATE CODES =====
    if (action === 'generate' && req.method === 'POST') {
      const body = await req.json()
      
      if (String(body.couponId ?? '').startsWith('local_')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Este cupón fue guardado localmente. Los códigos se generarán cuando la API del fabricante esté disponible.',
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      try {
        const result = await apiRequest('/api/mch/generateCouponCode', body)
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: 'API del fabricante no disponible: ' + err.message }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // ===== DELETE CODE =====
    if (action === 'deleteCode' && req.method === 'POST') {
      const body = await req.json()
      try {
        const result = await apiRequest('/api/mch/delCouponRecord', body)
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[cupones] Error:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
