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
        "fixed top-4 right-4 z-30",
        "flex items-center gap-2 px-3 py-2",
        "bg-white/90 backdrop-blur-md",
        "border border-gray-200/80",
        "text-gray-700 font-medium text-sm",
        "rounded-full shadow-md",
        "hover:shadow-lg hover:bg-white hover:border-apolar-gold/50",
        "transition-all duration-300",
        "group"
      )}
    >
      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-apolar-gold via-apolar-gold-alt to-apolar-gold-light p-1 shadow-sm">
        <img src={aiaLogo} alt="AIA" className="h-full w-full object-contain brightness-0 opacity-70" />
      </div>
      <span className="text-gray-600 group-hover:text-apolar-blue transition-colors">Pergunte à AIA</span>
      {hasNotification && (
        <span className="absolute -top-1 -right-1 h-3 w-3 bg-apolar-red rounded-full animate-pulse" />
      )}
    </button>
  );
};

export default AIAssistantTrigger;
