// Tabela de preços da IA (Lovable AI Gateway) em USD por 1 milhão de tokens.
// Ajuste aqui caso o modelo utilizado ou os preços mudem.
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

// Câmbio usado para converter o custo em reais.
export const USD_TO_BRL = 5.4;

export interface ModelUsageRow {
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
}

export interface ModelCostBreakdown {
  model: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export interface AiCostSummary {
  totalCostUsd: number;
  totalCostBrl: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestsWithUsage: number;
  requestsWithoutUsage: number;
  byModel: ModelCostBreakdown[];
}

export function computeAiCost(rows: ModelUsageRow[]): AiCostSummary {
  const byModel = new Map<string, ModelCostBreakdown>();
  let requestsWithUsage = 0;
  let requestsWithoutUsage = 0;

  for (const row of rows) {
    const model = row.model || 'desconhecido';
    const promptTokens = row.prompt_tokens ?? 0;
    const completionTokens = row.completion_tokens ?? 0;

    if (promptTokens === 0 && completionTokens === 0) {
      requestsWithoutUsage += 1;
    } else {
      requestsWithUsage += 1;
    }

    const price = MODEL_PRICES[model] ?? DEFAULT_MODEL_PRICE;
    const cost =
      (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output;

    const current = byModel.get(model) ?? {
      model,
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
    };
    current.requests += 1;
    current.promptTokens += promptTokens;
    current.completionTokens += completionTokens;
    current.costUsd += cost;
    byModel.set(model, current);
  }

  const list = Array.from(byModel.values()).sort((a, b) => b.costUsd - a.costUsd);
  const totalCostUsd = list.reduce((sum, m) => sum + m.costUsd, 0);
  const promptTokens = list.reduce((sum, m) => sum + m.promptTokens, 0);
  const completionTokens = list.reduce((sum, m) => sum + m.completionTokens, 0);

  return {
    totalCostUsd,
    totalCostBrl: totalCostUsd * USD_TO_BRL,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    requestsWithUsage,
    requestsWithoutUsage,
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
