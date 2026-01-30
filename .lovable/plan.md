
# Plano: Aumentar Rate Limit para 200 requisições/hora

## Resumo
Alterar o limite de requisições do chat de 20 para 200 por hora, permitindo que mais usuários testem o sistema simultaneamente sem bloqueios.

## Alteração Necessária

### Arquivo: `supabase/functions/chat-with-ai/index.ts`

**Linha 47 - Antes:**
```typescript
const RATE_LIMIT_REQUESTS = 20; // Max requests per window
```

**Depois:**
```typescript
const RATE_LIMIT_REQUESTS = 200; // Max requests per window
```

## Resultado Esperado
- Cada sessão poderá enviar até **200 mensagens por hora**
- A janela de tempo permanece em 1 hora
- A Edge Function será reimplantada automaticamente após a alteração

## Seção Técnica

O rate limiting funciona da seguinte forma:
1. A cada requisição, o sistema conta quantos registros existem na tabela `ai_usage_logs` para aquele `session_id` na última hora
2. Se o número ultrapassar `RATE_LIMIT_REQUESTS`, retorna erro HTTP 429 (Too Many Requests)
3. Atualmente o `session_id` é fixo como `usuario_atual` para todos os visitantes não autenticados

**Observação**: Como o `userId` está hardcoded como `usuario_atual` no frontend, todos os visitantes ainda compartilham o mesmo limite. Para um sistema mais robusto no futuro, seria recomendável usar um identificador único por navegador/IP.
