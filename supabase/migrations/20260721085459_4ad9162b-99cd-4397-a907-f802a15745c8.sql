
-- 1. Storage: remove public read; keep uploader read; add admin read
DROP POLICY IF EXISTS "Public can view incident photos" ON storage.objects;

DROP POLICY IF EXISTS "Admins can view all incident photos" ON storage.objects;
CREATE POLICY "Admins can view all incident photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'incident-photos'
  AND public.has_role(auth.uid(), 'admin')
);

-- 2. cupones_cache: admin-only reads
DROP POLICY IF EXISTS "Allow all authenticated users to read cupones_cache" ON public.cupones_cache;

DROP POLICY IF EXISTS "Admins can read cupones_cache" ON public.cupones_cache;
CREATE POLICY "Admins can read cupones_cache"
ON public.cupones_cache FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Race-condition-free ticket/order number generation via advisory lock
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_number TEXT;
  year_part TEXT;
  seq_number INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('generate_order_number'));
  year_part := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_pedido FROM 10) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.pedidos
  WHERE numero_pedido LIKE 'ALM-' || year_part || '-%';
  new_number := 'ALM-' || year_part || '-' || LPAD(seq_number::TEXT, 4, '0');
  RETURN new_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_number TEXT;
  year_part TEXT;
  seq_number INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('generate_ticket_number'));
  year_part := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_ticket FROM 10) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.incidencias
  WHERE numero_ticket LIKE 'INC-' || year_part || '-%';
  new_number := 'INC-' || year_part || '-' || LPAD(seq_number::TEXT, 4, '0');
  RETURN new_number;
END;
$function$;

-- 4. Restrict EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_sale() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_ticket_number() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_ticket_number() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
