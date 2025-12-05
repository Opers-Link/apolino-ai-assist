-- Tabela para tracking de requisições de IA
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Métricas de tokens (se disponíveis na resposta da API)
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  
  -- Contexto
  model TEXT DEFAULT 'google/gemini-2.5-flash',
  has_knowledge_modules BOOLEAN DEFAULT false,
  
  -- Status
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- Habilitar RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Admins podem visualizar os logs
CREATE POLICY "Admins can view ai usage logs"
  ON ai_usage_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Edge function pode inserir logs (sem autenticação)
CREATE POLICY "Edge function can insert ai usage logs"
  ON ai_usage_logs FOR INSERT
  WITH CHECK (true);

-- Índice para consultas por período
CREATE INDEX idx_ai_usage_date ON ai_usage_logs(created_at);