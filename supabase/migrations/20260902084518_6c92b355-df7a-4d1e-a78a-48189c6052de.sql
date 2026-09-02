
UPDATE public.stock_config SET unidades_actuales = v.val
FROM (VALUES ('1',80),('2',59),('3',63),('4',65),('5',39),('6',40),('7',36)) AS v(pos,val)
WHERE machine_imei = '865622072045888' AND topping_position = v.pos;

CREATE OR REPLACE FUNCTION public.clamp_stock_units()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.capacidad_maxima IS NOT NULL AND NEW.unidades_actuales > NEW.capacidad_maxima THEN
    NEW.unidades_actuales := NEW.capacidad_maxima;
  END IF;
  IF NEW.unidades_actuales < 0 THEN
    NEW.unidades_actuales := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clamp_stock_units ON public.stock_config;
CREATE TRIGGER trg_clamp_stock_units
BEFORE INSERT OR UPDATE ON public.stock_config
FOR EACH ROW EXECUTE FUNCTION public.clamp_stock_units();
