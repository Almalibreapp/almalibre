
-- Add sensor and fuente columns to lecturas_temperatura for detailed history
ALTER TABLE public.lecturas_temperatura 
  ADD COLUMN IF NOT EXISTS sensor text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fuente text DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS imei text DEFAULT '';

-- Create index for efficient querying by imei and time range
CREATE INDEX IF NOT EXISTS idx_lecturas_temperatura_imei_created 
  ON public.lecturas_temperatura (imei, created_at DESC);

-- Create unique constraint to prevent duplicate readings from sync
CREATE UNIQUE INDEX IF NOT EXISTS idx_lecturas_temperatura_unique_reading
  ON public.lecturas_temperatura (maquina_id, created_at, sensor)
  WHERE sensor != '' AND sensor IS NOT NULL;
