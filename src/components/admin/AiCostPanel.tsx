import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Coins, RefreshCw, Info } from 'lucide-react';
import {
  AiCostSummary,
  DEFAULT_CREDIT_VALUE_BRL,
  formatBrl,
  formatBrlPrecise,
  formatCredits,
  formatTokens,
  formatUsd,
} from '@/lib/aiPricing';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface AiCostPanelProps {
  summary: AiCostSummary;
  totalConversations: number;
  totalRequests: number;
  onSync?: () => Promise<void>;
}

export function AiCostPanel({ summary, totalConversations, totalRequests, onSync }: AiCostPanelProps) {
  const [syncing, setSyncing] = useState(false);
  const costPerConversation = totalConversations > 0 ? summary.totalCostBrl / totalConversations : 0;
  const costPerRequest = totalRequests > 0 ? summary.totalCostBrl / totalRequests : 0;
  const syncPercentage =
    summary.realRequests + summary.estimatedRequests > 0
      ? Math.round((summary.realRequests / (summary.realRequests + summary.estimatedRequests)) * 100)
      : 0;
  const hasRealData = summary.realRequests > 0;

  const handleSync = async () => {
    if (!onSync) return;
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="bg-white rounded-xl shadow-lg border border-apolar-light-gray">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm font-medium text-apolar-dark-gray uppercase tracking-wide">
            Custo de IA no período
          </CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <div className="text-4xl font-bold text-apolar-blue">
              {formatBrl(summary.totalCostBrl)}
            </div>
            {hasRealData && (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                {syncPercentage}% real
              </Badge>
            )}
          </div>
          <p className="text-sm text-apolar-dark-gray mt-1">
            {formatCredits(summary.totalCostCredits)} créditos · {formatUsd(summary.totalCostUsd)} estimado
          </p>
          {!hasRealData && (
            <p className="text-xs text-apolar-dark-gray mt-1 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Valor estimado com base nos tokens. Sincronize com o gateway para obter o custo real.
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-14 w-14 rounded-2xl bg-apolar-gold/15 flex items-center justify-center">
            <DollarSign className="h-7 w-7 text-apolar-gold-alt" />
          </div>
          {onSync && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="text-xs border-apolar-blue/20 text-apolar-blue hover:bg-apolar-blue/5"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar custos'}
            </Button>
          )}
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

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-apolar-light-gray p-3">
            <p className="text-xs uppercase text-apolar-dark-gray">Requisições com custo real</p>
            <p className="text-lg font-semibold text-green-600">{formatTokens(summary.realRequests)}</p>
          </div>
          <div className="rounded-lg border border-apolar-light-gray p-3">
            <p className="text-xs uppercase text-apolar-dark-gray">Requisições estimadas</p>
            <p className="text-lg font-semibold text-apolar-dark-gray">{formatTokens(summary.estimatedRequests)}</p>
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
                <div className="flex items-center gap-2">
                  {m.realRequests > 0 && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                      {m.realRequests} real
                    </Badge>
                  )}
                  {m.estimatedRequests > 0 && (
                    <Badge variant="outline" className="text-apolar-dark-gray text-[10px]">
                      {m.estimatedRequests} est.
                    </Badge>
                  )}
                  <span className="text-sm font-semibold text-apolar-blue">
                    {formatBrl(m.costBrl)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {summary.requestsWithoutUsage > 0 && (
          <p className="text-xs text-apolar-dark-gray">
            {summary.requestsWithoutUsage} requisição(ões) sem registro de tokens não entram no cálculo.
          </p>
        )}

        <p className="text-xs text-apolar-dark-gray">
          Valor do crédito usado na conversão: {formatBrl(DEFAULT_CREDIT_VALUE_BRL)}.
          {hasRealData
            ? ' Custos reais vêm dos logs do Lovable AI Gateway.'
            : ' Custo ainda não sincronizado com o gateway.'}
        </p>
      </CardContent>
    </Card>
  );
}
