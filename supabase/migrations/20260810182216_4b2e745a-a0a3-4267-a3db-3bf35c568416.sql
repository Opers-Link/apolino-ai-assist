ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS gateway_log_id text;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_gateway_log_id
  ON public.ai_usage_logs(gateway_log_id);

GRANT ALL ON public.ai_usage_logs TO service_role;