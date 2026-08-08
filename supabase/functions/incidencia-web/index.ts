import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ENDPOINT = 'https://elon.alohafrozen.eu/incidencia-web';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

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
    const imei = str(body?.imei, 40);
    const nombre = str(body?.nombre, 120);
    const whatsapp = str(body?.whatsapp, 40);
    const email = str(body?.email, 200);
    const mensaje = str(body?.mensaje, 4000);
    const imagenUrl = str(body?.imagenUrl, 2000) || null;
    const idioma = str(body?.idioma, 5).toLowerCase() === 'en' ? 'en' : 'es';

    if (!imei || !/^[A-Za-z0-9._:-]+$/.test(imei)) return json({ error: 'imei_invalido' }, 400);
    if (!nombre || !whatsapp) return json({ error: 'datos_incompletos' }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'email_invalido' }, 400);
    if (!mensaje) return json({ error: 'mensaje_vacio' }, 400);

    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imei, nombre, whatsapp, email, mensaje, imagenUrl, idioma }),
    });


    const text = await upstream.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { respuesta: text.slice(0, 4000) };
    }

    if (!upstream.ok) {
      console.error('incidencia-web upstream', upstream.status, text.slice(0, 300));
      return json({ error: 'upstream_error', status: upstream.status }, 502);
    }

    return json(data);
  } catch (e) {
    console.error('incidencia-web error', e);
    return json({ error: 'internal_error' }, 500);
  }
});
