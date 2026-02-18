

# Integração Firecrawl + Edge Function update-bank-rates

## Etapa 1: Configurar a chave API do Firecrawl

Como você já possui uma conta no Firecrawl, vamos adicionar sua chave API como secret no Supabase. Você pode encontrar sua API Key no dashboard do Firecrawl em [firecrawl.dev/app](https://firecrawl.dev/app) na seção de API Keys.

O Lovable vai solicitar a chave via ferramenta segura (o valor nunca fica exposto no código).

## Etapa 2: Criar a Edge Function `update-bank-rates`

Criar `supabase/functions/update-bank-rates/index.ts` que:

- Usa o Firecrawl para buscar páginas públicas de taxas dos bancos (Caixa, BB, Itaú, Bradesco, Santander)
- Envia o conteúdo extraído para a OpenAI para estruturar as taxas em formato JSON
- Compara com as taxas atuais na tabela `bank_rates`
- Retorna as diferenças encontradas para revisão do admin (não atualiza automaticamente)

### Fluxo da função

```text
1. Recebe requisição (pode filtrar por banco específico)
2. Para cada banco, faz scraping via Firecrawl das páginas de taxas
3. Envia o markdown extraído para a OpenAI com prompt estruturado
4. OpenAI retorna as taxas em JSON padronizado
5. Compara com dados atuais do banco de dados
6. Retorna relatório com taxas encontradas e diferenças
```

### URLs-alvo para scraping (páginas informativas, não simuladores)

- Caixa: páginas institucionais de taxas de juros habitacional
- Banco do Brasil: tabela de taxas de crédito imobiliário
- Itaú, Bradesco, Santander: páginas de taxas vigentes

## Etapa 3: Adicionar seção no painel Admin

Criar um componente `BankRatesManager` no admin que permite:

- Visualizar todas as taxas atuais por banco
- Editar taxas manualmente (formulário inline)
- Botão "Buscar Atualizações" que chama a edge function `update-bank-rates`
- Exibir diferenças encontradas com opção de aprovar/rejeitar cada atualização
- Histórico de quando as taxas foram atualizadas por último

Adicionar item "Taxas Bancárias" no menu lateral do admin (AdminSidebar).

## Etapa 4: Registrar no config.toml

Adicionar a nova edge function no `supabase/config.toml` com `verify_jwt = false`.

---

## Detalhes Técnicos

### Arquivos a criar
- `supabase/functions/update-bank-rates/index.ts` -- edge function de scraping
- `src/components/admin/BankRatesManager.tsx` -- painel de gerenciamento de taxas

### Arquivos a modificar
- `supabase/config.toml` -- registrar nova edge function
- `src/components/admin/AdminSidebar.tsx` -- adicionar item "Taxas Bancárias"
- `src/pages/Admin.tsx` -- renderizar o novo componente na tab correspondente

### Secrets necessários
- `FIRECRAWL_API_KEY` -- sua chave API do Firecrawl (será solicitada)
- `OPENAI_API_KEY` -- já configurada

### Segurança
- A edge function valida autenticação do admin antes de executar
- Taxas não são atualizadas automaticamente, passam por revisão
- Rate limiting implícito pelo uso manual

