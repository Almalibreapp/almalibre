-- Módulos del curso
CREATE TABLE public.academy_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  video_url text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  duracion_segundos integer,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.academy_modulos TO authenticated;
GRANT ALL ON public.academy_modulos TO service_role;

ALTER TABLE public.academy_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active modules"
  ON public.academy_modulos FOR SELECT
  TO authenticated
  USING (activo = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage modules"
  ON public.academy_modulos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_academy_modulos_updated
  BEFORE UPDATE ON public.academy_modulos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Progreso del usuario por módulo
CREATE TABLE public.academy_progreso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  modulo_id uuid NOT NULL REFERENCES public.academy_modulos(id) ON DELETE CASCADE,
  segundos_vistos integer NOT NULL DEFAULT 0,
  completado boolean NOT NULL DEFAULT false,
  completado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, modulo_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_progreso TO authenticated;
GRANT ALL ON public.academy_progreso TO service_role;

ALTER TABLE public.academy_progreso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own progress"
  ON public.academy_progreso FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own progress"
  ON public.academy_progreso FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own progress"
  ON public.academy_progreso FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_academy_progreso_updated
  BEFORE UPDATE ON public.academy_progreso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Consentimiento firmado
CREATE TABLE public.academy_consentimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  firma_nombre text NOT NULL,
  texto_consentimiento text NOT NULL,
  aceptado_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.academy_consentimiento TO authenticated;
GRANT ALL ON public.academy_consentimiento TO service_role;

ALTER TABLE public.academy_consentimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own consent"
  ON public.academy_consentimiento FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users sign own consent"
  ON public.academy_consentimiento FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);