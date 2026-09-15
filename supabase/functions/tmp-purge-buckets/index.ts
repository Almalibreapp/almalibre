import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const out: Record<string, unknown> = {};
  for (const bucket of ['incidencias-clientes', 'incident-photos']) {
    const { data: files } = await admin.storage.from(bucket).list('', { limit: 1000 });
    const paths = (files ?? []).map((f) => f.name);
    if (paths.length) await admin.storage.from(bucket).remove(paths);
    await admin.storage.emptyBucket(bucket);
    const { error } = await admin.storage.deleteBucket(bucket);
    out[bucket] = error ? error.message : 'deleted';
  }

  return new Response(JSON.stringify(out), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
