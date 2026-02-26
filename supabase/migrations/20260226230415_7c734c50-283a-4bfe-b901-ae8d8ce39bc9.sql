
-- Create a function that calls the notify-new-sale edge function via pg_net
CREATE OR REPLACE FUNCTION public.notify_new_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url text;
  anon_key text;
  payload jsonb;
BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);
  anon_key := current_setting('app.settings.supabase_anon_key', true);

  payload := jsonb_build_object(
    'record', jsonb_build_object(
      'producto', NEW.producto,
      'precio', NEW.precio,
      'metodo_pago', NEW.metodo_pago,
      'hora', NEW.hora,
      'fecha', NEW.fecha,
      'imei', NEW.imei,
      'cantidad_unidades', NEW.cantidad_unidades,
      'toppings', NEW.toppings
    )
  );

  PERFORM net.http_post(
    url := 'https://lwruwpwdrkmtgcapnbzc.supabase.co/functions/v1/notify-new-sale',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cnV3cHdkcmttdGdjYXBuYnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODE3MTEsImV4cCI6MjA4MTM1NzcxMX0.h-EOEzvaKc0I_xWhxXB3ydy1v7OPSfRxKpehjWbbx5s'
    ),
    body := payload
  );

  RETURN NEW;
END;
$function$;

-- Create the trigger on ventas_historico
CREATE TRIGGER on_new_sale_notify
  AFTER INSERT ON public.ventas_historico
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_sale();
