
# Implementar Streaming de Respostas no Chat

## Resumo
Ativar streaming SSE para que as respostas da IA aparecam progressivamente no chat (efeito de digitacao em tempo real), em vez de esperar a resposta completa.

## Alteracoes

### 1. Edge Function: `supabase/functions/chat-with-ai/index.ts`

**Linhas 201-263** - Substituir a chamada sincrona por streaming:

- Adicionar `stream: true` no body da requisicao ao Lovable AI Gateway (linha 209)
- Remover `await response.json()` e parsing da resposta completa
- Tratar erros 429/402 retornando JSON antes do stream
- Registrar uso no `ai_usage_logs` antes de iniciar o stream (sem contagem exata de tokens, pois streaming nao retorna usage)
- Retornar `response.body` diretamente com header `Content-Type: text/event-stream`

Codigo principal:
```typescript
body: JSON.stringify({
  model: 'google/gemini-2.5-flash',
  messages: fullMessages,
  stream: true,  // NOVO
}),
```

Retorno:
```typescript
return new Response(response.body, {
  headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
});
```

### 2. Frontend: `src/components/chat/AIAssistantPanel.tsx`

**Linhas 502-549** - Substituir chamada via `openaiService.chatCompletion()` por fetch direto com leitura SSE:

- Fazer fetch direto para a edge function usando `import.meta.env.VITE_SUPABASE_URL`
- Criar mensagem assistant vazia no estado
- Ler stream token por token usando `ReadableStream` reader
- Parsear linhas SSE (data: ...) e extrair `delta.content`
- Atualizar conteudo da mensagem assistant progressivamente via `setMessages`
- Tratar `[DONE]`, CRLF, buffer flush, e erros de JSON parcial
- Salvar mensagem completa no banco apenas apos stream finalizar

Fluxo:
1. Usuario envia mensagem
2. Mensagem assistant vazia aparece
3. Tokens chegam e preenchem a mensagem progressivamente
4. Ao finalizar, `saveMessage()` persiste a resposta completa

### 3. Impacto no `src/services/openai.ts`

O servico `openaiService` nao sera mais chamado para o chat (o streaming e feito diretamente no componente). O arquivo permanece no projeto para compatibilidade futura.

## Arquivos modificados
1. `supabase/functions/chat-with-ai/index.ts` - Ativar streaming e retornar SSE
2. `src/components/chat/AIAssistantPanel.tsx` - Implementar leitura SSE com renderizacao progressiva
