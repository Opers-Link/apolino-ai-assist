

# Instruções de Refinamento em Tempo Real (Correction Layer)

## Conceito

Criar uma camada de **"Instruções de Refinamento"** separada do prompt mestre. Funciona como uma lista de correções e instruções específicas que são injetadas automaticamente no contexto da IA, sem poluir o prompt base.

**Analogia**: O prompt mestre é a "constituição" da AIA. As instruções de refinamento são "portarias e decretos" — regras específicas que complementam sem alterar a base.

## Como funciona

O admin identifica uma resposta errada no chat → abre o painel de refinamentos → adiciona uma instrução como:

> "Quando perguntarem sobre rescisão de contrato de locação, o prazo correto é 30 dias de aviso prévio, NÃO 90 dias como consta no manual v2.1"

Essa instrução é salva no banco e automaticamente incluída no contexto da IA em todas as conversas seguintes.

## Implementação

### 1. Nova tabela `prompt_refinements`

```text
id              UUID (PK)
instruction     TEXT       -- a instrução/correção
category        TEXT       -- opcional: "correção", "complemento", "restrição"
is_active       BOOLEAN    -- ativar/desativar sem deletar
priority        INTEGER    -- ordem de importância
created_by      UUID
created_at      TIMESTAMP
module_hint     TEXT       -- opcional: associar a um módulo específico
```

### 2. Novo componente `RefinementsManager`

No painel admin (dentro de Configurações), uma nova aba "Refinamentos" ao lado do editor de prompt. Interface simples:
- Lista de instruções ativas com toggle on/off
- Botão "Adicionar refinamento" com campo de texto
- Campo opcional de categoria e módulo associado
- Contador de instruções ativas

### 3. Edge Function `chat-with-ai` — injetar refinamentos

Na montagem do prompt, após o master prompt e antes dos módulos de conhecimento, inserir um bloco:

```text
📌 INSTRUÇÕES DE REFINAMENTO (prioridade alta):
- [instrução 1]
- [instrução 2]
...
```

Essas instruções são carregadas em paralelo com as outras queries (adicionando à Promise.all existente).

### 4. Atalho desde o painel de conversas (opcional)

Ao visualizar uma conversa no admin e identificar uma resposta errada, botão "Criar refinamento" que pré-preenche o contexto da pergunta/resposta problemática.

## Arquivos afetados

- **Nova migração SQL** — tabela `prompt_refinements` + RLS
- **Novo componente** `src/components/admin/RefinementsManager.tsx`
- **`src/pages/Admin.tsx`** — adicionar aba/seção de Refinamentos nas Configurações
- **`supabase/functions/chat-with-ai/index.ts`** — query + injeção no prompt

## Vantagens desta abordagem

- Prompt mestre fica limpo e estável
- Refinamentos podem ser ativados/desativados individualmente
- Histórico de todas as correções feitas
- Fácil de testar: ativa, testa no chat, desativa se não funcionar
- Escala bem: dezenas de refinamentos sem impactar a legibilidade do prompt

