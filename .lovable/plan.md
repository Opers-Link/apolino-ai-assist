

# Fallback inteligente: usar conhecimento proprio do GPT

## O que muda
Quando a classificacao por palavras-chave e por IA nao identificarem nenhum modulo relevante, o sistema **nao carregara nenhum modulo de conhecimento**. O GPT responde usando seu proprio conhecimento sobre o mercado imobiliario, mantendo a identidade e regras da AIA (prompt mestre continua ativo).

## Alteracoes no arquivo `supabase/functions/chat-with-ai/index.ts`

**1. Novo metodo de classificacao `none` (linha 458)**
- Adicionar `'none'` ao tipo de retorno da funcao `classifyRelevantModules`

**2. Alterar o fallback (linhas 476-478)**
- De: `return { modules: [], method: 'all' }`
- Para: `return { modules: [], method: 'none' }`

**3. Atualizar tipos de retorno no `getSystemPrompt` (linha 530)**
- Incluir `'none'` no tipo `classificationMethod`

**4. Logica de carregamento de modulos (linhas 572-604)**
- Quando `classificationMethod === 'none'`, nao carregar nenhum modulo (todos recebem placeholder)
- Alterar a logica `loadAllModules` para considerar o novo metodo

**5. Atualizar log de modulos (linha 241)**
- Quando o metodo for `'none'`, logar "NONE (GPT knowledge only)"

**6. Atualizar tipo no fallback do `getSystemPrompt` (linhas 544-546 e 646-649)**
- Manter `'all'` nos fallbacks de erro (quando nao ha prompt customizado), pois nesses casos o sistema ja usa o prompt hardcoded simples

## Resultado esperado
- Perguntas especificas sobre processos internos: carrega modulo(s) relevante(s) via keywords ou IA
- Perguntas genericas (ex: "o que e ITBI?"): GPT responde com conhecimento proprio, sem carregar PDFs
- Sem risco de erro `context_length_exceeded` no fallback

