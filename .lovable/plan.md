

# Histórico de Chat por Usuário Externo

## Situação Atual
Hoje, o chat widget usa `localStorage` para recuperar a conversa ativa. O `session_id` é gerado aleatoriamente (`session_${Date.now()}_random`). Isso significa que se o usuário limpar o cache ou trocar de navegador, perde o histórico. Não há vínculo com o usuário do sistema externo.

## Solução Proposta

Usar **postMessage** (comunicação iframe ↔ sistema pai) para que o sistema externo envie um identificador do usuário ao chat widget. Com esse ID, o chat pode recuperar conversas anteriores daquele usuário.

### Fluxo

```text
Sistema Externo (pai)              Chat Widget (iframe)
    │                                    │
    │── postMessage({ externalUserId })──▶│
    │                                    │ Salva externalUserId no state
    │                                    │ Busca conversa ativa com esse userId
    │                                    │ Se não encontrar, cria nova no 1º envio
    │                                    │
    │◀── postMessage({ conversationId })──│ (opcional, retorno do ID)
```

### Mudanças

#### 1. Banco de dados — nova coluna `external_user_id`
- Adicionar coluna `external_user_id TEXT` na tabela `chat_conversations`
- Criar índice para busca rápida por `external_user_id`

#### 2. `src/pages/ChatWidget.tsx`
- Aceitar parâmetros via **URL query string** (`?userId=xxx`) e/ou **postMessage**
- Passar o `externalUserId` como prop para `AIAssistantPanel`

#### 3. `src/components/chat/AIAssistantPanel.tsx`
- Receber prop `externalUserId?: string`
- Na recuperação de conversa (`recoverExistingConversation`): se `externalUserId` existir, buscar conversa ativa pelo `external_user_id` no banco (em vez de depender apenas do `localStorage`)
- Na criação de conversa (`createConversation`): salvar `external_user_id` junto com os dados
- Manter fallback para `localStorage` quando não houver `externalUserId`

#### 4. Integração no sistema externo (instruções para o cliente)
O sistema externo precisa passar o ID do usuário ao iframe de duas formas possíveis:
- **Query string** (mais simples): `<iframe src="https://aia-apolar-assist.lovable.app/chat-widget?userId=USER_123">`
- **postMessage** (mais seguro/dinâmico): `iframe.contentWindow.postMessage({ type: 'SET_USER_ID', userId: 'USER_123' }, '*')`

### Resultado
- Usuário abre o chat → widget recebe o `userId` → busca conversas ativas desse usuário → exibe histórico
- Se não houver conversa ativa, cria uma nova vinculada ao `userId`
- Ao retornar, o usuário vê suas conversas anteriores (enquanto estiverem ativas/não expiradas)

