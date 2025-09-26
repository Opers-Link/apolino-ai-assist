-- Corrigir migração: Adicionar categorias e tags às conversas
-- Primeiro, remover a coluna category problemática se existir
ALTER TABLE public.chat_conversations DROP COLUMN IF EXISTS category;
ALTER TABLE public.chat_conversations DROP COLUMN IF EXISTS tags;
ALTER TABLE public.chat_conversations DROP COLUMN IF EXISTS sentiment;

-- Criar tipos enum para melhor tipagem
DROP TYPE IF EXISTS conversation_category CASCADE;
DROP TYPE IF EXISTS conversation_sentiment CASCADE;

CREATE TYPE conversation_category AS ENUM ('usabilidade', 'procedimentos', 'marketing', 'vendas', 'outros');
CREATE TYPE conversation_sentiment AS ENUM ('positivo', 'neutro', 'negativo');

-- Adicionar colunas com os tipos corretos
ALTER TABLE public.chat_conversations 
ADD COLUMN category conversation_category DEFAULT 'outros',
ADD COLUMN tags TEXT[] DEFAULT '{}',
ADD COLUMN sentiment conversation_sentiment DEFAULT 'neutro';

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_category ON public.chat_conversations(category);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_tags ON public.chat_conversations USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_sentiment ON public.chat_conversations(sentiment);

-- Adicionar função para categorizar automaticamente conversas baseado no conteúdo
CREATE OR REPLACE FUNCTION public.categorize_conversation(conversation_messages TEXT)
RETURNS conversation_category
LANGUAGE plpgsql
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

-- Criar função para extrair tags baseadas no conteúdo
CREATE OR REPLACE FUNCTION public.extract_conversation_tags(conversation_messages TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
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

-- Adicionar trigger para categorizar automaticamente novas conversas
CREATE OR REPLACE FUNCTION public.auto_categorize_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Criar trigger que executa quando a conversa é finalizada
DROP TRIGGER IF EXISTS trigger_auto_categorize_conversation ON public.chat_conversations;
CREATE TRIGGER trigger_auto_categorize_conversation
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  WHEN (OLD.status = 'active' AND NEW.status = 'completed')
  EXECUTE FUNCTION public.auto_categorize_conversation();