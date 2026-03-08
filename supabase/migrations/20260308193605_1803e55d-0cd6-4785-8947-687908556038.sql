
-- Migrate data from topping_X rows to numeric rows, then delete old format
-- topping_1 → 2, topping_2 → 3, ..., topping_6 → 7
UPDATE stock_config dst
SET 
  capacidad_maxima = src.capacidad_maxima,
  unidades_actuales = src.unidades_actuales,
  alerta_minimo = src.alerta_minimo
FROM stock_config src
WHERE src.machine_imei = dst.machine_imei
  AND src.topping_position = 'topping_' || (CAST(dst.topping_position AS integer) - 1)::text
  AND dst.topping_position IN ('2','3','4','5','6','7')
  AND src.topping_position LIKE 'topping_%';

-- Delete old topping_X format rows
DELETE FROM stock_config WHERE topping_position LIKE 'topping_%';
