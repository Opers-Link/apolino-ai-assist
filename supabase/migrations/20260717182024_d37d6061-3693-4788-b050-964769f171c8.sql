CREATE OR REPLACE FUNCTION public.is_chat_conversation_open(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_conversations
    WHERE id = p_id
      AND status IN ('active','needs_help','in_progress')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_chat_conversation_open(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chat_conversation_open(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can create messages in open conversations" ON public.chat_messages;

CREATE POLICY "Anyone can create messages in open conversations"
ON public.chat_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  conversation_id IS NOT NULL
  AND public.is_chat_conversation_open(conversation_id)
);