
-- Tabla: productos (tienda)
CREATE TABLE public.productos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio DECIMAL(10,2) NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('acai', 'toppings', 'consumibles', 'merchandising')),
  imagen_url TEXT,
  stock_disponible INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla: pedidos
CREATE TABLE public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_pedido TEXT UNIQUE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'preparacion', 'enviado', 'entregado', 'cancelado')),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  envio DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  direccion_envio TEXT,
  metodo_pago TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla: pedido_items
CREATE TABLE public.pedido_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL
);

-- Tabla: incidencias
CREATE TABLE public.incidencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  maquina_id UUID NOT NULL REFERENCES public.maquinas(id) ON DELETE CASCADE,
  numero_ticket TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('normal', 'urgente')),
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'en_proceso', 'resuelta', 'cerrada')),
  fotos JSONB DEFAULT '[]'::jsonb,
  resolucion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla: incidencia_mensajes
CREATE TABLE public.incidencia_mensajes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incidencia_id UUID NOT NULL REFERENCES public.incidencias(id) ON DELETE CASCADE,
  autor TEXT NOT NULL CHECK (autor IN ('usuario', 'soporte')),
  mensaje TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla: video_tutoriales
CREATE TABLE public.video_tutoriales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT NOT NULL,
  video_url TEXT,
  thumbnail_url TEXT,
  duracion TEXT,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla: codigos_promocionales
CREATE TABLE public.codigos_promocionales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  codigo TEXT UNIQUE NOT NULL,
  tipo_descuento TEXT NOT NULL CHECK (tipo_descuento IN ('porcentaje', 'monto_fijo')),
  valor_descuento DECIMAL(10,2) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_expiracion DATE NOT NULL,
  usos_maximos INTEGER,
  usos_actuales INTEGER DEFAULT 0,
  maquinas JSONB DEFAULT '[]'::jsonb,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'pausado', 'expirado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla: canjes_codigo
CREATE TABLE public.canjes_codigo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_id UUID NOT NULL REFERENCES public.codigos_promocionales(id) ON DELETE CASCADE,
  maquina_id UUID NOT NULL REFERENCES public.maquinas(id),
  fecha_canje TIMESTAMP WITH TIME ZONE DEFAULT now(),
  monto_original DECIMAL(10,2),
  descuento_aplicado DECIMAL(10,2)
);

-- Tabla: metodos_pago
CREATE TABLE public.metodos_pago (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('tarjeta', 'cuenta_bancaria')),
  nombre TEXT NOT NULL,
  ultimos_digitos TEXT,
  predeterminado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla: suscripciones
CREATE TABLE public.suscripciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('basico', 'pro', 'premium')),
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'inactiva', 'cancelada', 'por_vencer')),
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_renovacion DATE,
  precio_mensual DECIMAL(10,2) NOT NULL DEFAULT 0,
  metodo_pago_id UUID REFERENCES public.metodos_pago(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla: pagos_suscripcion
CREATE TABLE public.pagos_suscripcion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suscripcion_id UUID NOT NULL REFERENCES public.suscripciones(id) ON DELETE CASCADE,
  monto DECIMAL(10,2) NOT NULL,
  fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT now(),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('completado', 'fallido', 'pendiente')),
  factura_url TEXT
);

-- Tabla: mensajes_soporte (chat)
CREATE TABLE public.mensajes_soporte (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor TEXT NOT NULL CHECK (autor IN ('usuario', 'soporte')),
  mensaje TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Actualizar profiles para incluir más campos
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS nif_cif TEXT,
ADD COLUMN IF NOT EXISTS nombre_empresa TEXT,
ADD COLUMN IF NOT EXISTS foto_url TEXT,
ADD COLUMN IF NOT EXISTS intereses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS notificaciones JSONB DEFAULT '{"stock_bajo": true, "temperatura": true, "ventas": false, "pedidos": true, "incidencias": true, "promociones": true, "canal": "push"}'::jsonb;

-- Enable RLS on all new tables
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencia_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_tutoriales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codigos_promocionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canjes_codigo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_suscripcion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes_soporte ENABLE ROW LEVEL SECURITY;

-- RLS Policies for productos (public read)
CREATE POLICY "Anyone can view active products" ON public.productos FOR SELECT USING (activo = true);

-- RLS Policies for pedidos
CREATE POLICY "Users can view their own orders" ON public.pedidos FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "Users can create their own orders" ON public.pedidos FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Users can update their own orders" ON public.pedidos FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);

-- RLS Policies for pedido_items
CREATE POLICY "Users can view their order items" ON public.pedido_items FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.pedidos WHERE pedidos.id = pedido_items.pedido_id AND pedidos.usuario_id = auth.uid()));
CREATE POLICY "Users can create order items" ON public.pedido_items FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.pedidos WHERE pedidos.id = pedido_items.pedido_id AND pedidos.usuario_id = auth.uid()));

-- RLS Policies for incidencias
CREATE POLICY "Users can view their own incidents" ON public.incidencias FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "Users can create incidents" ON public.incidencias FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Users can update their incidents" ON public.incidencias FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);

