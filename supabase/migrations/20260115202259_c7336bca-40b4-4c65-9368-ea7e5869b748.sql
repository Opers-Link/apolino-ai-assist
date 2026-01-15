-- Deletar conversas vazias (sem mensagens)
DELETE FROM chat_conversations 
WHERE total_messages = 0 OR total_messages IS NULL;