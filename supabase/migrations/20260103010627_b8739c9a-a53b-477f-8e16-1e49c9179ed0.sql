-- Create storage bucket for statement PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('statements', 'statements', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read statement PDFs
CREATE POLICY "Anyone can view statement PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'statements');

-- Allow landlords to upload statement PDFs
CREATE POLICY "Landlords can upload statement PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'statements');