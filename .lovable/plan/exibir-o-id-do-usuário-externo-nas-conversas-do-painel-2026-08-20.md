# Exibir o ID do usuário externo nas conversas do painel

## O problema (dois pontos)

**1. O link não está sendo lido corretamente**

O widget hoje só lê o parâmetro `userId` da URL:

```text
✅ /chat-widget?userId=12345      → capturado
❌ /chat-widget?idusuario=12345   → ignorado
```

Ou seja, no formato que você está usando (`?idusuario=12345`), o ID nem chega a ser gravado na conversa — o campo fica vazio no banco.

**2. O painel não mostra o campo**

Mesmo quando o ID é gravado, nenhuma tela de conversas do admin exibe esse valor. Ele só aparece hoje na aba de Refinamentos.

## O que será feito

### Captura do ID no widget
Aceitar múltiplos nomes de parâmetro na URL, para funcionar com o link atual e com variações:
`idusuario`, `id_usuario`, `userId`, `user_id`, `externalUserId`.
O `postMessage` (iframe) continua funcionando como está.

### Exibição no painel administrativo
Mostrar o ID do usuário em três lugares:

- **Lista "Todas as Conversas"** — uma etiqueta destacada com `ID usuário: 12345` no card da conversa (só aparece quando existe).
- **Cabeçalho das mensagens** — ao selecionar a conversa, o ID aparece junto com a data de início.
- **Modal de detalhe do atendimento** — etiqueta com o ID ao lado do status/categoria, com botão de copiar.

Quando a conversa não tiver ID (usuário anônimo), nada é exibido — sem campos vazios.

### Filtro/busca (opcional, incluído)
Adicionar um campo de busca na lista de conversas que filtra por ID de usuário externo ou por sessão, para localizar rapidamente o atendimento de uma pessoa específica.

## Detalhes técnicos

- `src/pages/ChatWidget.tsx`: ler a query string testando a lista de aliases de parâmetro em ordem.
- `src/pages/Admin.tsx`: incluir `external_user_id` na interface `Conversation`, garantir que o `select` das conversas traga a coluna, e renderizar na lista + cabeçalho de mensagens; adicionar o input de busca com filtro em memória sobre as conversas carregadas.
- `src/components/admin/ConversationDetailModal.tsx`: adicionar `external_user_id` à interface e renderizar o badge no header com ação de copiar.
- Sem mudanças de banco de dados — a coluna `external_user_id` já existe em `chat_conversations` e já é gravada pelo chat.

## Observação

Conversas antigas criadas com o link `?idusuario=` continuarão sem ID (o dado não chegou a ser salvo). O preenchimento passa a valer para conversas novas após o ajuste.
