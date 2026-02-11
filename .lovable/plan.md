

# Plano: Deploy da Edge Function com Streaming

## Problema
O codigo de streaming SSE ja foi implementado tanto na Edge Function quanto no frontend, porem a Edge Function `chat-with-ai` ainda nao foi re-deployada. A versao em producao continua retornando a resposta completa (sem streaming), e o frontend tenta ler como SSE mas recebe tudo de uma vez.

## Solucao
Fazer o deploy da edge function `chat-with-ai` para que a versao com `stream: true` entre em vigor.

## Alteracoes

Nenhuma alteracao de codigo necessaria. Apenas o deploy da edge function:

- **Deploy**: `supabase/functions/chat-with-ai/index.ts` - ja contem `stream: true` e retorno SSE

Apos o deploy, o fluxo completo funcionara:
1. Frontend envia mensagem via fetch
2. Edge Function chama o Lovable AI Gateway com `stream: true`
3. Edge Function retorna o body como `text/event-stream`
4. Frontend le os tokens progressivamente e atualiza a mensagem em tempo real

## Secao Tecnica

O deploy sera feito usando a ferramenta `supabase--deploy_edge_functions` com a funcao `chat-with-ai`.
