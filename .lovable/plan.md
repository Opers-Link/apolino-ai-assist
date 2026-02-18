

# Corrigir respostas duplicadas no chat

## Causa raiz
O chat exibe a resposta da IA duas vezes porque:

1. Durante o streaming, uma mensagem e criada localmente com um ID temporario (ex: `"17394..."`)
2. Apos o streaming, a mensagem e salva no banco de dados (recebe um UUID)
3. O listener de tempo real (realtime) detecta o INSERT no banco e tenta adicionar a mesma mensagem novamente
4. A verificacao de duplicatas compara IDs, mas o ID local e diferente do UUID do banco. A verificacao por conteudo tem uma janela de 5 segundos que pode falhar se o streaming demorar mais

## Solucao
Atualizar o ID local da mensagem do bot para o UUID retornado pelo banco apos o `saveMessage`, e melhorar a logica de deduplicacao no listener realtime.

### Alteracoes no arquivo `src/components/chat/AIAssistantPanel.tsx`

**1. Modificar `saveMessage` para retornar o ID do banco**
- Alterar a funcao para usar `.select().single()` no insert e retornar o `id` do registro criado

**2. Apos salvar a resposta do bot, atualizar o ID local para o UUID do banco**
- Na linha 624-627, apos o `saveMessage`, usar o ID retornado para atualizar a mensagem no estado local
- Isso faz com que o listener realtime encontre o mesmo ID e descarte a duplicata

**3. Melhorar a deduplicacao no listener realtime**
- Remover a restricao de janela de 5 segundos na comparacao por conteudo
- Adicionar verificacao se a mensagem e identica em conteudo (independente do tempo)

Essas mudancas garantem que o fluxo funcione assim:
- Streaming cria mensagem local com ID temporario
- Banco salva e retorna UUID
- Estado local e atualizado com o UUID
- Listener realtime recebe o evento, encontra o UUID no estado e ignora

