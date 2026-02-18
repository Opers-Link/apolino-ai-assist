import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Home } from "lucide-react";

export interface SimulationParams {
  propertyValue: number;
  downPayment: number;
  termMonths: number;
  grossIncome: number;
  propertyType: "novo" | "usado";
  firstProperty: boolean;
  fgtsAmount: number;
}

interface SimulatorFormProps {
  onSimulate: (params: SimulationParams) => void;
  isLoading: boolean;
}

function parseCurrency(value: string): number {
  return Number(value.replace(/\D/g, "")) / 100;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CurrencyInput({ value, onChange, id, placeholder }: { value: number; onChange: (v: number) => void; id: string; placeholder?: string }) {
  const [display, setDisplay] = useState(value > 0 ? formatCurrency(value) : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) { setDisplay(""); onChange(0); return; }
    const num = Number(raw) / 100;
    setDisplay(formatCurrency(num));
    onChange(num);
  };

  return <Input id={id} value={display} onChange={handleChange} placeholder={placeholder || "R$ 0,00"} />;
}

const SimulatorForm = ({ onSimulate, isLoading }: SimulatorFormProps) => {
  const [propertyValue, setPropertyValue] = useState(0);
  const [downPayment, setDownPayment] = useState(0);
  const [termYears, setTermYears] = useState("30");
  const [grossIncome, setGrossIncome] = useState(0);
  const [propertyType, setPropertyType] = useState<"novo" | "usado">("usado");
  const [firstProperty, setFirstProperty] = useState(true);
  const [fgtsAmount, setFgtsAmount] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSimulate({
      propertyValue,
      downPayment,
      termMonths: Number(termYears) * 12,
      grossIncome,
      propertyType,
      firstProperty,
      fgtsAmount,
    });
  };

  const downPaymentPercent = propertyValue > 0 ? ((downPayment / propertyValue) * 100).toFixed(1) : "0";
  const financedAmount = Math.max(0, propertyValue - downPayment - fgtsAmount);

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Home className="w-5 h-5 text-[hsl(var(--apolar-blue))]" />
          Dados da Simulação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="propertyValue">Valor do Imóvel</Label>
              <CurrencyInput id="propertyValue" value={propertyValue} onChange={setPropertyValue} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="downPayment">Entrada ({downPaymentPercent}%)</Label>
              <CurrencyInput id="downPayment" value={downPayment} onChange={setDownPayment} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grossIncome">Renda Bruta Familiar</Label>
              <CurrencyInput id="grossIncome" value={grossIncome} onChange={setGrossIncome} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="termYears">Prazo (anos)</Label>
              <Select value={termYears} onValueChange={setTermYears}>
                <SelectTrigger id="termYears">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 25, 30, 35].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y} anos ({y * 12} meses)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fgts">FGTS Disponível (opcional)</Label>
              <CurrencyInput id="fgts" value={fgtsAmount} onChange={setFgtsAmount} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="propertyType">Tipo do Imóvel</Label>
              <Select value={propertyType} onValueChange={(v) => setPropertyType(v as "novo" | "usado")}>
                <SelectTrigger id="propertyType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="usado">Usado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Switch id="firstProperty" checked={firstProperty} onCheckedChange={setFirstProperty} />
            <Label htmlFor="firstProperty" className="cursor-pointer">Primeira propriedade</Label>
          </div>

          {propertyValue > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor financiado:</span>
                <span className="font-medium">{formatCurrency(financedAmount)}</span>
              </div>
              {fgtsAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">FGTS utilizado:</span>
                  <span className="font-medium">{formatCurrency(fgtsAmount)}</span>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || propertyValue <= 0 || downPayment <= 0 || grossIncome <= 0}
            className="w-full bg-[hsl(var(--apolar-blue))] hover:bg-[hsl(var(--apolar-blue))/0.9] text-white"
          >
            <Calculator className="w-4 h-4 mr-2" />
            {isLoading ? "Simulando..." : "Simular Financiamento"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SimulatorForm;
