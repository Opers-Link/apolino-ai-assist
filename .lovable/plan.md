## Objetivo
Substituir o modal "Sugerir refinamento" por um **modo refinamento** ativado dentro do próprio chat. Ao clicar em "Refinar resposta", o chat entra num estado visual diferenciado, mostra uma mensagem explicativa e a próxima mensagem enviada é registrada como sugestão de refinamento (indo para o painel admin), sem chamar a IA.

## Fluxo de uso
1. Usuário clica em **"Refinar resposta"** no rodapé do chat.
2. O chat entra em **modo refinamento**:
   - Uma mensagem do sistema aparece na conversa (balão dourado, ícone de lâmpada/refinamento):
     > "**Modo refinamento ativado.** Descreva o ajuste que a AIA deveria fazer na última resposta. Sua próxima mensagem será enviada para revisão de um administrador — a IA não irá responder. [Cancelar]"
   - O campo de input muda visualmente (borda dourada, placeholder trocado para *"Ex: Ao falar sobre comissão de locação, o valor correto é X%…"*).
   - O botão "Refinar resposta" fica destacado como ativo.
3. Usuário digita e envia.
4. Em vez de chamar a edge function da IA, o texto é gravado em `user_refinement_suggestions` (mesma tabela usada hoje pelo modal), com o contexto das últimas 2 mensagens.
5. O chat sai do modo refinamento e mostra uma mensagem do sistema de confirmação:
   > "✅ Sugestão enviada. Obrigado! Um administrador irá revisar."
6. Se o usuário clicar em **Cancelar** (na mensagem de sistema ou novamente em "Refinar resposta"), o modo é desativado sem enviar nada.

## Mudanças
### `src/components/chat/AIAssistantPanel.tsx`
- Remover o `<Dialog>` de refinamento (linhas ~927-960) e o estado `refinementOpen`/`refinementText`.
- Adicionar estado `refinementMode: boolean` e `sendingRefinement`.
- No tipo `Message` (ou via campo adicional), suportar mensagens do tipo `system` para os balões informativos (ícone + texto, estilo diferenciado — fundo `apolar-gold/10`, borda dourada, ícone `MessageSquarePlus`).
- Botão "Refinar resposta": alterna `refinementMode`. Quando ativo, muda estilo (fundo dourado sólido, texto azul) e injeta a mensagem de sistema "Modo refinamento ativado".
- Input area: quando `refinementMode`, aplicar borda/anel dourado, trocar placeholder e o ícone do botão de envio.
- `handleSendMessage`: se `refinementMode`, desviar o fluxo para chamar `handleSubmitRefinement` (reaproveitar a lógica atual de insert em `user_refinement_suggestions`), depois desativar o modo e adicionar mensagem de sistema de confirmação. Não incrementar contadores da IA nem chamar a edge function.
- `handleSubmitRefinement` já existe; adaptar para receber o texto por parâmetro e não fechar dialog.

### Painel admin
- Nenhuma mudança — os refinamentos continuam caindo em `user_refinement_suggestions` e aparecendo no `RefinementsManager` atual.

## Observações
- Mantém compatível com a tabela existente (`suggestion`, `context`, `conversation_id`, `external_user_id`).
- Não afeta o fluxo de mensagens da IA, contagem de mensagens ou timeout de inatividade (mensagens de refinamento não contam).
- Não requer migração de banco.
