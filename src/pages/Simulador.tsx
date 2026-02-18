import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SimulatorForm, { type SimulationParams } from "@/components/simulator/SimulatorForm";
import SimulationResults from "@/components/simulator/SimulationResults";
import apolarLogo from "@/assets/apolar-logo-oficial.png";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Simulador = () => {
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSimulate = async (params: SimulationParams) => {
    setIsLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("simulate-financing", {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResults(data);
    } catch (err: any) {
      console.error("Simulation error:", err);
      toast({
        title: "Erro na simulação",
        description: err.message || "Não foi possível realizar a simulação.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[hsl(var(--apolar-blue))] shadow-md">
        <div className="max-w-6xl mx-auto flex items-center gap-4 h-16 px-4">
          <Link to="/" className="text-white hover:text-white/80 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <img src={apolarLogo} alt="Apolar" className="h-8" />
          <h1 className="text-white text-lg font-semibold m-0" style={{ fontSize: "18px" }}>
            Simulador de Financiamento
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <SimulatorForm onSimulate={handleSimulate} isLoading={isLoading} />
        <SimulationResults results={results} />
      </main>
    </div>
  );
};

export default Simulador;
