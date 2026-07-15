
DROP POLICY IF EXISTS "Users can view active conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Staff and users can update conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can create conversations" ON public.chat_conversations;

CREATE POLICY "Staff can view all conversations"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'agente')
);

CREATE POLICY "Staff can update conversations"
ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'agente')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'agente')
);

CREATE POLICY "Anyone can create conversation with safe fields"
ON public.chat_conversations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status IN ('active','needs_help')
  AND agent_notes IS NULL
  AND assigned_to IS NULL
  AND human_requested_at IS NULL
  AND ai_enabled IS NOT FALSE
  AND user_ip IS NULL
);

CREATE OR REPLACE FUNCTION public.get_chat_conversation_state(p_id uuid)
RETURNS TABLE (
  id uuid,
  status text,
  ai_enabled boolean,
  session_id text,
  external_user_id text,
  human_requested_at timestamptz,
  total_messages integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.status, c.ai_enabled, c.session_id, c.external_user_id,
         c.human_requested_at, c.total_messages
  FROM public.chat_conversations c
  WHERE c.id = p_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.find_active_conversation_by_external_user(p_external_user_id text)
RETURNS TABLE (
  id uuid,
  status text,
  ai_enabled boolean,
  session_id text,
  external_user_id text,
  human_requested_at timestamptz,
  total_messages integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.status, c.ai_enabled, c.session_id, c.external_user_id,
         c.human_requested_at, c.total_messages
  FROM public.chat_conversations c
  WHERE c.external_user_id = p_external_user_id
    AND c.status IN ('active','needs_help','in_progress')
  ORDER BY c.started_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.chat_conversation_bump_activity(p_id uuid, p_total integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.chat_conversations
     SET total_messages = GREATEST(COALESCE(total_messages,0), p_total),
         status = CASE WHEN status IN ('closed','finished','inactive') THEN status ELSE 'active' END
   WHERE id = p_id
     AND status NOT IN ('closed');
$$;

CREATE OR REPLACE FUNCTION public.chat_conversation_request_human(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.chat_conversations
     SET status = 'needs_help',
         human_requested_at = now(),
         tags = COALESCE(tags, ARRAY[]::text[]) || ARRAY['humano_solicitado']
   WHERE id = p_id
     AND status NOT IN ('closed');
$$;

CREATE OR REPLACE FUNCTION public.chat_conversation_finish(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.chat_conversations
     SET status = 'finished',
         ended_at = now()
   WHERE id = p_id
     AND status NOT IN ('needs_help','in_progress','closed');
$$;

CREATE OR REPLACE FUNCTION public.chat_conversation_mark_inactive(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.chat_conversations
     SET status = 'inactive'
   WHERE id = p_id
     AND status NOT IN ('needs_help','in_progress','closed','finished');
$$;

REVOKE ALL ON FUNCTION public.get_chat_conversation_state(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_active_conversation_by_external_user(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_conversation_bump_activity(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_conversation_request_human(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_conversation_finish(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_conversation_mark_inactive(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_chat_conversation_state(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_active_conversation_by_external_user(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_conversation_bump_activity(uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_conversation_request_human(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_conversation_finish(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_conversation_mark_inactive(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can create messages" ON public.chat_messages;

CREATE POLICY "Anyone can create messages in open conversations"
ON public.chat_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  conversation_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = conversation_id
      AND c.status IN ('active','needs_help','in_progress')
  )
);

DROP POLICY IF EXISTS "Staff can insert insights" ON public.conversation_insights;

DROP POLICY IF EXISTS "Admins podem editar roles" ON public.user_roles;

CREATE POLICY "Only admins can update user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND user_id <> auth.uid()
);

CREATE POLICY "Only admins can insert user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_categorize_conversation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.extract_conversation_tags(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.categorize_conversation(text) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view manuals" ON storage.objects;
DROP POLICY IF EXISTS "Imagens dos manuais são públicas" ON storage.objects;

CREATE POLICY "Staff can list manuals"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'manuals'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'agente')
  )
);
