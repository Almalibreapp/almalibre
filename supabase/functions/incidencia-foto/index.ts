import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    const imeiRaw = String(form?.get('imei') ?? '');

    if (!(file instanceof File)) return json({ error: 'archivo_requerido' }, 400);
    if (!ALLOWED.includes(file.type)) return json({ error: 'formato_invalido' }, 400);
    if (file.size > MAX_BYTES) return json({ error: 'archivo_grande' }, 400);

    const imei = /^[A-Za-z0-9._:-]{1,40}$/.test(imeiRaw) ? imeiRaw : 'sin-imei';
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const ruta = `${imei}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: upErr } = await admin.storage
      .from('incidencias-clientes')
      .upload(ruta, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (upErr) return json({ error: 'error_subida' }, 500);

    const { data, error: signErr } = await admin.storage
      .from('incidencias-clientes')
      .createSignedUrl(ruta, 60 * 60 * 24 * 365);
    if (signErr || !data?.signedUrl) return json({ error: 'error_url' }, 500);

    return json({ ok: true, path: ruta, url: data.signedUrl });
  } catch {
    return json({ error: 'error_interno' }, 500);
  }
});
