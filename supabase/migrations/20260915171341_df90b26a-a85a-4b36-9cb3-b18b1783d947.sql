DROP TABLE IF EXISTS public.incidencia_mensajes;
DROP TABLE IF EXISTS public.incidencias;
DROP FUNCTION IF EXISTS public.generate_ticket_number();
ALTER TABLE public.preferencias_notificaciones DROP COLUMN IF EXISTS incidencias;