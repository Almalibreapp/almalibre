-- Tabla: dispositivos_usuario (tokens de push por dispositivo)
CREATE TABLE public.dispositivos_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL,
  token_push TEXT NOT NULL,
  plataforma TEXT NOT NULL CHECK (plataforma IN ('android', 'ios', 'web')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(usuario_id, plataforma)
);

-- Enable RLS
ALTER TABLE public.dispositivos_usuario ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own devices"
ON public.dispositivos_usuario FOR SELECT
USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert their own devices"
ON public.dispositivos_usuario FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update their own devices"
ON public.dispositivos_usuario FOR UPDATE
USING (auth.uid() = usuario_id);

CREATE POLICY "Users can delete their own devices"
ON public.dispositivos_usuario FOR DELETE
USING (auth.uid() = usuario_id);

-- Tabla: notificaciones (historial de notificaciones)
CREATE TABLE public.notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('stock_bajo', 'temperatura_alerta', 'nueva_venta', 'pedido_actualizado', 'incidencia_actualizada', 'promocion')),
  datos JSONB DEFAULT '{}'::jsonb,
  leida BOOLEAN DEFAULT false,
  enviada BOOLEAN DEFAULT false,
  fecha_envio TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
ON public.notificaciones FOR SELECT
USING (auth.uid() = usuario_id);

CREATE POLICY "Users can update their own notifications"
ON public.notificaciones FOR UPDATE
USING (auth.uid() = usuario_id);

CREATE POLICY "Users can delete their own notifications"
ON public.notificaciones FOR DELETE
USING (auth.uid() = usuario_id);

-- Tabla: preferencias_notificaciones
CREATE TABLE public.preferencias_notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL UNIQUE,
  stock_bajo BOOLEAN DEFAULT true,
  temperatura_alerta BOOLEAN DEFAULT true,
  nuevas_ventas BOOLEAN DEFAULT false,
  pedidos BOOLEAN DEFAULT true,
  incidencias BOOLEAN DEFAULT true,
  promociones BOOLEAN DEFAULT true,
  canal_push BOOLEAN DEFAULT true,
  canal_email BOOLEAN DEFAULT true,
  umbral_stock INTEGER DEFAULT 20,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.preferencias_notificaciones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own preferences"
ON public.preferencias_notificaciones FOR SELECT
USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert their own preferences"
ON public.preferencias_notificaciones FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update their own preferences"
ON public.preferencias_notificaciones FOR UPDATE
USING (auth.uid() = usuario_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_dispositivos_usuario_updated_at
BEFORE UPDATE ON public.dispositivos_usuario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_preferencias_notificaciones_updated_at
BEFORE UPDATE ON public.preferencias_notificaciones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();