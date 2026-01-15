import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InsightsData {
  summary: string;
  systems_affected?: Array<{ 
    system: string; 
    ticket_count: number; 
    main_issues: string[];
  }>;
  top_topics: Array<{ 
    topic: string; 
    count: number; 
    percentage: number;
    example_tickets?: string[];
  }>;
  recurring_issues: Array<{ 
    issue: string; 
    frequency: number; 
    severity: 'high' | 'medium' | 'low';
    probable_cause?: string;
    affected_system?: string;
  }>;
  operational_gaps: Array<{ 
    gap: string; 
    recommendation: string;
    priority?: 'alta' | 'média' | 'baixa';
    estimated_effort?: 'baixo' | 'médio' | 'alto';
  }>;
  action_plan?: Array<{
    action: string;
    responsible: string;
    priority: number;
    expected_impact: string;
  }>;
  sentiment_analysis?: { positive: number; neutral: number; negative: number };
  trends: Array<{ trend: string; direction: 'up' | 'down' | 'stable'; change: string }>;
}

interface FileInfo {
  file_path: string;
  file_name: string;
  file_type: string;
}

interface RequestPayload {
  title: string;
  description?: string;
  custom_prompt?: string;
  period_start?: string;
  period_end?: string;
  files: FileInfo[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se usuário tem permissão
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = userRoles?.map(r => r.role) || [];
    if (!roles.includes('admin') && !roles.includes('gerente')) {
      return new Response(
        JSON.stringify({ error: 'Permissão negada' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: RequestPayload = await req.json();
    const { title, description, custom_prompt, period_start, period_end, files } = payload;

    if (!title || !files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Título e arquivos são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processando ${files.length} arquivo(s) para análise...`);

    // Extrair conteúdo dos arquivos
    let combinedContent = '';
    let totalRecords = 0;

    for (const file of files) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('manual-insights-files')
          .download(file.file_path);

        if (downloadError) {
          console.error(`Erro ao baixar ${file.file_name}:`, downloadError);
          continue;
        }

        const text = await fileData.text();
        
        if (file.file_type === 'csv') {
          const lines = text.split('\n').filter(l => l.trim());
          totalRecords += Math.max(0, lines.length - 1); // Excluir header
          combinedContent += `\n\n=== ARQUIVO: ${file.file_name} (CSV - ${lines.length - 1} registros) ===\n`;
          // Aumentado de 100 para 500 linhas
          combinedContent += lines.slice(0, 500).join('\n');
          if (lines.length > 500) {
            combinedContent += `\n... (e mais ${lines.length - 500} registros)`;
          }
        } else if (file.file_type === 'txt') {
          const lines = text.split('\n').filter(l => l.trim());
          totalRecords += lines.length;
          combinedContent += `\n\n=== ARQUIVO: ${file.file_name} (TXT - ${lines.length} linhas) ===\n`;
          // Aumentado de 10.000 para 50.000 caracteres
          combinedContent += text.slice(0, 50000);
          if (text.length > 50000) {
            combinedContent += `\n... (texto truncado)`;
          }
        } else if (file.file_type === 'pdf') {
          // Extrair texto do PDF usando a função existente
          try {
            console.log(`Extraindo texto do PDF: ${file.file_name}`);
            const extractResponse = await fetch(
              `${supabaseUrl}/functions/v1/extract-pdf-text`,
              {
                method: 'POST',
                headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                  filePath: file.file_path, 
                  bucket: 'manual-insights-files' 
                }),
              }
            );
            
            if (extractResponse.ok) {
              const pdfData = await extractResponse.json();
              if (pdfData?.extractedText) {
                const pdfText = pdfData.extractedText.slice(0, 30000);
                combinedContent += `\n\n=== ARQUIVO: ${file.file_name} (PDF) ===\n${pdfText}`;
                totalRecords += 1;
                console.log(`PDF extraído com sucesso: ${pdfText.length} caracteres`);
              } else {
                console.log('Resposta do PDF sem texto extraído:', pdfData);
                combinedContent += `\n\n=== ARQUIVO: ${file.file_name} (PDF - não foi possível extrair texto) ===\n`;
              }
            } else {
              const errorText = await extractResponse.text();
              console.error(`Erro ao extrair PDF ${file.file_name}:`, extractResponse.status, errorText);
              combinedContent += `\n\n=== ARQUIVO: ${file.file_name} (PDF - erro na extração) ===\n`;
            }
          } catch (pdfError) {
            console.error(`Erro ao processar PDF ${file.file_name}:`, pdfError);
            combinedContent += `\n\n=== ARQUIVO: ${file.file_name} (PDF - não processado) ===\n`;
          }
        }
      } catch (err) {
        console.error(`Erro ao processar ${file.file_name}:`, err);
      }
    }

    if (!combinedContent.trim()) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível extrair conteúdo dos arquivos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prompt especializado para análise de tickets de suporte/TI
    const systemPrompt = `Você é um analista sênior de operações de TI especializado em suporte técnico para o setor imobiliário.
Sua tarefa é analisar dados de tickets de suporte e identificar padrões críticos, falhas recorrentes e oportunidades de melhoria.

CONTEXTO DO NEGÓCIO:
- Apolar Imóveis é uma das maiores redes de franquias imobiliárias do Brasil
- Sistemas principais: CRM Apolar Sales, NET Locação (gestão de aluguéis), NET Vendas, Área do Cliente
- Usuários: corretores, gerentes de loja, equipe administrativa, franqueados

INSTRUÇÕES DE ANÁLISE:
1. Identifique os PROBLEMAS REAIS, não apenas palavras-chave. Agrupe tickets que descrevem o mesmo problema de formas diferentes.
2. Analise o IMPACTO OPERACIONAL de cada problema (quantos usuários afetados, qual sistema, urgência).
3. Identifique PADRÕES TEMPORAIS se houver datas/horários nos dados.
4. Proponha CAUSAS RAIZ prováveis para problemas recorrentes.
5. Sugira AÇÕES CONCRETAS e priorizadas para a equipe de TI.

CRITÉRIOS DE SEVERIDADE:
- ALTA (high): Sistema indisponível, bloqueio de operação, perda de dados, afeta múltiplos usuários
- MÉDIA (medium): Funcionalidade degradada, workaround disponível, afeta usuários específicos  
- BAIXA (low): Inconveniência, melhoria desejada, documentação/treinamento

ESTRUTURA DA RESPOSTA (JSON válido):
{
  "summary": "Resumo executivo de 3-5 frases com os achados MAIS CRÍTICOS e impacto quantificado",
  "systems_affected": [{"system": "nome do sistema", "ticket_count": número, "main_issues": ["problema1", "problema2"]}],
  "top_topics": [{"topic": "descrição clara do tópico", "count": número, "percentage": percentual, "example_tickets": ["exemplo de ticket"]}],
  "recurring_issues": [{"issue": "descrição detalhada do problema", "frequency": número de ocorrências, "severity": "high/medium/low", "probable_cause": "causa raiz provável", "affected_system": "sistema afetado"}],
  "operational_gaps": [{"gap": "lacuna identificada", "recommendation": "ação específica e concreta", "priority": "alta/média/baixa", "estimated_effort": "baixo/médio/alto"}],
  "action_plan": [{"action": "ação concreta e específica", "responsible": "TI/Treinamento/Fornecedor/Processo", "priority": 1 a 5, "expected_impact": "descrição do impacto esperado"}],
  "sentiment_analysis": {"positive": percentual, "neutral": percentual, "negative": percentual},
  "trends": [{"trend": "tendência observada", "direction": "up/down/stable", "change": "descrição da mudança"}]
}

IMPORTANTE: 
- Responda APENAS com JSON válido, sem texto adicional antes ou depois
- Seja ESPECÍFICO - cite exemplos reais dos dados, evite termos vagos como "problemas de sistema"
- Quantifique sempre que possível (quantidade de tickets, percentuais, frequência)
- O action_plan deve ter no máximo 5 ações, ordenadas por prioridade (1 = mais urgente)
- Se os dados não forem tickets de TI, adapte a análise mantendo a mesma estrutura`;

    const userPrompt = `Analise os seguintes dados (${totalRecords} registros de ${files.length} arquivo(s)):

${combinedContent}

${custom_prompt ? `\n### INSTRUÇÕES ESPECÍFICAS DO USUÁRIO (PRIORIZE ESTAS INSTRUÇÕES) ###\n${custom_prompt}\n` : ''}
${description ? `\nContexto adicional fornecido pelo usuário: ${description}` : ''}
${period_start && period_end ? `\nPeríodo de referência: ${period_start} a ${period_end}` : ''}

Retorne a análise completa em formato JSON conforme a estrutura especificada.`;

    console.log('Chamando Lovable AI para análise...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro na resposta da IA:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione fundos ao workspace Lovable.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Erro na API de IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('Resposta vazia da IA');
    }

    console.log('Resposta da IA recebida, parseando JSON...');

    // Parsear JSON da resposta
    let insightsData: InsightsData;
    try {
      const cleanContent = aiContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      insightsData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Erro ao parsear JSON da IA:', parseError, 'Conteúdo:', aiContent);
      throw new Error('Resposta da IA não está em formato JSON válido');
    }

    // Salvar insights no banco
    const { data: savedInsight, error: saveError } = await supabase
      .from('manual_insights')
      .insert({
        title,
        description,
        period_start: period_start || null,
        period_end: period_end || null,
        source_files: files,
        insights_data: insightsData,
        generated_by: user.id,
        file_count: files.length,
        total_records: totalRecords
      })
      .select()
      .single();

    if (saveError) {
      console.error('Erro ao salvar insights:', saveError);
      throw saveError;
    }

    console.log('Insights manuais gerados e salvos com sucesso:', savedInsight.id);

    // Opcional: limpar arquivos após processamento
    for (const file of files) {
      await supabase.storage
        .from('manual-insights-files')
        .remove([file.file_path]);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        insight: savedInsight,
        message: `Análise de ${totalRecords} registros de ${files.length} arquivo(s) concluída com sucesso`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na geração de insights manuais:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
