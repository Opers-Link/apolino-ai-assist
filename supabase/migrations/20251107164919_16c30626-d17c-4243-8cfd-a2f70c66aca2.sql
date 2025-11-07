-- Habilitar realtime para a tabela chat_messages
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;