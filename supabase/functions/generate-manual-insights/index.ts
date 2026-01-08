import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InsightsData {
  summary: string;
  top_topics: Array<{ topic: string; count: number; percentage: number }>;
  recurring_issues: Array<{ issue: string; frequency: number; severity: 'high' | 'medium' | 'low' }>;
  operational_gaps: Array<{ gap: string; recommendation: string }>;
  sentiment_analysis: { positive: number; neutral: number; negative: number };
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
    const { title, description, period_start, period_end, files } = payload;

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
          // Limitar para evitar tokens excessivos
          combinedContent += lines.slice(0, 100).join('\n');
          if (lines.length > 100) {
            combinedContent += `\n... (e mais ${lines.length - 100} registros)`;
          }
        } else if (file.file_type === 'txt') {
          const lines = text.split('\n').filter(l => l.trim());
          totalRecords += lines.length;
          combinedContent += `\n\n=== ARQUIVO: ${file.file_name} (TXT - ${lines.length} linhas) ===\n`;
          combinedContent += text.slice(0, 10000);
          if (text.length > 10000) {
            combinedContent += `\n... (texto truncado)`;
          }
        } else if (file.file_type === 'pdf') {
          // Para PDF, precisamos usar a função de extração existente ou processar de outra forma
          combinedContent += `\n\n=== ARQUIVO: ${file.file_name} (PDF) ===\n`;
          combinedContent += '[Conteúdo PDF - extração via texto não disponível diretamente]';
          totalRecords += 1;
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

    const systemPrompt = `Você é um analista de dados especializado em feedback de clientes e análise de pesquisas.
Sua tarefa é analisar dados fornecidos pelo usuário (feedbacks, pesquisas, avaliações, comentários, etc.) e identificar padrões, problemas recorrentes e oportunidades de melhoria.

Analise os dados fornecidos e retorne um JSON estruturado com:
1. summary: Resumo executivo em 2-3 frases sobre os principais achados
2. top_topics: Array com os 5-10 assuntos mais mencionados (topic, count estimado, percentage)
3. recurring_issues: Array com problemas recorrentes identificados (issue, frequency, severity: high/medium/low)
4. operational_gaps: Array com lacunas operacionais/oportunidades de melhoria (gap, recommendation)
5. sentiment_analysis: Objeto com distribuição de sentimento (positive, neutral, negative - em percentual)
6. trends: Array com tendências observadas (trend, direction: up/down/stable, change)

IMPORTANTE: 
- Responda APENAS com o JSON, sem texto adicional
- O JSON deve ser válido
- Adapte a análise ao tipo de dados fornecidos (pesquisas, feedbacks, avaliações, etc.)`;

    const userPrompt = `Analise os seguintes dados (${totalRecords} registros de ${files.length} arquivo(s)):

${combinedContent}

${description ? `\nContexto adicional: ${description}` : ''}
${period_start && period_end ? `\nPeríodo de referência: ${period_start} a ${period_end}` : ''}

Retorne a análise em formato JSON conforme especificado.`;

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
