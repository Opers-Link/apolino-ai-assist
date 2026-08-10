# Custo de IA com base real no Lovable AI Gateway

## Contexto
Hoje o dashboard mostra um **custo estimado** de IA a partir dos tokens registrados em `ai_usage_logs` e de uma tabela de preços manual em `src/lib/aiPricing.ts` (USD por 1M tokens + câmbio estimado). O usuário quer que o painel reflita o **gasto real na conta Lovable** para este app, usando os dados do Lovable AI Gateway.

## Objetivo
Exibir no dashboard administrativo o custo real de IA do período filtrado, em créditos Lovable e em R$, com base nos logs/custos do gateway, limitado a este app.

## Escopo confirmado
- **Apenas este app**: manter o cálculo restrito ao consumo gerado pelo Apolar AI.
- **Fonte de preços**: dados reais do Lovable AI Gateway (créditos consumidos), não estimativa manual.

## Plano técnico

### 1. Estrutura de dados
- Criar migração para adicionar à tabela `ai_usage_logs`:
  - `gateway_run_id text` — identificador da requisição no gateway.
  - `cost_credits numeric` — créditos Lovable realmente consumidos (quando disponível).
  - `cost_brl numeric` — valor convertido para reais.
  - `cost_source text` — indica se o custo veio do gateway (`gateway`) ou é estimado (`estimated`).

### 2. Captura no edge function `chat-with-ai`
- Garantir que a função já propague e capture o header `X-Lovable-AIG-Run-ID` (conforme padrão atual).
- Verificar se a resposta do gateway inclui headers de custo/créditos; se sim, capturá-los.
- Ao final de cada requisição, gravar em `ai_usage_logs`:
  - tokens (já existe),
  - `gateway_run_id`,
  - `cost_credits` e `cost_brl` quando disponíveis,
  - `cost_source` apropriado.

### 3. Sincronização de custos reais
- Criar edge function `sync-ai-gateway-costs` (acesso restrito a admin/gerente):
  - Recebe um intervalo de datas.
  - Busca os logs de AI Gateway do projeto para o período.
  - Cruza os logs com as linhas de `ai_usage_logs` pelo `gateway_run_id`.
  - Atualiza `cost_credits` e `cost_brl` nas linhas correspondentes.
- Adicionar botão no painel admin para "Sincronizar custos reais do gateway".

### 4. Conversão de créditos para R$
- Adicionar configuração em `knowledge_config` (ou constante comentada) para o valor de 1 crédito Lovable em R$.
- Atualizar `src/lib/aiPricing.ts` para:
  - Ler o valor do crédito.
  - Calcular custo real quando `cost_credits` estiver presente.
  - Manter o cálculo estimado como fallback quando o custo real ainda não foi sincronizado.

### 5. Dashboard
- Atualizar `src/pages/Admin.tsx`:
  - Carregar, além dos tokens, os campos `cost_credits`, `cost_brl` e `cost_source`.
  - Calcular totais reais quando disponíveis.
- Atualizar `src/components/admin/AiCostPanel.tsx`:
  - Mostrar o **custo real em créditos** e o correspondente em R$.
  - Indicar visualmente quando o valor é real vs. estimado.
  - Exibir percentual de requisições já sincronizadas com o gateway.
  - Manter o detalhamento por modelo, mas agora com custo real quando houver.

### 6. Validação
- Enviar uma mensagem no chat para gerar uma requisição.
- Verificar se `ai_usage_logs` registrou `gateway_run_id`.
- Executar a sincronização e confirmar que `cost_credits`/`cost_brl` foram preenchidos.
- Confirmar que o dashboard exibe o custo real do período.

## Arquivos envolvidos
- `supabase/migrations/2026XXXXXX_add_gateway_costs_to_ai_usage_logs.sql`
- `supabase/functions/chat-with-ai/index.ts`
- `supabase/functions/sync-ai-gateway-costs/index.ts` (novo)
- `src/lib/aiPricing.ts`
- `src/pages/Admin.tsx`
- `src/components/admin/AiCostPanel.tsx`
