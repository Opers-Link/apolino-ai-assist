import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import aiaLogo from '@/assets/aia-logo.png';

interface AIAssistantTriggerProps {
  onClick: () => void;
  hasNotification?: boolean;
}

const AIAssistantTrigger = ({ onClick, hasNotification }: AIAssistantTriggerProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-30",
        "flex items-center gap-2 px-4 py-2.5",
        "bg-gradient-to-r from-apolar-gold via-apolar-gold-alt to-apolar-gold-light",
        "text-white font-medium text-sm",
        "rounded-full shadow-lg shadow-apolar-gold/30",
        "hover:shadow-xl hover:shadow-apolar-gold/40 hover:scale-105",
        "transition-all duration-300",
        "group"
      )}
    >
      <div className="h-6 w-6 rounded-full bg-white/20 p-1 group-hover:bg-white/30 transition-colors">
        <img src={aiaLogo} alt="AIA" className="h-full w-full object-contain brightness-0 invert" />
      </div>
      <span className="font-semibold">AIA</span>
      {hasNotification && (
        <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
      )}
    </button>
  );
};

export default AIAssistantTrigger;
