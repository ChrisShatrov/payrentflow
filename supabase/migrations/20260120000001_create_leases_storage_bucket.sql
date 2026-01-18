-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('leases', 'leases', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload leases" ON storage.objects;
DROP POLICY IF EXISTS "Users can download leases" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage leases" ON storage.objects;

-- Allow authenticated users to upload leases
CREATE POLICY "Users can upload leases"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'leases');

-- Allow authenticated users to download leases
CREATE POLICY "Users can download leases"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'leases');

-- Allow service role to manage all leases (for Edge Functions)
CREATE POLICY "Service role can manage leases"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'leases')
WITH CHECK (bucket_id = 'leases');
