
# Plano: Corrigir Mensagens Triplicadas no Chat

## Diagnóstico

A análise do banco de dados confirmou que cada mensagem está sendo salva **duas vezes** e depois exibida **três vezes** no frontend:

### Evidência do Banco de Dados
```
message_order 1: "Ola, como eu consigo sair do imóvel?" (19:26:51)
message_order 2: "Ola, como eu consigo sair do imóvel?" (19:26:58) ← DUPLICADO
message_order 2: Resposta da IA (19:26:58.183)  
message_order 3: Resposta da IA (19:26:58.330) ← DUPLICADO
```

### Causa Raiz
A mensagem está sendo salva em **dois lugares diferentes**:

| Local | Arquivo | Linha | O que faz |
|-------|---------|-------|-----------|
| Frontend | `AIAssistantPanel.tsx` | 490 | `saveMessage(userMessage.content, true, ...)` |
| Frontend | `AIAssistantPanel.tsx` | 529 | `saveMessage(botMessage.content, false, ...)` |
| Edge Function | `chat-with-ai/index.ts` | 256 | `saveMessages(supabase, conversationId, userMessage, aiResponse)` |

Além disso, o **Real-time Subscription** (linhas 279-310) detecta os INSERTs no banco e adiciona as mensagens ao estado, causando a terceira exibição.

### Fluxo Atual (Problemático)
```
1. Usuário envia mensagem
2. Frontend adiciona ao estado local ✓
3. Frontend salva no banco (saveMessage) → INSERT #1
4. Edge function salva no banco (saveMessages) → INSERT #2
5. Real-time detecta INSERT e adiciona ao estado → 3ª exibição
```

## Solução Proposta

Remover a duplicação centralizando o salvamento apenas no **frontend** e melhorando a verificação de duplicatas no real-time:

### Alteração 1: Remover `saveMessages()` da Edge Function

**Arquivo:** `supabase/functions/chat-with-ai/index.ts`

Comentar ou remover a chamada na linha 256:
```typescript
// ANTES:
if (conversationId) {
  await saveMessages(supabase, conversationId, messages[messages.length - 1].content, aiResponse);
}

// DEPOIS:
// Mensagens são salvas pelo frontend - não duplicar aqui
// if (conversationId) {
//   await saveMessages(supabase, conversationId, messages[messages.length - 1].content, aiResponse);
// }
```

### Alteração 2: Melhorar verificação de duplicatas no Real-time

**Arquivo:** `src/components/chat/AIAssistantPanel.tsx`

Atualizar o listener de real-time (linhas 300-304) para verificar também pelo conteúdo:
```typescript
// ANTES:
setMessages(prev => {
  const exists = prev.some(m => m.id === message.id);
  if (exists) return prev;
  return [...prev, message];
});

// DEPOIS:
setMessages(prev => {
  // Verificar por ID E por conteúdo similar (evita duplicatas de race condition)
  const exists = prev.some(m => 
    m.id === message.id || 
    (m.content === message.content && !m.isUser && Math.abs(m.timestamp.getTime() - message.timestamp.getTime()) < 5000)
  );
  if (exists) return prev;
  return [...prev, message];
});
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 3 exibições da mesma resposta | 1 exibição única |
| 2 registros no banco por mensagem | 1 registro por mensagem |
| IDs de mensagem conflitantes | IDs únicos e ordenados |

## Seção Técnica

### Arquitetura de Salvamento (Após Correção)

O salvamento de mensagens ficará centralizado no frontend:

1. **Mensagem do usuário**: Salva pelo frontend antes de chamar a Edge Function
2. **Resposta da IA**: Salva pelo frontend após receber a resposta
3. **Real-time**: Apenas para mensagens de agentes humanos (vindas do admin)

### Alternativa Considerada

Poderíamos centralizar no backend (edge function), mas isso exigiria:
- Remover `saveMessage()` do frontend
- Garantir que o frontend espere a resposta para exibir
- Mais complexidade no fluxo

A solução proposta é mais simples e mantém a responsividade do chat.

### Arquivos a Modificar

1. `supabase/functions/chat-with-ai/index.ts` - Remover linha 256
2. `src/components/chat/AIAssistantPanel.tsx` - Melhorar verificação de duplicatas (linhas 300-304)
