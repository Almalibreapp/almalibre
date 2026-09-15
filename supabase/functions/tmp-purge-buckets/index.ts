import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const out: Record<string, unknown> = {};

  const collect = async (bucket: string, prefix = ''): Promise<string[]> => {
    const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    const paths: string[] = [];
    for (const f of data ?? []) {
      const full = prefix ? `${prefix}/${f.name}` : f.name;
      if ((f as any).id === null) paths.push(...(await collect(bucket, full)));
      else paths.push(full);
    }
    return paths;
  };

  for (const bucket of ['incidencias-clientes', 'incident-photos']) {
    const paths = await collect(bucket);
    for (let i = 0; i < paths.length; i += 100) {
      await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
    }
    const { error } = await admin.storage.deleteBucket(bucket);
    out[bucket] = error ? `${error.message} (${paths.length} archivos)` : 'deleted';
  }

  return new Response(JSON.stringify(out), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
