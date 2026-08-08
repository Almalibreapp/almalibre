CREATE OR REPLACE FUNCTION public.get_soporte_perfiles()
RETURNS TABLE (nombre text, apellidos text, cargo text, foto_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.nombre, p.apellidos, p.cargo, p.foto_url
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'
$$;

REVOKE ALL ON FUNCTION public.get_soporte_perfiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_soporte_perfiles() TO authenticated;