-- Allow users to view sales by IMEI if they own a machine with that IMEI
CREATE POLICY "Users can view sales by matching IMEI"
ON public.ventas_historico
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM maquinas
    WHERE maquinas.mac_address = ventas_historico.imei
    AND maquinas.usuario_id = auth.uid()
  )
);