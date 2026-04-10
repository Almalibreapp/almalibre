CREATE TABLE IF NOT EXISTS public.cupones_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE NOT NULL,
  nombre text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '0',
  contenido jsonb,
  fecha_inicio text,
  fecha_fin text,
  dias_validez integer DEFAULT 0,
  ubicacion text DEFAULT '',
  maquinas text DEFAULT '',
  cantidad_codigos integer DEFAULT 0,
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.cupones_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to read cupones_cache"
  ON public.cupones_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access to cupones_cache"
  ON public.cupones_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);