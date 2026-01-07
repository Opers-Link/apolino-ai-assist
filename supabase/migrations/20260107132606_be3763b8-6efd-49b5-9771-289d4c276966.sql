-- Create table for storing AI-generated conversation insights
CREATE TABLE public.conversation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  insights_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by TEXT DEFAULT 'system',
  conversation_count INTEGER,
  message_count INTEGER
);

-- Enable RLS
ALTER TABLE public.conversation_insights ENABLE ROW LEVEL SECURITY;

-- Only admins can view insights
CREATE POLICY "Admins can view insights"
ON public.conversation_insights
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System/edge function can insert insights
CREATE POLICY "System can insert insights"
ON public.conversation_insights
FOR INSERT
WITH CHECK (true);

-- Admins can delete old insights
CREATE POLICY "Admins can delete insights"
ON public.conversation_insights
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for efficient queries by period
CREATE INDEX idx_insights_period ON public.conversation_insights (period_start, period_end);
CREATE INDEX idx_insights_generated_at ON public.conversation_insights (generated_at DESC);