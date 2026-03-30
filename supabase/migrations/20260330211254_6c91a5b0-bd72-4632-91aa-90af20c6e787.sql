
CREATE TABLE public.prompt_refinements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction TEXT NOT NULL,
  category TEXT DEFAULT 'correção',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  module_hint TEXT
);

ALTER TABLE public.prompt_refinements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage refinements" ON public.prompt_refinements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_prompt_refinements_active ON public.prompt_refinements(is_active, priority DESC) WHERE is_active = true;
