-- Fix security warnings for generate_order_number and generate_ticket_number functions
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  seq_number INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_pedido FROM 10) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.pedidos
  WHERE numero_pedido LIKE 'ALM-' || year_part || '-%';
  new_number := 'ALM-' || year_part || '-' || LPAD(seq_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  seq_number INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_ticket FROM 10) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.incidencias
  WHERE numero_ticket LIKE 'INC-' || year_part || '-%';
  new_number := 'INC-' || year_part || '-' || LPAD(seq_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$;