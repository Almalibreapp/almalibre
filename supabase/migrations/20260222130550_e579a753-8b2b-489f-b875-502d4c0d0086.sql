
-- Fix overly permissive policy on ventas_sync_log
DROP POLICY "Service role can manage sync logs" ON public.ventas_sync_log;
