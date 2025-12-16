-- Create storage bucket for incident photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-photos', 'incident-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload photos
CREATE POLICY "Users can upload incident photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'incident-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own photos
CREATE POLICY "Users can view their incident photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'incident-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access for incident photos (so support can see them)
CREATE POLICY "Public can view incident photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'incident-photos');