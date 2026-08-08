import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ENDPOINT = 'https://elon.alohafrozen.eu/incidencia-info';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const url = new URL(req.url);
    let imei = (url.searchParams.get('imei') ?? '').trim();
    if (!imei && req.method === 'POST') {
      const body = await req.json().catch(() => null);
      imei = typeof body?.imei === 'string' ? body.imei.trim() : '';
    }

    if (!imei || imei.length > 40 || !/^[A-Za-z0-9._:-]+$/.test(imei)) {
      return json({ error: 'imei_invalido' }, 400);
    }

    const upstream = await fetch(`${ENDPOINT}?imei=${encodeURIComponent(imei)}`, {
      headers: { Accept: 'application/json' },
    });

    const text = await upstream.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }

    if (upstream.status === 404) return json({ error: 'machine_not_found' }, 404);
    if (!upstream.ok) {
      console.error('incidencia-info upstream', upstream.status, text.slice(0, 300));
      return json({ error: 'upstream_error', status: upstream.status }, 502);
    }

    return json(data);
  } catch (e) {
    console.error('incidencia-info error', e);
    return json({ error: 'internal_error' }, 500);
  }
});
