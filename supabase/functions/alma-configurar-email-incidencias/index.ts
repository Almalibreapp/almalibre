import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ENDPOINT = 'https://elon.alohafrozen.eu/admin/configurar-email-incidencias';

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
    const maquinaId = typeof body?.maquinaId === 'string' ? body.maquinaId.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 200) : '';
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!maquinaId || !emailOk) {
      return json({ error: 'Datos inválidos: se requiere maquinaId y un email válido.' }, 400);
    }

    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maquinaId, email }),
    });

    const text = await upstream.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }

    if (!upstream.ok) {
      console.error('configurar-email-incidencias upstream error', upstream.status, text.slice(0, 300));
      return json({ error: 'upstream_error', status: upstream.status, detalle: data }, 502);
    }

    return json({ ok: true, email, data });
  } catch (e) {
    console.error('alma-configurar-email-incidencias error', e);
    return json({ error: 'internal_error' }, 500);
  }
});
