// Tabela de preços da IA (Lovable AI Gateway) em USD por 1 milhão de tokens.
// Usada apenas como fallback quando o custo real em créditos ainda não foi sincronizado.
export interface ModelPrice {
  input: number; // USD / 1M tokens de entrada (prompt)
  output: number; // USD / 1M tokens de saída (completion)
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'google/gemini-3-flash-preview': { input: 0.3, output: 2.5 },
  'google/gemini-3.6-flash': { input: 0.3, output: 2.5 },
  'google/gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'google/gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'google/gemini-2.5-pro': { input: 1.25, output: 10 },
  'openai/gpt-5': { input: 1.25, output: 10 },
  'openai/gpt-5-mini': { input: 0.25, output: 2 },
  'openai/gpt-5-nano': { input: 0.05, output: 0.4 },
};

// Preço usado quando o modelo não está mapeado (fallback conservador tipo "flash")
export const DEFAULT_MODEL_PRICE: ModelPrice = { input: 0.3, output: 2.5 };

// Câmbio usado para converter o custo estimado em reais.
export const USD_TO_BRL = 5.4;

// Valor de 1 crédito Lovable em R$.
// Ajuste conforme o custo real dos créditos na sua conta Lovable.
export const DEFAULT_CREDIT_VALUE_BRL = 1.0;

export interface ModelUsageRow {
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_credits?: number | null;
  cost_brl?: number | null;
  cost_source?: string | null;
}

export interface ModelCostBreakdown {
  model: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  costCredits: number;
  costBrl: number;
  realRequests: number;
  estimatedRequests: number;
}

export interface AiCostSummary {
  totalCostUsd: number;
  totalCostBrl: number;
  totalCostCredits: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestsWithUsage: number;
  requestsWithoutUsage: number;
  realRequests: number;
  estimatedRequests: number;
  byModel: ModelCostBreakdown[];
}

export function computeAiCost(
  rows: ModelUsageRow[],
  creditValueBrl: number = DEFAULT_CREDIT_VALUE_BRL
): AiCostSummary {
  const byModel = new Map<string, ModelCostBreakdown>();
  let requestsWithUsage = 0;
  let requestsWithoutUsage = 0;
  let realRequests = 0;
  let estimatedRequests = 0;

  for (const row of rows) {
    const model = row.model || 'desconhecido';
    const promptTokens = row.prompt_tokens ?? 0;
    const completionTokens = row.completion_tokens ?? 0;
    const hasRealCost =
      row.cost_source === 'gateway' &&
      row.cost_credits !== null &&
      row.cost_credits !== undefined &&
      !isNaN(row.cost_credits);

    if (promptTokens === 0 && completionTokens === 0) {
      requestsWithoutUsage += 1;
    } else {
      requestsWithUsage += 1;
    }

    if (hasRealCost) {
      realRequests += 1;
    } else {
      estimatedRequests += 1;
    }

    // Custo: preferir real (créditos), senão estimativa por tokens
    let costUsd = 0;
    let costCredits = 0;
    let costBrl = 0;

    if (hasRealCost) {
      costCredits = row.cost_credits!;
      costBrl = row.cost_brl ?? costCredits * creditValueBrl;
      // Converter créditos para USD usando a tabela de fallback como referência aproximada
      const price = MODEL_PRICES[model] ?? DEFAULT_MODEL_PRICE;
      const tokensTotal = Math.max(promptTokens + completionTokens, 1);
      const estimatedUsdForRow =
        (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output;
      // Evitar divisão por zero: manter proporção entre USD e créditos
      if (estimatedUsdForRow > 0 && costCredits > 0) {
        costUsd = estimatedUsdForRow; // manter compatibilidade visual
      }
    } else {
      const price = MODEL_PRICES[model] ?? DEFAULT_MODEL_PRICE;
      costUsd =
        (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output;
      costBrl = costUsd * USD_TO_BRL;
    }

    const current = byModel.get(model) ?? {
      model,
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      costCredits: 0,
      costBrl: 0,
      realRequests: 0,
      estimatedRequests: 0,
    };
    current.requests += 1;
    current.promptTokens += promptTokens;
    current.completionTokens += completionTokens;
    current.costUsd += costUsd;
    current.costCredits += costCredits;
    current.costBrl += costBrl;
    if (hasRealCost) {
      current.realRequests += 1;
    } else {
      current.estimatedRequests += 1;
    }
    byModel.set(model, current);
  }

  const list = Array.from(byModel.values()).sort((a, b) => b.costBrl - a.costBrl);
  const totalCostUsd = list.reduce((sum, m) => sum + m.costUsd, 0);
  const totalCostBrl = list.reduce((sum, m) => sum + m.costBrl, 0);
  const totalCostCredits = list.reduce((sum, m) => sum + m.costCredits, 0);
  const promptTokens = list.reduce((sum, m) => sum + m.promptTokens, 0);
  const completionTokens = list.reduce((sum, m) => sum + m.completionTokens, 0);

  return {
    totalCostUsd,
    totalCostBrl,
    totalCostCredits,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    requestsWithUsage,
    requestsWithoutUsage,
    realRequests,
    estimatedRequests,
    byModel: list,
  };
}

export const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

export const formatBrl = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatBrlPrecise = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);

export const formatTokens = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

export const formatCredits = (value: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 }).format(value);
