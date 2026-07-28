
CREATE OR REPLACE FUNCTION public.deduct_stock_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_topping jsonb;
  v_pos text;
  v_qty int;
  v_units int;
BEGIN
  v_estado := lower(coalesce(NEW.estado, 'exitoso'));
  IF v_estado IN ('fallido','cancelado','failed','cancelled') THEN
    RETURN NEW;
  END IF;

  v_units := COALESCE(NEW.cantidad_unidades, 1);
  IF v_units < 1 THEN v_units := 1; END IF;

  -- Deduct açaí (position 1) once per unit sold
  UPDATE public.stock_config
     SET unidades_actuales = GREATEST(0, unidades_actuales - v_units)
   WHERE machine_imei = NEW.imei
     AND topping_position = '1';

  -- Deduct each topping
  IF NEW.toppings IS NOT NULL AND jsonb_typeof(NEW.toppings) = 'array' THEN
    FOR v_topping IN SELECT * FROM jsonb_array_elements(NEW.toppings)
    LOOP
      v_pos := COALESCE(v_topping->>'posicion', v_topping->>'position');
      v_qty := COALESCE(NULLIF(v_topping->>'cantidad','')::int, 1);
      IF v_pos IS NOT NULL AND v_pos <> '' THEN
        UPDATE public.stock_config
           SET unidades_actuales = GREATEST(0, unidades_actuales - v_qty)
         WHERE machine_imei = NEW.imei
           AND topping_position = v_pos;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_stock_on_sale() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_deduct_stock_on_sale ON public.ventas_historico;
CREATE TRIGGER trg_deduct_stock_on_sale
AFTER INSERT ON public.ventas_historico
FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_sale();
