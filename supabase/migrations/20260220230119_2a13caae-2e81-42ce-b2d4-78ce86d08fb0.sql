-- Create table for user saved addresses
CREATE TABLE public.direcciones_guardadas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid NOT NULL,
  nombre text NOT NULL DEFAULT 'Mi dirección',
  nombre_contacto text NOT NULL DEFAULT '',
  apellidos_contacto text NOT NULL DEFAULT '',
  email_contacto text NOT NULL DEFAULT '',
  telefono_contacto text NOT NULL DEFAULT '',
  address_1 text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  postcode text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'ES',
  es_favorita boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.direcciones_guardadas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own addresses"
  ON public.direcciones_guardadas FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert their own addresses"
  ON public.direcciones_guardadas FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update their own addresses"
  ON public.direcciones_guardadas FOR UPDATE
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can delete their own addresses"
  ON public.direcciones_guardadas FOR DELETE
  USING (auth.uid() = usuario_id);

-- Trigger for updated_at
CREATE TRIGGER update_direcciones_guardadas_updated_at
  BEFORE UPDATE ON public.direcciones_guardadas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
