
-- Allow admins to view all incident messages
CREATE POLICY "Admins can view all incident messages"
  ON public.incidencia_mensajes
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert messages on any incident
CREATE POLICY "Admins can create messages on any incident"
  ON public.incidencia_mensajes
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update any incident
CREATE POLICY "Admins can update any incident"
  ON public.incidencias
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
