
# Plano: Reorganizar Botões do Footer do Chat

## Resumo
Ocultar o botão "Solicitar atendimento" (sem remover o fluxo) e mover o botão "Ver Dúvidas Frequentes (FAQ)" para o lugar dele, ao lado do "Abrir ticket".

## Alterações

### Arquivo: `src/components/chat/AIAssistantPanel.tsx`

**1. Remover o bloco separado do FAQ** (linhas 733-744):
O botão "Ver Dúvidas Frequentes" que hoje aparece sozinho acima dos CTAs será removido desse local.

**2. Reorganizar os CTAs** (linhas 746-767):
- Manter o botão "Abrir ticket" como está
- Substituir o botão "Solicitar atendimento" pelo botão "Ver Dúvidas Frequentes (FAQ)"
- O fluxo de `handleRequestHumanHelp` permanece intacto no codigo, apenas o botão fica oculto

**Layout final dos botões:**
```
[  Abrir ticket  ] [ Ver Dúvidas Frequentes ]
```

## Seção Tecnica

Linhas 733-767 serao substituidas por:

```tsx
{/* CTAs destacados */}
<div className="flex gap-2 mt-3">
  <Button
    onClick={handleOpenTicket}
    variant="outline"
    size="sm"
    className="flex-1 gap-2 border-apolar-blue/40 text-apolar-blue hover:bg-apolar-blue hover:text-white transition-all"
  >
    <Ticket className="h-4 w-4" />
    Abrir ticket
  </Button>
  <Button
    onClick={() => window.open('/faq', '_blank')}
    variant="outline"
    size="sm"
    className="flex-1 gap-2 border-apolar-blue/40 text-apolar-blue hover:bg-apolar-blue/5 transition-all"
  >
    <HelpCircle className="h-4 w-4" />
    Dúvidas Frequentes
  </Button>
</div>
```

O botao "Solicitar atendimento" sera removido visualmente, mas a funcao `handleRequestHumanHelp` e todo o fluxo de escalonamento humano permanecem no codigo para uso futuro.
