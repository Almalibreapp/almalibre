import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ENDPOINT = 'https://elon.alohafrozen.eu/admin/agregar-actualizacion-ticket';

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
    const autor = typeof body?.autor === 'string' ? body.autor.trim().slice(0, 120) : '';
    const nota = typeof body?.nota === 'string' ? body.nota.trim().slice(0, 4000) : '';

    if (!ticketId || !nota) {
      return json({ error: 'Datos inválidos: se requiere ticketId y nota.' }, 400);
    }

    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, autor: autor || 'Franquiciado', nota }),
    });

    const text = await upstream.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }

    if (!upstream.ok) {
      console.error('agregar-actualizacion-ticket upstream error', upstream.status, text.slice(0, 300));
      return json({ error: 'upstream_error', status: upstream.status, detalle: data }, 502);
    }

    return json({ ok: true, data });
  } catch (e) {
    console.error('alma-agregar-actualizacion-ticket error', e);
    return json({ error: 'internal_error' }, 500);
  }
});
