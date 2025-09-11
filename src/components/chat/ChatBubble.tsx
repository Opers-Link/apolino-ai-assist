import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import apolinoAi from '@/assets/apolino-ai.png';

interface ChatBubbleProps {
  onClick: () => void;
  isOpen: boolean;
  hasUnreadMessage?: boolean;
}

const ChatBubble = ({ onClick, isOpen, hasUnreadMessage }: ChatBubbleProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "relative flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-apolar-gold/30",
          "gradient-primary chat-glow",
          isOpen && "rotate-45",
          hasUnreadMessage && "animate-pulse"
        )}
        aria-label={isOpen ? "Fechar chat" : "Abrir chat do Apolino"}
      >
        {/* Indicador de mensagem não lida */}
        {hasUnreadMessage && !isOpen && (
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-apolar-red border-2 border-white animate-pulse" />
        )}
        
        {/* Ícone principal */}
        <div className={cn(
          "transition-all duration-300",
          isOpen ? "rotate-45" : "rotate-0"
        )}>
          {isOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <img 
              src={apolinoAi} 
              alt="Apolino AI" 
              className="h-10 w-10 rounded-full"
            />
          )}
        </div>
        
        {/* Tooltip */}
        {isHovered && !isOpen && (
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-apolar-blue text-white text-sm rounded-lg whitespace-nowrap shadow-lg chat-bubble-enter">
            Fale com o Apolino
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-apolar-blue" />
          </div>
        )}
      </button>
    </div>
  );
};

export default ChatBubble;