-- RLS Policies for incidencia_mensajes
CREATE POLICY "Users can view messages of their incidents" ON public.incidencia_mensajes FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.incidencias WHERE incidencias.id = incidencia_mensajes.incidencia_id AND incidencias.usuario_id = auth.uid()));
CREATE POLICY "Users can create messages on their incidents" ON public.incidencia_mensajes FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.incidencias WHERE incidencias.id = incidencia_mensajes.incidencia_id AND incidencias.usuario_id = auth.uid()));

-- RLS Policies for video_tutoriales (public read)
CREATE POLICY "Anyone can view active tutorials" ON public.video_tutoriales FOR SELECT USING (activo = true);

-- RLS Policies for codigos_promocionales
CREATE POLICY "Users can view their own promo codes" ON public.codigos_promocionales FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "Users can create promo codes" ON public.codigos_promocionales FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Users can update their promo codes" ON public.codigos_promocionales FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "Users can delete their promo codes" ON public.codigos_promocionales FOR DELETE TO authenticated USING (auth.uid() = usuario_id);

-- RLS Policies for canjes_codigo
CREATE POLICY "Users can view redemptions of their codes" ON public.canjes_codigo FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.codigos_promocionales WHERE codigos_promocionales.id = canjes_codigo.codigo_id AND codigos_promocionales.usuario_id = auth.uid()));

-- RLS Policies for metodos_pago
CREATE POLICY "Users can view their payment methods" ON public.metodos_pago FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "Users can create payment methods" ON public.metodos_pago FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Users can update their payment methods" ON public.metodos_pago FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "Users can delete their payment methods" ON public.metodos_pago FOR DELETE TO authenticated USING (auth.uid() = usuario_id);

-- RLS Policies for suscripciones
CREATE POLICY "Users can view their subscriptions" ON public.suscripciones FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "Users can create subscriptions" ON public.suscripciones FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Users can update their subscriptions" ON public.suscripciones FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);

-- RLS Policies for pagos_suscripcion
CREATE POLICY "Users can view their subscription payments" ON public.pagos_suscripcion FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.suscripciones WHERE suscripciones.id = pagos_suscripcion.suscripcion_id AND suscripciones.usuario_id = auth.uid()));

-- RLS Policies for mensajes_soporte
CREATE POLICY "Users can view their support messages" ON public.mensajes_soporte FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "Users can create support messages" ON public.mensajes_soporte FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);

-- Insert sample products
INSERT INTO public.productos (nombre, descripcion, precio, categoria, stock_disponible) VALUES
('Açaí Premium', 'Cubeta de açaí premium 5kg', 45.00, 'acai', 100),
('Açaí Orgánico', 'Cubeta de açaí orgánico certificado 5kg', 55.00, 'acai', 50),
('Açaí Mix Frutas', 'Cubeta de açaí con mix de frutas 5kg', 48.00, 'acai', 75),
('Granola Artesanal', 'Bolsa de granola artesanal 1kg', 8.50, 'toppings', 200),
('Coco Rallado', 'Bolsa de coco rallado 500g', 4.50, 'toppings', 150),
('Chips de Chocolate', 'Bolsa de chips de chocolate 500g', 6.00, 'toppings', 180),
('Frutas Deshidratadas', 'Mix de frutas deshidratadas 500g', 7.50, 'toppings', 120),
('Miel Orgánica', 'Botella de miel orgánica 500ml', 9.00, 'toppings', 90),
('Plátano Liofilizado', 'Bolsa de plátano liofilizado 300g', 5.50, 'toppings', 140),
('Fresas Congeladas', 'Bolsa de fresas congeladas 1kg', 8.00, 'toppings', 100),
('Arándanos Congelados', 'Bolsa de arándanos congelados 1kg', 10.00, 'toppings', 80),
('Mantequilla de Maní', 'Bote de mantequilla de maní 500g', 7.00, 'toppings', 110),
('Semillas de Chía', 'Bolsa de semillas de chía 300g', 4.00, 'toppings', 200),
('Vasos Biodegradables', 'Pack de 100 vasos biodegradables', 12.00, 'consumibles', 500),
('Cucharas de Madera', 'Pack de 100 cucharas de madera', 8.00, 'consumibles', 400),
('Servilletas Eco', 'Pack de 200 servilletas ecológicas', 5.00, 'consumibles', 600),
('Tapas para Vasos', 'Pack de 100 tapas para vasos', 6.00, 'consumibles', 450),
('Camiseta Staff', 'Camiseta oficial Almalibre para staff', 15.00, 'merchandising', 50),
('Delantal con Logo', 'Delantal oficial con logo Almalibre', 18.00, 'merchandising', 40),
('Gorra Almalibre', 'Gorra oficial Almalibre', 12.00, 'merchandising', 60);

-- Function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  seq_number INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_pedido FROM 10) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.pedidos
  WHERE numero_pedido LIKE 'ALM-' || year_part || '-%';
  new_number := 'ALM-' || year_part || '-' || LPAD(seq_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  seq_number INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_ticket FROM 10) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.incidencias
  WHERE numero_ticket LIKE 'INC-' || year_part || '-%';
  new_number := 'INC-' || year_part || '-' || LPAD(seq_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;
