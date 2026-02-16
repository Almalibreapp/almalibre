
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Create stock_config table
CREATE TABLE public.stock_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_imei TEXT NOT NULL,
  topping_position TEXT NOT NULL,
  topping_name TEXT NOT NULL DEFAULT '',
  capacidad_maxima INTEGER NOT NULL DEFAULT 100,
  unidades_actuales INTEGER NOT NULL DEFAULT 100,
  alerta_minimo INTEGER NOT NULL DEFAULT 20,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (machine_imei, topping_position)
);
ALTER TABLE public.stock_config ENABLE ROW LEVEL SECURITY;

-- 6. RLS for stock_config
CREATE POLICY "Users can view their own stock"
  ON public.stock_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own stock"
  ON public.stock_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stock"
  ON public.stock_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all stock"
  ON public.stock_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Stock history (restocking log)
CREATE TABLE public.stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_imei TEXT NOT NULL,
  topping_position TEXT NOT NULL,
  topping_name TEXT NOT NULL DEFAULT '',
  unidades_anteriores INTEGER NOT NULL DEFAULT 0,
  unidades_nuevas INTEGER NOT NULL DEFAULT 0,
  accion TEXT NOT NULL DEFAULT 'rellenar',
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stock history"
  ON public.stock_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stock history"
  ON public.stock_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all stock history"
  ON public.stock_history FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 8. Stock sync tracking
CREATE TABLE public.stock_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_imei TEXT NOT NULL UNIQUE,
  ultima_sincronizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ultima_venta_id TEXT,
  user_id UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sync log"
  ON public.stock_sync_log FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all sync logs"
  ON public.stock_sync_log FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 9. Trigger for updated_at on stock_config
CREATE TRIGGER update_stock_config_updated_at
  BEFORE UPDATE ON public.stock_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Trigger for updated_at on stock_sync_log
CREATE TRIGGER update_stock_sync_log_updated_at
  BEFORE UPDATE ON public.stock_sync_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
