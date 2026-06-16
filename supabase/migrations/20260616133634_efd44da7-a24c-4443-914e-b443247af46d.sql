-- Insert default notification preferences for machine owners who don't have any
INSERT INTO public.preferencias_notificaciones (
  usuario_id, nuevas_ventas, temperatura_alerta, stock_bajo, 
  pedidos, incidencias, promociones, canal_push, canal_email, umbral_stock
)
SELECT DISTINCT 
  m.usuario_id,
  true,
  true,
  true,
  true,
  true,
  false,
  true,
  true,
  25
FROM public.maquinas m
LEFT JOIN public.preferencias_notificaciones p ON p.usuario_id = m.usuario_id
WHERE m.usuario_id IS NOT NULL
  AND p.usuario_id IS NULL;

-- Ensure trigger function always sends to users without explicit preference rows
-- (This is already handled in code, but let's make it explicit in DB too)
-- The existing logic: users without preference rows are NOT in the disabled set,
-- so they receive notifications. This is correct behavior.