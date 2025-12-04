import AIAssistant from '@/components/chat/AIAssistant';
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";

const Index = () => {
  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-apolar-blue/5 via-white to-apolar-gold/5">
        <div className="text-center space-y-6 max-w-2xl mx-auto px-6">
          {/* Admin Button */}
          <div className="flex justify-end mb-4">
            <Link to="/auth">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Admin
              </Button>
            </Link>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-apolar-blue to-apolar-gold bg-clip-text text-transparent">
              Apolar Imóveis
            </h1>
            <p className="text-xl text-apolar-dark-gray max-w-xl mx-auto">
              Sistema de suporte interno com assistente virtual Apolino
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            <div className="p-6 bg-white rounded-xl shadow-lg border border-apolar-light-gray">
              <h3 className="text-lg font-semibold text-apolar-blue mb-2">CRM Apolar Sales</h3>
              <p className="text-apolar-dark-gray">
                Gestão completa de vendas e relacionamento com clientes
              </p>
            </div>
            
            <div className="p-6 bg-white rounded-xl shadow-lg border border-apolar-light-gray">
              <h3 className="text-lg font-semibold text-apolar-blue mb-2">ERP Apolar Net</h3>
              <p className="text-apolar-dark-gray">
                Sistema integrado de gestão empresarial
              </p>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-apolar-gold/10 rounded-lg border border-apolar-gold/20">
            <p className="text-apolar-dark-gray text-sm">
              💡 <strong>Dica:</strong> Clique no botão AIA no canto inferior direito para tirar dúvidas sobre os sistemas!
            </p>
          </div>
        </div>
      </div>
      
      {/* Assistente AIA - painel lateral */}
      <AIAssistant />
    </>
  );
};

export default Index;
