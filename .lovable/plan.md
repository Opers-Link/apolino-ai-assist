

# Tooltip de Dicas no Chat da AIA

## O que sera feito

Adicionar um icone de dica (lampada ou interrogacao) ao lado do campo de input do chat. Ao passar o mouse ou clicar, exibira um tooltip com as seguintes dicas:

**Dicas para melhores respostas:**
- Faca uma pergunta por vez.
- Use palavras-chave claras (ex: comissao, vistoria, contrato, proposta).
- Seja especifico: informe o processo e o sistema envolvidos.

## Detalhes Tecnicos

### Arquivo a modificar
- `src/components/chat/AIAssistantPanel.tsx`

### Mudancas
1. Importar os componentes `Tooltip`, `TooltipTrigger`, `TooltipContent` e `TooltipProvider` de `@/components/ui/tooltip`
2. Importar o icone `Lightbulb` do `lucide-react`
3. Adicionar um botao com icone de lampada ao lado do campo de texto (dentro da area de input, posicionado a esquerda do botao de enviar)
4. O tooltip exibira o texto formatado com as 3 dicas usando bullet points
5. O tooltip usara o componente Radix ja existente no projeto, mantendo consistencia visual

### Posicionamento
O icone ficara dentro da barra de input (ao lado direito, antes do botao de enviar), mantendo o layout limpo e integrado ao design atual.

