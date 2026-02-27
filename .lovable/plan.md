

# Otimização de Velocidade do Chat da AIA

## Gargalos Identificados

Analisei o fluxo completo da Edge Function `chat-with-ai` e identifiquei **5 gargalos principais** que estão atrasando a resposta:

### 1. Consultas ao banco de dados sequenciais
A função faz ~6 queries ao Supabase uma após a outra (rate limit, conversa, módulos, arquivos de cada módulo, prompt, FAQ, perfil). Cada query adiciona latência de rede.

### 2. Busca de arquivos dos módulos em loop
Os arquivos de conhecimento são buscados **um módulo por vez** num loop `for`, em vez de uma única query.

### 3. Segunda chamada de IA para classificação
Quando as palavras-chave não identificam o módulo, uma chamada extra ao modelo de IA é feita **antes** da chamada principal — dobrando o tempo de resposta nesses casos.

### 4. Modelo `openai/gpt-5-mini`
Apesar de ser bom, existem modelos mais rápidos disponíveis no gateway (ex: `google/gemini-2.5-flash` ou `google/gemini-3-flash-preview`).

### 5. Contexto de financiamento carregado sempre que detectado
Mesmo que não seja necessário, o contexto de taxas bancárias é buscado e injetado no prompt.

---

## Correções Propostas

### Arquivo: `supabase/functions/chat-with-ai/index.ts`

**A. Paralelizar queries ao banco** — Executar rate limit check, conversation check, knowledge modules, system prompt e FAQ em paralelo com `Promise.all` em vez de sequencialmente. Estimativa: **-200~400ms**.

**B. Query única para arquivos de módulos** — Substituir o loop que busca arquivos módulo a módulo por uma única query com join ou busca geral de `knowledge_module_files`. Estimativa: **-100~300ms**.

**C. Eliminar classificação por IA** — Quando palavras-chave não encontram módulos, em vez de fazer uma segunda chamada de IA (que custa ~1-3s), usar o fallback `none` diretamente (GPT responde com conhecimento próprio). Estimativa: **-1~3s nos casos afetados**.

**D. Trocar modelo para `google/gemini-3-flash-preview`** — Modelo mais rápido com qualidade comparável para este caso de uso (assistente de suporte). Estimativa: **-500ms~1s** no tempo de primeira resposta (TTFB).

**E. Adicionar `temperature: 0.7` e `max_tokens: 1500`** — Limitar o tamanho da resposta para acelerar a geração e evitar respostas excessivamente longas.

---

## Resumo do Impacto Esperado

| Otimização | Ganho estimado |
|---|---|
| Paralelizar queries DB | 200-400ms |
| Query única para arquivos | 100-300ms |
| Remover classificação IA | 1-3s (em ~30% dos casos) |
| Modelo mais rápido | 500ms-1s |
| Limitar tokens | 200-500ms |
| **Total** | **~1-4 segundos mais rápido** |

