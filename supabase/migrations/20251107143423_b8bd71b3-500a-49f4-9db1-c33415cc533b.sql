-- Add agent_notes column to chat_conversations
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS agent_notes TEXT;

COMMENT ON COLUMN chat_conversations.agent_notes IS 'Notas internas do agente sobre a conversa - não são enviadas ao usuário';