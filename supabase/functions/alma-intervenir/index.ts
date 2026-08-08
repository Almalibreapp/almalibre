import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ENDPOINT = 'https://elon.alohafrozen.eu/admin/intervenir';

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
    const autor = typeof body?.autor === 'string' ? body.autor.trim() : '';
    const mensaje = typeof body?.mensaje === 'string' ? body.mensaje.trim() : '';
    const pausarIA = body?.pausarIA === true;
    const cargo = typeof body?.cargo === 'string' ? body.cargo.trim() : undefined;
    const fotoUrl = typeof body?.fotoUrl === 'string' ? body.fotoUrl.trim() : undefined;
    // Cambio de estado sin mensaje (activar / pausar a Alma)
    const soloEstado = body?.soloEstado === true;

    if (!conversationId || !autor || mensaje.length > 4000 || (!mensaje && !soloEstado)) {
      return json({ error: 'Datos inválidos: se requiere conversationId, autor y mensaje.' }, 400);
    }

    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, autor, mensaje, pausarIA, cargo, fotoUrl }),
    });

    const text = await upstream.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }

    if (!upstream.ok) {
      console.error('intervenir upstream error', upstream.status, text.slice(0, 300));
      return json({ error: 'upstream_error', status: upstream.status, detalle: data }, 502);
    }

    return json({ ok: true, data });
  } catch (e) {
    console.error('alma-intervenir error', e);
    return json({ error: 'internal_error' }, 500);
  }
});
