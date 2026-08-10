ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS gateway_run_id text,
  ADD COLUMN IF NOT EXISTS cost_credits numeric(12,6),
  ADD COLUMN IF NOT EXISTS cost_brl numeric(12,6),
  ADD COLUMN IF NOT EXISTS cost_source text DEFAULT 'estimated';

-- Índice útil para cruzar logs do gateway com a tabela
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_gateway_run_id
  ON public.ai_usage_logs(gateway_run_id);

-- Garantir que service_role possa usar as novas colunas (já tem ALL, mas reforçar)
GRANT ALL ON public.ai_usage_logs TO service_role;

-- Política já existe apenas para SELECT de admins; nenhuma mudança necessária