

## Objetivo
Substituir o conteúdo atual da página inicial por uma imagem de fundo que simula um sistema real, mantendo o chat AIA funcional e o acesso ao admin de forma sutil.

## Alterações Necessárias

### 1. Copiar a imagem para o projeto
- Copiar `user-uploads://image-21.png` para `src/assets/system-background.png`
- Usar import ES6 para carregar a imagem no componente

### 2. Modificar `src/pages/Index.tsx`

**Estrutura proposta:**
```
+--------------------------------------------------+
|                                                  |
|  [Imagem de fundo ocupando 100% da tela]         |
|                                                  |
|                              [Admin] (canto      |
|                               inferior direito,  |
|                               pequeno e sutil)   |
+--------------------------------------------------+
```

**Implementação:**
- Remover todo o conteúdo atual (cards, textos, etc.)
- Usar a imagem como background com `background-image` ou `<img>` com `object-cover`
- Manter o chat AIA (já é global via `App.tsx`, não precisa de alteração)
- Posicionar botão Admin no canto inferior direito com estilo discreto (semi-transparente, pequeno)

### 3. Estilos do botão Admin
- Posição: `fixed bottom-4 right-4`
- Visual: Fundo semi-transparente, ícone pequeno, sem texto ou texto sutil
- Hover: Aumenta opacidade levemente

## Código Final Esperado

```tsx
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";
import systemBackground from "@/assets/system-background.png";

const Index = () => {
  return (
    <div className="relative min-h-screen w-full">
      {/* Imagem de fundo simulando sistema */}
      <img 
        src={systemBackground} 
        alt="Sistema Apolar" 
        className="w-full h-screen object-cover object-top"
      />
      
      {/* Botão Admin sutil no canto inferior direito */}
      <Link to="/auth" className="fixed bottom-4 right-4 z-20">
        <Button 
          variant="ghost" 
          size="sm"
          className="bg-white/50 hover:bg-white/80 backdrop-blur-sm text-gray-600 hover:text-gray-800"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
};

export default Index;
```

## Resultado
- A tela inicial mostrará o screenshot do sistema Apolar como se fosse um ambiente real
- O chat AIA continuará funcionando normalmente (botão "Pergunte à AIA" no topo)
- O botão Admin ficará discreto no canto inferior direito, acessível mas não intrusivo
- Perfeito para demonstrações do funcionamento do chat em contexto de sistema

