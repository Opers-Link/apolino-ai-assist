import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Coins } from 'lucide-react';
import {
  AiCostSummary,
  USD_TO_BRL,
  formatBrl,
  formatBrlPrecise,
  formatTokens,
  formatUsd,
} from '@/lib/aiPricing';

interface AiCostPanelProps {
  summary: AiCostSummary;
  totalConversations: number;
  totalRequests: number;
}

export function AiCostPanel({ summary, totalConversations, totalRequests }: AiCostPanelProps) {
  const costPerConversation = totalConversations > 0 ? summary.totalCostBrl / totalConversations : 0;
  const costPerRequest = totalRequests > 0 ? summary.totalCostBrl / totalRequests : 0;

  return (
    <Card className="bg-white rounded-xl shadow-lg border border-apolar-light-gray">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm font-medium text-apolar-dark-gray uppercase tracking-wide">
            Custo de IA no período
          </CardTitle>
          <div className="text-4xl font-bold text-apolar-blue mt-2">
            {formatBrl(summary.totalCostBrl)}
          </div>
          <p className="text-sm text-apolar-dark-gray mt-1">
            {formatUsd(summary.totalCostUsd)} · câmbio US$ 1 = {formatBrl(USD_TO_BRL)}
          </p>
        </div>
        <div className="h-14 w-14 rounded-2xl bg-apolar-gold/15 flex items-center justify-center">
          <DollarSign className="h-7 w-7 text-apolar-gold-alt" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-apolar-light-gray p-3">
            <p className="text-xs uppercase text-apolar-dark-gray">Custo por conversa</p>
            <p className="text-lg font-semibold text-apolar-blue">{formatBrlPrecise(costPerConversation)}</p>
          </div>
          <div className="rounded-lg border border-apolar-light-gray p-3">
            <p className="text-xs uppercase text-apolar-dark-gray">Custo por requisição</p>
            <p className="text-lg font-semibold text-apolar-blue">{formatBrlPrecise(costPerRequest)}</p>
          </div>
          <div className="rounded-lg border border-apolar-light-gray p-3">
            <p className="text-xs uppercase text-apolar-dark-gray">Tokens de entrada</p>
            <p className="text-lg font-semibold text-apolar-blue">{formatTokens(summary.promptTokens)}</p>
          </div>
          <div className="rounded-lg border border-apolar-light-gray p-3">
            <p className="text-xs uppercase text-apolar-dark-gray">Tokens de saída</p>
            <p className="text-lg font-semibold text-apolar-blue">{formatTokens(summary.completionTokens)}</p>
          </div>
        </div>

        {summary.byModel.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-apolar-dark-gray flex items-center gap-2">
              <Coins className="h-4 w-4 text-apolar-gold-alt" /> Detalhamento por modelo
            </p>
            {summary.byModel.map((m) => (
              <div
                key={m.model}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-apolar-light-gray/40 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-apolar-blue/20 text-apolar-blue">
                    {m.model}
                  </Badge>
                  <span className="text-xs text-apolar-dark-gray">
                    {m.requests} req · {formatTokens(m.promptTokens + m.completionTokens)} tokens
                  </span>
                </div>
                <span className="text-sm font-semibold text-apolar-blue">
                  {formatBrl(m.costUsd * USD_TO_BRL)}
                </span>
              </div>
            ))}
          </div>
        )}

        {summary.requestsWithoutUsage > 0 && (
          <p className="text-xs text-apolar-dark-gray">
            {summary.requestsWithoutUsage} requisição(ões) sem registro de tokens não entram no cálculo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
