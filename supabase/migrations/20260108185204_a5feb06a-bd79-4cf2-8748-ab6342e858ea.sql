-- Fix RLS policy for chat_conversations to allow anonymous users to update their conversations

-- First, drop the restrictive policy
DROP POLICY IF EXISTS "Staff can update conversations" ON chat_conversations;

-- Create a new policy that allows:
-- 1. Staff (admin, gerente, agente) to update any conversation
-- 2. Anyone to update active/needs_help/in_progress conversations (for the public chat)
CREATE POLICY "Staff and users can update conversations"
ON chat_conversations
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'agente'::app_role) OR
  status IN ('active', 'needs_help', 'in_progress')
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'agente'::app_role) OR
  status IN ('active', 'needs_help', 'in_progress', 'inactive', 'finished', 'closed')
);