CREATE POLICY "Clientes pueden subir fotos de incidencias"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'incidencias-clientes');

CREATE POLICY "Fotos de incidencias legibles para firmar enlaces"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'incidencias-clientes');