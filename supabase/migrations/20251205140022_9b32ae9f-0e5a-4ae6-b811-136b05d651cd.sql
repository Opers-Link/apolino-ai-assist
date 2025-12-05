-- Update the manuals bucket to allow larger file uploads (100MB)
UPDATE storage.buckets 
SET file_size_limit = 104857600  -- 100MB in bytes
WHERE id = 'manuals';

-- If the bucket doesn't have a file_size_limit set, let's recreate with proper settings
-- First check if we need to update the bucket configuration
DO $$
BEGIN
  -- Ensure the bucket exists and has the right settings
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'manuals') THEN
    UPDATE storage.buckets 
    SET file_size_limit = 104857600,
        allowed_mime_types = ARRAY['application/pdf']
    WHERE id = 'manuals';
  END IF;
END $$;