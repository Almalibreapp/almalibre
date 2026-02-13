
-- Table to store temperature readings for traceability
CREATE TABLE public.lecturas_temperatura (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  maquina_id UUID NOT NULL REFERENCES public.maquinas(id) ON DELETE CASCADE,
  temperatura NUMERIC NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'C',
  estado TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lecturas_temperatura ENABLE ROW LEVEL SECURITY;

-- Users can view temperature readings for their machines
CREATE POLICY "Users can view their machine temperature readings"
ON public.lecturas_temperatura
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.maquinas
  WHERE maquinas.id = lecturas_temperatura.maquina_id
  AND maquinas.usuario_id = auth.uid()
));

-- Users can insert temperature readings for their machines
CREATE POLICY "Users can insert temperature readings for their machines"
ON public.lecturas_temperatura
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.maquinas
  WHERE maquinas.id = lecturas_temperatura.maquina_id
  AND maquinas.usuario_id = auth.uid()
));

-- Index for efficient queries by machine and date
CREATE INDEX idx_lecturas_temperatura_maquina_fecha 
ON public.lecturas_temperatura (maquina_id, created_at DESC);
