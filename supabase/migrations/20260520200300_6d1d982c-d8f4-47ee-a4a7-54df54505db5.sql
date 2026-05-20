
DROP POLICY IF EXISTS "System can insert insights" ON public.conversation_insights;
CREATE POLICY "Staff can insert insights"
ON public.conversation_insights
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
);

DROP POLICY IF EXISTS "Apenas admins podem fazer upload" ON storage.objects;
