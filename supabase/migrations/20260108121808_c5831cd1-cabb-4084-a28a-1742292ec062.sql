-- Criar tabela para insights manuais (histórico separado)
CREATE TABLE public.manual_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  source_files JSONB NOT NULL DEFAULT '[]',
  insights_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by UUID,
  file_count INTEGER DEFAULT 0,
  total_records INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.manual_insights ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view manual insights"
  ON public.manual_insights FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerentes can view manual insights"
  ON public.manual_insights FOR SELECT
  USING (has_role(auth.uid(), 'gerente'::app_role));

CREATE POLICY "Admins can insert manual insights"
  ON public.manual_insights FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

CREATE POLICY "Admins can delete manual insights"
  ON public.manual_insights FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Criar bucket para arquivos de insights manuais
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('manual-insights-files', 'manual-insights-files', false, 20971520);

-- Policies para o bucket
CREATE POLICY "Admins can manage manual insights files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'manual-insights-files' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role)))
  WITH CHECK (bucket_id = 'manual-insights-files' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role)));