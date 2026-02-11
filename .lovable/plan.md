

# Alterar modelo de IA para OpenAI GPT-5 Nano

## Resumo
Trocar o modelo utilizado no chat de `google/gemini-2.5-flash` para `openai/gpt-5-nano` em todas as ocorrencias na edge function `chat-with-ai`.

## Alteracoes

### Arquivo: `supabase/functions/chat-with-ai/index.ts`

Substituir **4 ocorrencias** de `google/gemini-2.5-flash` por `openai/gpt-5-nano`:

1. **Linha 208** - Chamada principal ao gateway (streaming do chat)
2. **Linha 236** - Log de uso no `ai_usage_logs` (caso de sucesso)
3. **Linha 264** - Log de uso no `ai_usage_logs` (caso de erro)
4. **Linha 416** - Chamada de classificacao automatica de conversas

### Deploy

Apos as alteracoes, a edge function `chat-with-ai` sera re-deployada automaticamente.

## Secao Tecnica

- Nenhuma alteracao de infraestrutura necessaria - o Lovable AI Gateway ja suporta modelos OpenAI nativamente
- O `openai/gpt-5-nano` e o modelo mais rapido e economico da linha OpenAI, ideal para tarefas de alto volume
- A `LOVABLE_API_KEY` ja configurada funciona para ambos os provedores

