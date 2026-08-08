import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ENDPOINT = 'https://elon.alohafrozen.eu/admin/toggle-ia';

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
    const conversationId = typeof body?.conversationId === 'string' ? body.conversationId.trim() : '';
    const pausarIA = body?.pausarIA === true;

    if (!conversationId) {
      return json({ error: 'Datos inválidos: se requiere conversationId.' }, 400);
    }

    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, pausarIA }),
    });

    const text = await upstream.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }

    if (!upstream.ok) {
      console.error('toggle-ia upstream error', upstream.status, text.slice(0, 300));
      return json({ error: 'upstream_error', status: upstream.status, detalle: data }, 502);
    }

    return json({ ok: true, status: data?.status ?? (pausarIA ? 'paused' : 'active') });
  } catch (e) {
    console.error('alma-toggle-ia error', e);
    return json({ error: 'internal_error' }, 500);
  }
});
