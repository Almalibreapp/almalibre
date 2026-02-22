
-- Tabla para almacenar histórico de ventas por máquina
CREATE TABLE public.ventas_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquina_id uuid NOT NULL REFERENCES public.maquinas(id) ON DELETE CASCADE,
  imei text NOT NULL,
  venta_api_id text NOT NULL,
  fecha date NOT NULL,
  hora text NOT NULL,
  producto text NOT NULL,
  precio numeric NOT NULL DEFAULT 0,
  cantidad_unidades integer NOT NULL DEFAULT 1,
  metodo_pago text NOT NULL DEFAULT 'efectivo',
  numero_orden text,
  estado text NOT NULL DEFAULT 'exitoso',
  toppings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Evitar duplicados: misma venta de la API no se inserta dos veces
  UNIQUE(imei, venta_api_id)
);

-- Índices para consultas rápidas
CREATE INDEX idx_ventas_historico_imei_fecha ON public.ventas_historico(imei, fecha DESC);
CREATE INDEX idx_ventas_historico_maquina_fecha ON public.ventas_historico(maquina_id, fecha DESC);
CREATE INDEX idx_ventas_historico_fecha ON public.ventas_historico(fecha DESC);
CREATE INDEX idx_ventas_historico_metodo_pago ON public.ventas_historico(metodo_pago);

-- Tabla para registrar última sincronización por máquina
CREATE TABLE public.ventas_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquina_id uuid NOT NULL REFERENCES public.maquinas(id) ON DELETE CASCADE UNIQUE,
  imei text NOT NULL UNIQUE,
  ultima_fecha_sync date NOT NULL DEFAULT CURRENT_DATE,
  ultima_venta_api_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ventas_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS: Solo admins pueden leer/escribir ventas históricas
CREATE POLICY "Admins can manage all ventas_historico"
ON public.ventas_historico FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view sales of their own machines
CREATE POLICY "Users can view their machine sales"
ON public.ventas_historico FOR SELECT
USING (EXISTS (
  SELECT 1 FROM maquinas
  WHERE maquinas.id = ventas_historico.maquina_id
  AND maquinas.usuario_id = auth.uid()
));

-- Sync log policies
CREATE POLICY "Admins can manage sync logs"
ON public.ventas_sync_log FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage sync logs"
ON public.ventas_sync_log FOR ALL
USING (true);
