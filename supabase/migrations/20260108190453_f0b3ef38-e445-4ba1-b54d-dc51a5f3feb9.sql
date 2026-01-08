-- Fix: Permitir usuarios anonimos verem suas conversas ativas
-- Isso e necessario porque o frontend faz .insert().select() e precisa ler o registro

-- Adicionar politica SELECT para usuarios anonimos verem conversas ativas
CREATE POLICY "Users can view active conversations"
ON chat_conversations
FOR SELECT
USING (
  -- Staff podem ver todas
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'agente'::app_role) OR
  -- Usuarios anonimos podem ver conversas ativas (nao finalizadas)
  status IN ('active', 'needs_help', 'in_progress')
);