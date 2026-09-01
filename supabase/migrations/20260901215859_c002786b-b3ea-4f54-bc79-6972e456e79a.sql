UPDATE public.ventas_historico v
SET fecha = ((v.fecha + v.hora::time) - interval '6 hours')::date,
    hora  = to_char(((v.fecha + v.hora::time) - interval '6 hours'), 'HH24:MI')
WHERE v.imei = '861648087071696'
  AND v.fecha BETWEEN '2026-08-01' AND '2026-09-01'
  AND v.numero_orden = v.venta_api_id
  AND v.numero_orden ~ '^861648087071696[0-9]+$';