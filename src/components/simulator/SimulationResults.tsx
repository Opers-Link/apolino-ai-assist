import BankComparisonCard from "./BankComparisonCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

interface SimulationResultsProps {
  results: {
    input: {
      propertyValue: number;
      downPayment: number;
      financedAmount: number;
      termMonths: number;
      grossIncome: number;
    };
    simulations: any[];
    generatedAt: string;
  } | null;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const SimulationResults = ({ results }: SimulationResultsProps) => {
  if (!results) return null;

  const { simulations, input } = results;

  if (simulations.length === 0) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Nenhum banco atende aos critérios informados. Tente aumentar a entrada ou reduzir o prazo.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5 text-[hsl(var(--apolar-blue))]" />
            Resultado da Simulação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Valor financiado</p>
              <p className="font-semibold">{formatCurrency(input.financedAmount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Entrada</p>
              <p className="font-semibold">{formatCurrency(input.downPayment)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Prazo</p>
              <p className="font-semibold">{input.termMonths / 12} anos ({input.termMonths} meses)</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Renda bruta</p>
              <p className="font-semibold">{formatCurrency(input.grossIncome)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {simulations.map((sim: any, i: number) => (
          <BankComparisonCard key={`${sim.bankCode}-${sim.modality}`} sim={sim} rank={i} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Simulação gerada em {new Date(results.generatedAt).toLocaleString("pt-BR")}. Valores aproximados sujeitos à análise de crédito.
      </p>
    </div>
  );
};

export default SimulationResults;
