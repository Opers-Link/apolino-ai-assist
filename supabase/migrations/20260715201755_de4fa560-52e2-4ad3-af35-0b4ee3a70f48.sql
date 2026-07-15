
CREATE TABLE public.user_refinement_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion TEXT NOT NULL CHECK (char_length(suggestion) BETWEEN 5 AND 2000),
  context TEXT,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  external_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  promoted_refinement_id UUID REFERENCES public.prompt_refinements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.user_refinement_suggestions TO anon;
GRANT INSERT ON public.user_refinement_suggestions TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.user_refinement_suggestions TO authenticated;
GRANT ALL ON public.user_refinement_suggestions TO service_role;

ALTER TABLE public.user_refinement_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit suggestions"
ON public.user_refinement_suggestions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND promoted_refinement_id IS NULL
);

CREATE POLICY "Admins can view suggestions"
ON public.user_refinement_suggestions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update suggestions"
ON public.user_refinement_suggestions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete suggestions"
ON public.user_refinement_suggestions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_user_refinement_suggestions_status ON public.user_refinement_suggestions(status, created_at DESC);

CREATE TRIGGER update_user_refinement_suggestions_updated_at
BEFORE UPDATE ON public.user_refinement_suggestions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
