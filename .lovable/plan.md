

# Remover botão flutuante do Chat Widget

## Problema
O componente `AIAssistant` é renderizado globalmente no `App.tsx` (linha 45), aparecendo em **todas** as páginas, incluindo `/chat-widget`. Como a rota `/chat-widget` já é a janela do chat em tela cheia (para embed em outro sistema), o botão flutuante "Pergunte à AIA" fica redundante e atrapalha.

## Solução

### Arquivo: `src/App.tsx`
Condicionar a renderização do `AIAssistant` para que ele **não apareça** na rota `/chat-widget`. Como o `BrowserRouter` já está no escopo, mover o `AIAssistant` para dentro do `BrowserRouter` e usar `useLocation` para escondê-lo quando a rota for `/chat-widget`.

Alternativa mais simples: criar um pequeno componente wrapper que verifica `window.location.pathname` ou usar `useLocation` dentro de um componente filho do `BrowserRouter`.

### Mudança concreta
1. Criar um componente `ConditionalAIAssistant` que usa `useLocation` e só renderiza `<AIAssistant />` se o path **não** for `/chat-widget`
2. Substituir `<AIAssistant />` por `<ConditionalAIAssistant />` dentro do `BrowserRouter`

