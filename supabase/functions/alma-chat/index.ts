import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ALMA_ENDPOINT = 'https://elon.alohafrozen.eu/chat-app';
const TENANT_ID = '00000000-0000-0000-0000-0000000000aa';

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
    const body = await req.json().catch(() => null);
    const imei = typeof body?.imei === 'string' ? body.imei.trim() : '';
    const mensaje = typeof body?.mensaje === 'string' ? body.mensaje.trim() : '';

    if (!imei || !mensaje || mensaje.length > 4000) {
      return json({ error: 'Datos inválidos: se requiere imei y mensaje.' }, 400);
    }

    const upstream = await fetch(ALMA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: TENANT_ID, imei, mensaje }),
    });

    const text = await upstream.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }

    if (upstream.status === 404) {
      return json({ error: 'machine_not_found' }, 404);
    }

    if (!upstream.ok) {
      console.error('Alma upstream error', upstream.status, text.slice(0, 300));
      return json({ error: 'upstream_error', status: upstream.status }, 502);
    }

    return json(data);
  } catch (e) {
    console.error('alma-chat error', e);
    return json({ error: 'internal_error' }, 500);
  }
});
