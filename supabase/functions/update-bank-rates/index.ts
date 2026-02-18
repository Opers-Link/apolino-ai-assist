const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BANK_URLS: Record<string, { name: string; urls: string[] }> = {
  caixa: {
    name: 'Caixa Econômica Federal',
    urls: [
      'https://www.caixa.gov.br/voce/habitacao/taxas-credito-imobiliario/Paginas/default.aspx',
    ],
  },
  bb: {
    name: 'Banco do Brasil',
    urls: [
      'https://www.bb.com.br/site/pra-voce/emprestimos-e-financiamentos/financiamento-imobiliario/',
    ],
  },
  itau: {
    name: 'Itaú',
    urls: [
      'https://www.itau.com.br/emprestimos-financiamentos/credito-imobiliario',
    ],
  },
  bradesco: {
    name: 'Bradesco',
    urls: [
      'https://banco.bradesco/html/classic/produtos-servicos/emprestimo-e-financiamento/financiamento-imobiliario.shtm',
    ],
  },
  santander: {
    name: 'Santander',
    urls: [
      'https://www.santander.com.br/creditos-e-financiamentos/financiamento-de-imoveis',
    ],
  },
};

interface ScrapedRate {
  bank_code: string;
  bank_name: string;
  min_rate: number;
  max_rate: number;
  max_term_months: number;
  max_ltv: number;
  modality: string;
  notes: string;
}

interface RateComparison {
  bank_code: string;
  bank_name: string;
  current: Record<string, any> | null;
  scraped: ScrapedRate;
  differences: string[];
  has_changes: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'OPENAI_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.json().catch(() => ({}));
    const targetBanks: string[] = body.banks || Object.keys(BANK_URLS);

    console.log('Starting bank rates scraping for:', targetBanks);

    const results: RateComparison[] = [];
    const errors: { bank: string; error: string }[] = [];

    for (const bankCode of targetBanks) {
      const bankConfig = BANK_URLS[bankCode];
      if (!bankConfig) {
        errors.push({ bank: bankCode, error: 'Banco não encontrado na configuração' });
        continue;
      }

      console.log(`Scraping ${bankConfig.name}...`);

      try {
        // Step 1: Scrape with Firecrawl
        let combinedMarkdown = '';
        for (const url of bankConfig.urls) {
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url,
              formats: ['markdown'],
              onlyMainContent: true,
              waitFor: 3000,
            }),
          });

          const scrapeData = await scrapeResponse.json();
          if (scrapeResponse.ok && scrapeData.success) {
            const md = scrapeData.data?.markdown || scrapeData.markdown || '';
            combinedMarkdown += `\n\n--- Fonte: ${url} ---\n${md}`;
          } else {
            console.warn(`Firecrawl error for ${url}:`, scrapeData.error);
            combinedMarkdown += `\n\n--- Fonte: ${url} (erro ao extrair) ---\n`;
          }
        }

        if (!combinedMarkdown.trim()) {
          errors.push({ bank: bankCode, error: 'Nenhum conteúdo extraído das páginas' });
          continue;
        }

        // Step 2: Parse with OpenAI
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `Você é um especialista em crédito imobiliário brasileiro. Analise o conteúdo extraído de páginas de bancos e extraia as taxas de juros para financiamento imobiliário.

Retorne APENAS um JSON válido com a seguinte estrutura:
{
  "min_rate": <taxa mínima anual em decimal, ex: 0.0899 para 8.99%>,
  "max_rate": <taxa máxima anual em decimal, ex: 0.1199 para 11.99%>,
  "max_term_months": <prazo máximo em meses, ex: 420>,
  "max_ltv": <percentual máximo de financiamento em decimal, ex: 0.8 para 80%>,
  "modality": "<modalidade principal, ex: SBPE, PCVA, etc>",
  "notes": "<observações relevantes sobre taxas, condições especiais, etc>"
}

Se não encontrar alguma informação, use null para o campo. Se encontrar múltiplas modalidades, use a principal (SBPE).
Taxas devem ser anuais e em formato decimal (não percentual).`,
              },
              {
                role: 'user',
                content: `Analise o conteúdo abaixo extraído do site do ${bankConfig.name} e extraia as taxas de crédito imobiliário:\n\n${combinedMarkdown.substring(0, 8000)}`,
              },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
        });

        const openaiData = await openaiResponse.json();
        const parsed = JSON.parse(openaiData.choices?.[0]?.message?.content || '{}');

        const scrapedRate: ScrapedRate = {
          bank_code: bankCode,
          bank_name: bankConfig.name,
          min_rate: parsed.min_rate || 0,
          max_rate: parsed.max_rate || 0,
          max_term_months: parsed.max_term_months || 420,
          max_ltv: parsed.max_ltv || 0.8,
          modality: parsed.modality || 'SBPE',
          notes: parsed.notes || '',
        };

        // Step 3: Compare with current DB data
        const dbResponse = await fetch(
          `${supabaseUrl}/rest/v1/bank_rates?bank_code=eq.${bankCode}&is_active=eq.true&select=*`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );
        const currentRates = await dbResponse.json();
        const currentRate = currentRates?.[0] || null;

        const differences: string[] = [];
        if (currentRate) {
          if (scrapedRate.min_rate && Math.abs(scrapedRate.min_rate - currentRate.min_rate) > 0.001) {
            differences.push(`Taxa mínima: ${(currentRate.min_rate * 100).toFixed(2)}% → ${(scrapedRate.min_rate * 100).toFixed(2)}%`);
          }
          if (scrapedRate.max_rate && Math.abs(scrapedRate.max_rate - currentRate.max_rate) > 0.001) {
            differences.push(`Taxa máxima: ${(currentRate.max_rate * 100).toFixed(2)}% → ${(scrapedRate.max_rate * 100).toFixed(2)}%`);
          }
          if (scrapedRate.max_ltv && Math.abs(scrapedRate.max_ltv - currentRate.max_ltv) > 0.01) {
            differences.push(`LTV máximo: ${(currentRate.max_ltv * 100).toFixed(0)}% → ${(scrapedRate.max_ltv * 100).toFixed(0)}%`);
          }
          if (scrapedRate.max_term_months && scrapedRate.max_term_months !== currentRate.max_term_months) {
            differences.push(`Prazo máximo: ${currentRate.max_term_months} → ${scrapedRate.max_term_months} meses`);
          }
        } else {
          differences.push('Banco não encontrado no banco de dados atual');
        }

        results.push({
          bank_code: bankCode,
          bank_name: bankConfig.name,
          current: currentRate,
          scraped: scrapedRate,
          differences,
          has_changes: differences.length > 0,
        });

        console.log(`${bankConfig.name}: ${differences.length} diferenças encontradas`);
      } catch (bankError) {
        const msg = bankError instanceof Error ? bankError.message : 'Erro desconhecido';
        console.error(`Error processing ${bankConfig.name}:`, msg);
        errors.push({ bank: bankCode, error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        errors,
        summary: {
          total_banks: targetBanks.length,
          processed: results.length,
          with_changes: results.filter(r => r.has_changes).length,
          errors: errors.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in update-bank-rates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
