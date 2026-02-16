
-- Admin RLS policies for existing tables

-- Admins can view all machines
CREATE POLICY "Admins can view all machines"
  ON public.maquinas FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all machines
CREATE POLICY "Admins can manage all machines"
  ON public.maquinas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all temperature readings
CREATE POLICY "Admins can view all temperature readings"
  ON public.lecturas_temperatura FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all incidents
CREATE POLICY "Admins can view all incidents"
  ON public.incidencias FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
  ON public.notificaciones FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON public.pedidos FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON public.suscripciones FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all promo codes
CREATE POLICY "Admins can view all promo codes"
  ON public.codigos_promocionales FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
