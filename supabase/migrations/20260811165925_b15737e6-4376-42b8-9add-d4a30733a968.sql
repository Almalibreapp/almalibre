-- 1. incidencias-clientes bucket: remove open anon/authenticated access
DROP POLICY IF EXISTS "Clientes pueden subir fotos de incidencias" ON storage.objects;
DROP POLICY IF EXISTS "Fotos de incidencias legibles para firmar enlaces" ON storage.objects;

DROP POLICY IF EXISTS "Admins pueden ver fotos de incidencias de clientes" ON storage.objects;
CREATE POLICY "Admins pueden ver fotos de incidencias de clientes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'incidencias-clientes' AND public.has_role(auth.uid(), 'admin'));

-- 2. SECURITY DEFINER functions: revoke public execution
REVOKE EXECUTE ON FUNCTION public.deduct_stock_on_sale() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_sale() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_ticket_number() FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_soporte_perfiles() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_soporte_perfiles() TO authenticated;

-- has_role is used inside RLS policies and must stay executable by signed-in users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;