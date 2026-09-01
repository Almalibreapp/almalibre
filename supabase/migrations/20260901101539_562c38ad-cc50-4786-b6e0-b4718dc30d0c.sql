CREATE UNIQUE INDEX IF NOT EXISTS ventas_historico_imei_numero_orden_key
ON public.ventas_historico (imei, numero_orden)
WHERE numero_orden IS NOT NULL;