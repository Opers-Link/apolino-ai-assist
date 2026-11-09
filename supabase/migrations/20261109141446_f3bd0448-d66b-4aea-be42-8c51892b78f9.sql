CREATE TABLE public.knowledge_gap_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversation_count integer NOT NULL DEFAULT 0,
  flagged_count integer NOT NULL DEFAULT 0,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.knowledge_gap_reports TO authenticated;
GRANT ALL ON public.knowledge_gap_reports TO service_role;
ALTER TABLE public.knowledge_gap_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view gap reports" ON public.knowledge_gap_reports FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "Admins can delete gap reports" ON public.knowledge_gap_reports FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));