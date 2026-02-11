

# Alterar modelo de IA para OpenAI GPT-5 Mini

## Resumo
Trocar o modelo de `openai/gpt-5-nano` para `openai/gpt-5-mini` em todas as 4 ocorrencias na edge function `chat-with-ai`. O GPT-5 Mini oferece melhor equilíbrio entre qualidade e custo, com respostas mais elaboradas e simpáticas.

## Alteracoes

### Arquivo: `supabase/functions/chat-with-ai/index.ts`

Substituir **4 ocorrencias** de `openai/gpt-5-nano` por `openai/gpt-5-mini`:

1. **Linha 208** - Chamada principal ao gateway (streaming do chat)
2. **Linha 236** - Log de uso no `ai_usage_logs` (sucesso)
3. **Linha 264** - Log de uso no `ai_usage_logs` (erro)
4. **Linha 416** - Chamada de classificacao automatica de conversas

### Deploy

A edge function `chat-with-ai` sera re-deployada automaticamente apos as alteracoes.

## Secao Tecnica

- O `openai/gpt-5-mini` e equivalente ao `google/gemini-2.5-flash` em capacidade, mas com o estilo de resposta da OpenAI
- Melhor aderencia a instrucoes longas (master prompt) comparado ao nano
- Custo intermediario entre o nano e o gpt-5 completo

