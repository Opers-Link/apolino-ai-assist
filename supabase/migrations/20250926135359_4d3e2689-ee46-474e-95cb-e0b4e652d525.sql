-- Corrigir warnings de segurança: adicionar search_path às funções

-- Função 1: categorize_conversation
CREATE OR REPLACE FUNCTION public.categorize_conversation(conversation_messages TEXT)
RETURNS conversation_category
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  category conversation_category := 'outros';
  content_lower TEXT;
BEGIN
  content_lower := lower(conversation_messages);
  
  -- Regras simples de categorização baseadas em palavras-chave
  IF content_lower ~ '(login|senha|erro|bug|sistema|funciona|problema técnico|não carrega)' THEN
    category := 'usabilidade';
  ELSIF content_lower ~ '(como fazer|processo|procedimento|passo a passo|documentação|política)' THEN
    category := 'procedimentos';
  ELSIF content_lower ~ '(marketing|propaganda|divulgação|campanha|anúncio|publicidade)' THEN
    category := 'marketing';
  ELSIF content_lower ~ '(venda|compra|preço|valor|proposta|negociação|cliente|contrato)' THEN
    category := 'vendas';
  END IF;
  
  RETURN category;
END;
$$;

-- Função 2: extract_conversation_tags
CREATE OR REPLACE FUNCTION public.extract_conversation_tags(conversation_messages TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tags TEXT[] := '{}';
  content_lower TEXT;
BEGIN
  content_lower := lower(conversation_messages);
  
  -- Tags relacionadas a problemas técnicos
  IF content_lower ~ '(login|senha)' THEN
    tags := array_append(tags, 'autenticação');
  END IF;
  
  IF content_lower ~ '(erro|bug|problema)' THEN
    tags := array_append(tags, 'erro-sistema');
  END IF;
  
  IF content_lower ~ '(lento|demora|carregando)' THEN
    tags := array_append(tags, 'performance');
  END IF;
  
  -- Tags relacionadas a processos
  IF content_lower ~ '(como|tutorial|ajuda)' THEN
    tags := array_append(tags, 'dúvida');
  END IF;
  
  IF content_lower ~ '(documentação|manual)' THEN
    tags := array_append(tags, 'documentação');
  END IF;
  
  -- Tags relacionadas a vendas
  IF content_lower ~ '(preço|custo|valor)' THEN
    tags := array_append(tags, 'preço');
  END IF;
  
  IF content_lower ~ '(contrato|acordo)' THEN
    tags := array_append(tags, 'contrato');
  END IF;
  
  -- Se não encontrou nenhuma tag específica, adiciona uma tag genérica
  IF array_length(tags, 1) IS NULL THEN
    tags := array_append(tags, 'geral');
  END IF;
  
  RETURN tags;
END;
$$;

-- Função 3: auto_categorize_conversation
CREATE OR REPLACE FUNCTION public.auto_categorize_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  messages_content TEXT;
BEGIN
  -- Buscar o conteúdo das mensagens da conversa
  SELECT string_agg(content, ' ') INTO messages_content
  FROM public.chat_messages 
  WHERE conversation_id = NEW.id;
  
  -- Se há mensagens, categorizar e extrair tags
  IF messages_content IS NOT NULL THEN
    NEW.category := public.categorize_conversation(messages_content);
    NEW.tags := public.extract_conversation_tags(messages_content);
  END IF;
  
  RETURN NEW;
END;
$$;