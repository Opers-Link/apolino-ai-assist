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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { period_start, period_end } = await req.json();

    if (!period_start || !period_end) {
      return new Response(
        JSON.stringify({ error: 'period_start e period_end são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar conversas do período
    const { data: conversations, error: convError } = await supabase
      .from('chat_conversations')
      .select('id, session_id, started_at, status, category, tags, sentiment, total_messages')
      .gte('started_at', period_start)
      .lte('started_at', period_end);

    if (convError) {
      console.error('Erro ao buscar conversas:', convError);
      throw convError;
    }

    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma conversa encontrada no período' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const conversationIds = conversations.map(c => c.id);

    // Buscar mensagens das conversas
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, content, is_user, timestamp')
      .in('conversation_id', conversationIds)
      .order('timestamp', { ascending: true });

    if (msgError) {
      console.error('Erro ao buscar mensagens:', msgError);
      throw msgError;
    }

    // Agrupar mensagens por conversa
    const conversationsWithMessages = conversations.map(conv => {
      const convMessages = messages?.filter(m => m.conversation_id === conv.id) || [];
      return {
        ...conv,
        messages: convMessages.map(m => ({
          role: m.is_user ? 'user' : 'assistant',
          content: m.content
        }))
      };
    });

    // Preparar contexto para a IA
    const conversationsSummary = conversationsWithMessages.slice(0, 50).map((conv, i) => {
      const userMessages = conv.messages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('\n');
      return `[Conversa ${i + 1}]\nCategoria: ${conv.category || 'não classificada'}\nTags: ${conv.tags?.join(', ') || 'nenhuma'}\nSentimento: ${conv.sentiment || 'não avaliado'}\nMensagens do usuário:\n${userMessages.slice(0, 500)}`;
    }).join('\n\n---\n\n');

    const systemPrompt = `Você é um analista de dados especializado em suporte ao cliente da Apolar Imóveis.
Sua tarefa é analisar conversas do chatbot de suporte e identificar padrões, problemas recorrentes e oportunidades de melhoria.

CONTEXTO: A Apolar Imóveis é uma imobiliária que usa os sistemas:
- Apolar Net: sistema principal de gestão
- Apolar Sales/CRM: gerenciamento de vendas e leads
- Apolar Indique: programa de indicações

Analise as conversas fornecidas e retorne um JSON estruturado com:
1. summary: Resumo executivo em 2-3 frases sobre os principais achados
2. top_topics: Array com os 5-10 assuntos mais requisitados (topic, count estimado, percentage)
3. recurring_issues: Array com problemas recorrentes identificados (issue, frequency, severity: high/medium/low)
4. operational_gaps: Array com lacunas operacionais/treinamento (gap, recommendation)
5. sentiment_analysis: Objeto com distribuição de sentimento (positive, neutral, negative - em percentual)
6. trends: Array com tendências observadas (trend, direction: up/down/stable, change)

IMPORTANTE: Responda APENAS com o JSON, sem texto adicional. O JSON deve ser válido.`;

    const userPrompt = `Analise as seguintes ${conversations.length} conversas do período de ${period_start} a ${period_end}:

${conversationsSummary}

Retorne a análise em formato JSON conforme especificado.`;

    console.log('Chamando Lovable AI para análise de insights...');

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

    // Tentar parsear o JSON da resposta
    let insightsData: InsightsData;
    try {
      // Remover possíveis marcadores de código
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
      .from('conversation_insights')
      .insert({
        period_start,
        period_end,
        insights_data: insightsData,
        conversation_count: conversations.length,
        message_count: messages?.length || 0,
        generated_by: 'ai'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Erro ao salvar insights:', saveError);
      throw saveError;
    }

    console.log('Insights gerados e salvos com sucesso:', savedInsight.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        insight: savedInsight,
        message: `Análise de ${conversations.length} conversas concluída com sucesso`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na geração de insights:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
