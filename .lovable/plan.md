

# Diagnostico: Mensagens nao estao sendo salvas

## Problema identificado

Analisei o banco de dados e encontrei que **todas as conversas apos 19/02 (8+ conversas) tem 0 mensagens**, enquanto conversas anteriores tem mensagens normalmente. O problema tem duas causas:

### Causa 1: Falha silenciosa no salvamento de mensagens

A funcao `saveMessage` usa `.insert().select('id').single()`. A politica de SELECT na tabela `chat_messages` **so permite admins**. Quando um usuario anonimo envia uma mensagem:
- O INSERT e executado
- O `.select('id').single()` falha porque o usuario nao tem permissao de SELECT
- O PostgREST pode reverter a operacao nesse cenario, resultando em 0 mensagens salvas
- A funcao retorna `null` silenciosamente

### Causa 2: Bug de duplicacao de conversas

Quando o usuario reinicia uma conversa apos encerramento (`conversationClosed = true`), o codigo cria uma conversa, atualiza o state React (assincrono), mas na sequencia le o state antigo (vazio), criando uma **segunda conversa**. A primeira fica com 0 mensagens.

## Correcoes

### Arquivo: `src/components/chat/AIAssistantPanel.tsx`

**Correcao 1 - `saveMessage`**: Gerar o UUID no cliente via `crypto.randomUUID()` e usar apenas `.insert()` sem `.select().single()`, eliminando a dependencia da politica de SELECT.

**Correcao 2 - `handleSendMessage`**: No bloco `conversationClosed`, atribuir o novo ID diretamente a variavel local `currentConversationId` em vez de depender do state React assincrono, evitando a criacao duplicada.

### Migracao SQL (opcional)

Limpar conversas vazias com 0 mensagens que ficaram orfas no banco.

