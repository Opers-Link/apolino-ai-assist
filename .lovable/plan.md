
# Plano: Sincronizar FAQ com Base de Conhecimento da IA

## Situacao Atual

O sistema possui duas fontes de informacao independentes:

| Componente | Tabelas | Uso |
|------------|---------|-----|
| FAQ | `faq_categories`, `faq_questions` | Exibido na pagina /faq para autoatendimento |
| Modulos de Conhecimento | `knowledge_modules`, `knowledge_module_files` | PDFs com manuais usados pela IA no chat |

As respostas do FAQ sao textos curtos criados manualmente, enquanto a IA usa o conteudo extraido dos PDFs dos modulos de conhecimento.

## Objetivo

Garantir que as respostas do FAQ estejam alinhadas e consistentes com a base de conhecimento usada pela IA.

## Opcoes de Implementacao

### Opcao 1: Geracao Automatica de FAQ via IA (Recomendado)
Criar funcionalidade para gerar automaticamente perguntas e respostas do FAQ baseando-se no conteudo dos modulos de conhecimento.

**Vantagens:**
- FAQ sempre atualizado conforme os manuais
- Menos trabalho manual para manter consistencia
- Aproveita o conteudo ja processado dos PDFs

**Desvantagens:**
- Custo de tokens da IA para geracao
- Pode precisar de revisao humana

### Opcao 2: Vincular FAQ aos Modulos
Adicionar um campo `knowledge_module_id` nas perguntas do FAQ para indicar de qual modulo cada resposta foi extraida.

**Vantagens:**
- Rastreabilidade clara da origem
- Permite filtragem por modulo

**Desvantagens:**
- Ainda requer atualizacao manual das respostas

### Opcao 3: Inclusao do FAQ no Prompt da IA
Incluir as perguntas/respostas do FAQ como parte do contexto da IA, para que ela responda de forma consistente.

**Vantagens:**
- Implementacao simples
- IA conhece as respostas "oficiais" do FAQ

**Desvantagens:**
- Aumenta consumo de tokens
- Nao resolve a sincronizacao inversa

---

## Plano Detalhado: Opcao 1 (Geracao Automatica)

### Fase 1: Botao "Gerar FAQ" no Painel Admin

1. Adicionar botao "Gerar FAQ a partir dos Manuais" na tela de FAQ do admin
2. Ao clicar, exibir dialog para selecionar:
   - Qual modulo de conhecimento usar como fonte
   - Quantas perguntas gerar (5-15)
   - Categoria do FAQ destino

### Fase 2: Edge Function para Geracao

Criar funcao `generate-faq-from-knowledge` que:
1. Recebe o ID do modulo e parametros
2. Busca o texto extraido do modulo
3. Usa a IA para gerar perguntas/respostas no formato:
   ```
   Q: [pergunta frequente]
   A: [resposta clara e concisa]
   ```
4. Retorna as perguntas para preview

### Fase 3: Interface de Revisao

1. Exibir preview das perguntas geradas
2. Permitir editar/excluir antes de salvar
3. Opcao de salvar todas ou selecionar individualmente
4. Inserir na categoria escolhida

### Fase 4: Indicador de Origem

1. Adicionar campo `source_module_id` na tabela `faq_questions` (opcional)
2. Exibir badge indicando origem automatica vs manual
3. Alertar quando o modulo fonte for atualizado (nova versao)

---

## Alteracoes Tecnicas

### Banco de Dados
```sql
-- Adicionar campo para rastrear origem (opcional)
ALTER TABLE faq_questions
ADD COLUMN source_module_id UUID REFERENCES knowledge_modules(id),
ADD COLUMN auto_generated BOOLEAN DEFAULT false;
```

### Nova Edge Function
- Arquivo: `supabase/functions/generate-faq-from-knowledge/index.ts`
- Usa Lovable AI para gerar perguntas estruturadas
- Recebe: module_id, question_count, category_id
- Retorna: array de {question, answer}

### Frontend (FAQManager.tsx)
- Novo botao "Gerar com IA"
- Dialog de configuracao
- Preview das perguntas geradas
- Salvamento em lote

---

## Fluxo de Uso

```text
Admin acessa FAQ Manager
        |
        v
Clica "Gerar FAQ com IA"
        |
        v
Seleciona modulo fonte (ex: CRM Sales)
        |
        v
Define quantidade e categoria destino
        |
        v
IA analisa conteudo do modulo
        |
        v
Preview das perguntas geradas
        |
        v
Admin revisa/edita/aprova
        |
        v
Salva no banco -> Aparece no /faq
```

## Beneficios

1. **Consistencia**: FAQ sempre reflete o conteudo oficial dos manuais
2. **Produtividade**: Gera 10+ perguntas em segundos vs escrever manualmente
3. **Manutencao**: Ao atualizar um manual, pode regenerar o FAQ correspondente
4. **Qualidade**: IA identifica as duvidas mais frequentes baseado no conteudo
