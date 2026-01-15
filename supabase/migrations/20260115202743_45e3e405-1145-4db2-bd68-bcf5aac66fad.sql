-- Encerrar conversas antigas que não tiveram solicitação de atendimento humano
-- e estão ativas/inativas há mais de 24 horas
UPDATE chat_conversations 
SET 
  status = 'closed',
  ended_at = COALESCE(ended_at, NOW()),
  resolved_at = NOW()
WHERE 
  status IN ('active', 'inactive', 'finished')
  AND human_requested_at IS NULL
  AND assigned_to IS NULL
  AND started_at < NOW() - INTERVAL '24 hours';