
# Simulador Bancario Hibrido - Agente de Simulacoes Imobiliarias

## Visao Geral
Criar um sistema de simulacao de financiamento imobiliario disponivel tanto no chat da AIA quanto em uma pagina dedicada. O agente usara formulas financeiras (SAC e Price) com taxas conhecidas dos bancos, e periodicamente podera atualizar taxas via scraping de paginas informativas.

## Bancos Cobertos
- Caixa Economica (SBPE, Minha Casa Minha Vida, Pro-Cotista)
- Banco do Brasil
- Itau
- Bradesco
- Santander

---

## Arquitetura

### 1. Edge Function: `simulate-financing` (nova)
Endpoint dedicado que recebe os parametros do imovel e retorna simulacoes de todos os bancos.

**Entrada:**
- Valor do imovel
- Valor de entrada (ou %)
- Prazo desejado (em meses)
- Renda bruta familiar (para verificar comprometimento)
- Tipo de imovel (novo/usado)
- Primeira propriedade (sim/nao)
- FGTS disponivel (opcional)

**Saida:**
- Simulacao para cada banco com: parcela inicial, parcela final (SAC), taxa de juros, CET estimado, valor total pago, sistema de amortizacao (SAC e Price)

**Logica interna:**
- Tabela de taxas dos bancos armazenada no banco de dados (tabela `bank_rates`)
- Formulas de calculo SAC e Price implementadas na edge function
- Verificacao de renda (comprometimento maximo de 30%)
- Regras especificas por banco (ex: Caixa permite ate 80% de financiamento para imoveis usados, 90% para novos)

### 2. Tabela no Supabase: `bank_rates`
Armazena as taxas e regras de cada banco, atualizaveis pelo admin.

**Colunas:**
- `id` (uuid)
- `bank_name` (text) - nome do banco
- `bank_code` (text) - codigo identificador
- `modality` (text) - SBPE, MCMV, Pro-Cotista etc.
- `min_rate` (numeric) - taxa minima anual
- `max_rate` (numeric) - taxa maxima anual
- `max_ltv` (numeric) - % maximo de financiamento
- `max_term_months` (integer) - prazo maximo em meses
- `max_income_ratio` (numeric) - % maximo de comprometimento de renda
- `min_property_value` (numeric) - valor minimo do imovel
- `max_property_value` (numeric) - valor maximo do imovel (se aplicavel)
- `insurance_rate` (numeric) - taxa de seguro estimada
- `admin_fee` (numeric) - taxa administrativa mensal
- `is_active` (boolean)
- `notes` (text) - observacoes
- `updated_at` (timestamp)
- `updated_by` (uuid)

### 3. Edge Function: `update-bank-rates` (nova)
Funcao que usa Firecrawl para buscar informacoes atualizadas de taxas em paginas publicas dos bancos (nao nos simuladores interativos, mas em paginas informativas de taxas).

- Executada manualmente pelo admin ou via cron
- Scraping de paginas como:
  - Caixa: paginas de taxas de juros
  - Bancos: paginas institucionais com tabelas de taxas
- Resultados processados pela IA para extrair taxas estruturadas
- Admin recebe notificacao para revisar e aprovar as atualizacoes

### 4. Pagina dedicada: `/simulador`
Formulario intuitivo com:
- Campos de entrada (valor do imovel, entrada, prazo, renda)
- Opcoes adicionais (primeiro imovel, FGTS, tipo do imovel)
- Resultado em cards comparativos por banco
- Grafico de evolucao das parcelas (SAC vs Price)
- Botao para exportar PDF ou compartilhar

### 5. Integracao com o Chat da AIA
- O chat reconhece perguntas sobre financiamento/simulacao
- Keywords: "simular", "financiamento", "parcela", "quanto fico pagando", "taxa de juros", "Caixa", "banco"
- A AIA coleta os dados necessarios via conversa (pergunta valor, entrada, prazo etc.)
- Chama a edge function `simulate-financing` internamente
- Apresenta os resultados formatados no chat

---

## Detalhes Tecnicos

### Formulas de Calculo

**Sistema SAC (parcela decrescente):**
- Amortizacao = Valor Financiado / Numero de Meses
- Juros(n) = Saldo Devedor(n) x Taxa Mensal
- Parcela(n) = Amortizacao + Juros(n) + Seguro + Taxa Admin

**Sistema Price (parcela fixa):**
- Parcela = VP x [i x (1+i)^n] / [(1+i)^n - 1]
- Onde: VP = valor presente, i = taxa mensal, n = numero de meses

### Fluxo do Chat

```text
Usuario: "Quero simular um financiamento"
    |
AIA: Pergunta valor do imovel
    |
Usuario: "R$ 450.000"
    |
AIA: Pergunta valor de entrada
    |
Usuario: "R$ 90.000"
    |
AIA: Pergunta prazo e renda
    |
Usuario: "360 meses, renda de R$ 12.000"
    |
AIA: Chama edge function simulate-financing
    |
AIA: Apresenta tabela comparativa dos bancos
```

### Seguranca e RLS
- Tabela `bank_rates`: leitura publica, escrita apenas admin
- Edge function `simulate-financing`: publica (sem JWT), com rate limiting
- Edge function `update-bank-rates`: restrita a admin

### Arquivos a criar/modificar
1. **Novo**: `supabase/functions/simulate-financing/index.ts` - logica de calculo
2. **Novo**: `supabase/functions/update-bank-rates/index.ts` - scraping de taxas (requer Firecrawl)
3. **Novo**: `src/pages/Simulador.tsx` - pagina do simulador
4. **Novo**: `src/components/simulator/SimulatorForm.tsx` - formulario de entrada
5. **Novo**: `src/components/simulator/SimulationResults.tsx` - exibicao dos resultados
6. **Novo**: `src/components/simulator/BankComparisonCard.tsx` - card de cada banco
7. **Modificar**: `src/App.tsx` - adicionar rota `/simulador`
8. **Modificar**: `supabase/config.toml` - registrar novas edge functions
9. **Novo**: Migracao SQL para tabela `bank_rates` com dados iniciais
10. **Modificar**: Keywords do chat para reconhecer perguntas de simulacao

### Observacao sobre o Firecrawl
Para a funcao de atualizacao de taxas via scraping, sera necessario conectar o conector Firecrawl ao projeto. Isso pode ser feito na etapa de implementacao da funcao `update-bank-rates`.
