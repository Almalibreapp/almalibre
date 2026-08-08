import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ENDPOINT = 'https://elon.alohafrozen.eu/admin/cambiar-estado-ticket';

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
    const ticketId = typeof body?.ticketId === 'string' ? body.ticketId.trim() : '';
    const nuevoEstado = body?.nuevoEstado === 'resuelto' ? 'resuelto' : 'abierto';

    if (!ticketId) {
      return json({ error: 'Datos inválidos: se requiere ticketId.' }, 400);
    }

    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, nuevoEstado }),
    });

    const text = await upstream.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }

    if (!upstream.ok) {
      console.error('cambiar-estado-ticket upstream error', upstream.status, text.slice(0, 300));
      return json({ error: 'upstream_error', status: upstream.status, detalle: data }, 502);
    }

    return json({ ok: true, estado: data?.estado ?? data?.status ?? nuevoEstado });
  } catch (e) {
    console.error('alma-cambiar-estado-ticket error', e);
    return json({ error: 'internal_error' }, 500);
  }
});
