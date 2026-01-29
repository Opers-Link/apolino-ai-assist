import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { module_id, question_count = 10 } = await req.json();

    if (!module_id) {
      return new Response(
        JSON.stringify({ error: 'module_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar o módulo e seus arquivos
    const { data: module, error: moduleError } = await supabase
      .from('knowledge_modules')
      .select('id, name, variable_name, version')
      .eq('id', module_id)
      .single();

    if (moduleError || !module) {
      return new Response(
        JSON.stringify({ error: 'Módulo não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar texto extraído dos arquivos do módulo
    const { data: files, error: filesError } = await supabase
      .from('knowledge_module_files')
      .select('file_name, extracted_text')
      .eq('module_id', module_id);

    if (filesError) {
      console.error('Erro ao buscar arquivos:', filesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar arquivos do módulo' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Concatenar todo o texto extraído
    const extractedContent = files
      ?.filter(f => f.extracted_text)
      .map(f => f.extracted_text)
      .join('\n\n');

    if (!extractedContent || extractedContent.trim().length < 100) {
      return new Response(
        JSON.stringify({ error: 'Conteúdo insuficiente no módulo. Certifique-se de que os PDFs foram processados.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limitar o conteúdo para evitar excesso de tokens (máximo ~20k caracteres)
    const contentLimit = 20000;
    const truncatedContent = extractedContent.length > contentLimit 
      ? extractedContent.substring(0, contentLimit) + '\n\n[... conteúdo truncado para processamento ...]'
      : extractedContent;

    // Prompt para geração de FAQ
    const systemPrompt = `Você é um especialista em criar FAQs claros e úteis para sistemas de help desk imobiliário.
Analise o conteúdo do manual fornecido e gere ${question_count} perguntas frequentes que os usuários provavelmente fariam.

REGRAS:
1. Cada pergunta deve ser objetiva e representar uma dúvida real de usuário
2. As respostas devem ser concisas (máximo 3-4 frases) e práticas
3. Foque em procedimentos, como fazer tarefas, e resolver problemas comuns
4. Use linguagem simples e profissional
5. Evite jargões técnicos desnecessários
6. Ordene por relevância/frequência esperada

Retorne EXATAMENTE um JSON array com objetos contendo "question" e "answer".`;

    const userPrompt = `Baseado no conteúdo abaixo do manual "${module.name}", gere ${question_count} perguntas frequentes com respostas:

CONTEÚDO DO MANUAL:
${truncatedContent}

Retorne APENAS o JSON array, sem texto adicional:
[{"question": "...", "answer": "..."}, ...]`;

    // Chamar Lovable AI
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
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes para processamento de IA.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('Erro da IA:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair JSON da resposta (pode vir com markdown)
    let questions: Array<{ question: string; answer: string }> = [];
    try {
      // Tentar extrair JSON de bloco markdown
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      questions = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Erro ao parsear resposta da IA:', parseError);
      console.log('Conteúdo recebido:', content);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar resposta da IA. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar estrutura
    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma pergunta foi gerada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Garantir que todas as perguntas têm a estrutura correta
    const validQuestions = questions
      .filter(q => q.question && q.answer && typeof q.question === 'string' && typeof q.answer === 'string')
      .map(q => ({
        question: q.question.trim(),
        answer: q.answer.trim()
      }));

    return new Response(
      JSON.stringify({
        success: true,
        module_name: module.name,
        module_version: module.version,
        questions: validQuestions
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função generate-faq-from-knowledge:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
