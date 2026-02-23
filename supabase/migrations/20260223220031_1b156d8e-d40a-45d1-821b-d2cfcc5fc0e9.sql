
-- Drop the old user-based SELECT policy for franchisees
DROP POLICY IF EXISTS "Users can view their own stock" ON public.stock_config;

-- Create new SELECT policy: users can view stock for machines they own
CREATE POLICY "Users can view stock for their machines"
ON public.stock_config
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.maquinas
    WHERE maquinas.mac_address = stock_config.machine_imei
    AND maquinas.usuario_id = auth.uid()
  )
);

-- Drop old UPDATE policy
DROP POLICY IF EXISTS "Users can update their own stock" ON public.stock_config;

-- Users can update stock for their own machines
CREATE POLICY "Users can update stock for their machines"
ON public.stock_config
FOR UPDATE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.maquinas
    WHERE maquinas.mac_address = stock_config.machine_imei
    AND maquinas.usuario_id = auth.uid()
  )
);

-- Drop old INSERT policy  
DROP POLICY IF EXISTS "Users can insert their own stock" ON public.stock_config;

-- Users can insert stock for their own machines
CREATE POLICY "Users can insert stock for their machines"
ON public.stock_config
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.maquinas
    WHERE maquinas.mac_address = stock_config.machine_imei
    AND maquinas.usuario_id = auth.uid()
  )
);
