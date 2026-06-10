
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DROP TRIGGER IF EXISTS trigger_notify_new_sale ON public.ventas_historico;
CREATE TRIGGER trigger_notify_new_sale
AFTER INSERT ON public.ventas_historico
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_sale();
