-- Criar bucket público para armazenar imagens dos manuais
INSERT INTO storage.buckets (id, name, public) 
VALUES ('manuals', 'manuals', true);

-- Políticas de acesso para o bucket manuals
CREATE POLICY "Imagens dos manuais são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'manuals');

CREATE POLICY "Apenas admins podem fazer upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'manuals' 
  AND auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  )
);