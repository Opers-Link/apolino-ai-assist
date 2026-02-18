

# Atualizar URL do Movidesk

## O problema
O link atual no sistema aponta para `https://apolar.movidesk.com/`, que foi desativado pelo Movidesk/Zenvia. O link correto e funcional e `https://apolarimoveis.movidesk.com/Account/Login`.

## Alteracoes

Atualizar a URL do Movidesk nos seguintes arquivos:

### 1. `src/components/chat/AIAssistantPanel.tsx` (linha 42)
- De: `https://apolar.movidesk.com/`
- Para: `https://apolarimoveis.movidesk.com/Account/Login`

### 2. Prompt embutido na edge function `supabase/functions/chat-with-ai/index.ts`
- Atualizar referencias ao Movidesk no fallback prompt para o novo link

### 3. Migration/Prompt no banco de dados
- As migrations antigas contem o link antigo, mas o que importa e o prompt ativo salvo na tabela `system_prompts`
- Sera necessario verificar se o prompt ativo no banco tambem contem o link antigo e, se sim, atualiza-lo manualmente pelo painel admin

## Secao Tecnica
- O botao "Abrir ticket" usa `window.open()` com a URL definida na constante `MOVIDESK_URL`
- A edge function tambem referencia o link do Movidesk no prompt de sistema (fallback)
- O arquivo `src/services/openai.ts` menciona Movidesk mas sem URL direta, nao precisa de alteracao
