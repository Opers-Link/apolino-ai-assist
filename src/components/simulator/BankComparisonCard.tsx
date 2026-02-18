import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, TrendingDown, Minus } from "lucide-react";

interface BankSimulation {
  bankName: string;
  bankCode: string;
  modality: string;
  annualRate: number;
  financedAmount: number;
  termMonths: number;
  sac: {
    firstInstallment: number;
    lastInstallment: number;
    totalPaid: number;
    averageInstallment: number;
  };
  price: {
    fixedInstallment: number;
    totalPaid: number;
  };
  maxInstallment: number;
  incomeApproved: boolean;
  insuranceMonthly: number;
  adminFee: number;
  notes: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const bankColors: Record<string, string> = {
  caixa: "bg-blue-600",
  bb: "bg-yellow-500",
  itau: "bg-orange-500",
  bradesco: "bg-red-600",
  santander: "bg-red-500",
};

const BankComparisonCard = ({ sim, rank }: { sim: BankSimulation; rank: number }) => {
  return (
    <Card className={`border-border transition-shadow hover:shadow-lg ${!sim.incomeApproved ? "opacity-70" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${bankColors[sim.bankCode] || "bg-gray-400"}`} />
            <CardTitle className="text-base">{sim.bankName}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{sim.modality}</Badge>
            {rank === 0 && <Badge className="bg-[hsl(var(--apolar-gold))] text-[hsl(var(--apolar-blue))] text-xs">Melhor taxa</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {sim.incomeApproved ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle className="w-3.5 h-3.5" /> Renda compatível
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <XCircle className="w-3.5 h-3.5" /> Renda insuficiente (máx. {formatCurrency(sim.maxInstallment)})
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground">Taxa de juros anual</p>
          <p className="text-xl font-bold text-[hsl(var(--apolar-blue))]">{sim.annualRate.toFixed(2)}% a.a.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* SAC */}
          <div className="space-y-2 p-2 rounded-lg border border-border">
            <div className="flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">SAC</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">1ª parcela</p>
              <p className="font-semibold text-sm">{formatCurrency(sim.sac.firstInstallment)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Última parcela</p>
              <p className="font-semibold text-sm">{formatCurrency(sim.sac.lastInstallment)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total pago</p>
              <p className="text-xs">{formatCurrency(sim.sac.totalPaid)}</p>
            </div>
          </div>

          {/* Price */}
          <div className="space-y-2 p-2 rounded-lg border border-border">
            <div className="flex items-center gap-1">
              <Minus className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">PRICE</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Parcela fixa</p>
              <p className="font-semibold text-sm">{formatCurrency(sim.price.fixedInstallment)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">&nbsp;</p>
              <p className="font-semibold text-sm">&nbsp;</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total pago</p>
              <p className="text-xs">{formatCurrency(sim.price.totalPaid)}</p>
            </div>
          </div>
        </div>

        {sim.notes && (
          <p className="text-xs text-muted-foreground italic">{sim.notes}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default BankComparisonCard;
