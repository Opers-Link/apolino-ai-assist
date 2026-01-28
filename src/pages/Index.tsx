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
