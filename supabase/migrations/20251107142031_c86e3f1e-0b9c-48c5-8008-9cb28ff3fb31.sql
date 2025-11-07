-- FASE 1: Estrutura do Banco de Dados (continuação)

-- 1.1. Atualizar tabela chat_conversations
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS human_requested_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT true;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS sla_alert_sent BOOLEAN DEFAULT false;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS first_response_time INTEGER; -- tempo em segundos

-- 1.2. Criar tabela user_assignments para histórico de transferências
CREATE TABLE IF NOT EXISTS user_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  assigned_from UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT
);

-- 1.3. Atualizar tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mobile_phone TEXT;

-- 1.4. Habilitar RLS na tabela user_assignments
ALTER TABLE user_assignments ENABLE ROW LEVEL SECURITY;

-- 1.5. Criar políticas RLS para user_assignments
CREATE POLICY "Admins e gerentes podem ver transferências"
ON user_assignments
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'agente'::app_role)
);

CREATE POLICY "Agentes podem criar transferências"
ON user_assignments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'agente'::app_role)
);

-- 1.6. Atualizar política de UPDATE em chat_conversations para permitir agentes
DROP POLICY IF EXISTS "Anyone can update conversations" ON chat_conversations;

CREATE POLICY "Agentes podem atualizar conversas"
ON chat_conversations
FOR UPDATE
USING (
  true
);

-- 1.7. Atualizar política RLS para profiles permitir admin ver todos
CREATE POLICY "Admins podem ver todos os perfis"
ON profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gerente'::app_role) OR
  auth.uid() = user_id
);

-- 1.8. Atualizar política RLS para user_roles permitir admin editar
CREATE POLICY "Admins podem editar roles"
ON user_roles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gerente'::app_role)
);

-- 1.9. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON chat_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_human_requested ON chat_conversations(human_requested_at) WHERE human_requested_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_assignments_conversation ON user_assignments(conversation_id);

-- 1.10. Habilitar realtime para user_assignments e chat_conversations
ALTER TABLE user_assignments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE user_assignments;

ALTER TABLE chat_conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;