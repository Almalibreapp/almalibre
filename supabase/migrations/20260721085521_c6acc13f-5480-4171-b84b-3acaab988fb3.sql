
-- Convert to SECURITY INVOKER: authenticated users already have SELECT on pedidos/incidencias via RLS policies
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
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
SECURITY INVOKER
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
