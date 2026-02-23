-- Remove the unique constraint on mac_address alone
ALTER TABLE public.maquinas DROP CONSTRAINT IF EXISTS maquinas_mac_address_key;

-- Add a composite unique constraint so the same IMEI can belong to different users
ALTER TABLE public.maquinas ADD CONSTRAINT maquinas_mac_address_usuario_unique UNIQUE (mac_address, usuario_id);