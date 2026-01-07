-- Drop the dangerous policy that allows unrestricted updates
DROP POLICY IF EXISTS "Agentes podem atualizar conversas" ON chat_conversations;

-- Create role-based policy for staff updates
CREATE POLICY "Staff can update conversations"
ON chat_conversations
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'agente'::app_role)
);