import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface UserContext {
  userId?: string;
  currentSystem?: string;
  permissions?: string[];
  lastAction?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userContext, conversationId } = await req.json();
    
    console.log('Received request:', { messages, userContext, conversationId });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not set');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar contexto do banco de dados
    const dbContext = await gatherDatabaseContext(supabase, userContext);
    
    // Construir prompt do sistema com contexto do banco
    const systemPrompt = buildSystemPrompt(userContext, dbContext);
    
    const fullMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages
    ];

    console.log('Making Lovable AI request with', fullMessages.length, 'messages');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: fullMessages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Lovable AI API error:', errorData);
      
      if (response.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em instantes.');
      }
      if (response.status === 402) {
        throw new Error('Créditos insuficientes. Entre em contato com o administrador.');
      }
      
      throw new Error(`Lovable AI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('Lovable AI response received:', aiResponse.substring(0, 100) + '...');

    // Salvar mensagem do usuário e resposta da IA no banco
    if (conversationId) {
      await saveMessages(supabase, conversationId, messages[messages.length - 1].content, aiResponse);
    }

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-with-ai function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function gatherDatabaseContext(supabase: any, userContext?: UserContext) {
  let context = '';

  try {
    // Buscar estatísticas gerais do sistema
    const { data: conversationsData } = await supabase
      .from('chat_conversations')
      .select('category, sentiment, tags')
      .limit(50);

    if (conversationsData?.length) {
      const categories = [...new Set(conversationsData.map((c: any) => c.category))];
      const sentiments = [...new Set(conversationsData.map((c: any) => c.sentiment))];
      
      context += `\nEstatísticas do sistema:\n`;
      context += `- Categorias frequentes: ${categories.join(', ')}\n`;
      context += `- Sentimentos dos usuários: ${sentiments.join(', ')}\n`;
      context += `- Total de conversas recentes: ${conversationsData.length}\n`;
    }

    // Buscar perfis de usuários para entender o contexto
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('display_name, email')
      .limit(10);

    if (profilesData?.length) {
      context += `\nUsuários ativos no sistema: ${profilesData.length} perfis cadastrados\n`;
    }

    // Se temos contexto do usuário específico
    if (userContext?.userId) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('user_id', userContext.userId)
        .single();

      if (userProfile) {
        context += `\nPerfil do usuário atual:\n`;
        context += `- Nome: ${userProfile.display_name || 'Não informado'}\n`;
        context += `- Email: ${userProfile.email || 'Não informado'}\n`;
      }

      // Buscar conversas anteriores do usuário
      const { data: userConversations } = await supabase
        .from('chat_conversations')
        .select('category, sentiment, tags, total_messages')
        .eq('session_id', userContext.userId)
        .order('started_at', { ascending: false })
        .limit(5);

      if (userConversations?.length) {
        context += `\nHistórico do usuário:\n`;
        context += `- Conversas anteriores: ${userConversations.length}\n`;
        context += `- Categorias principais: ${[...new Set(userConversations.map((c: any) => c.category))].join(', ')}\n`;
      }
    }

  } catch (error) {
    console.error('Error gathering database context:', error);
    context += '\nNão foi possível acessar dados contextuais do sistema.';
  }

  return context;
}

function buildSystemPrompt(userContext?: UserContext, dbContext?: string): string {
  const basePrompt = `
Você é o Apolino, assistente virtual da Apolar Imóveis. 

INSTRUÇÕES:
- Seja sempre prestativo, profissional e amigável
- Foque em ajudar com dúvidas sobre o CRM (Apolar Sales) e ERP (Apolar Net)
- Use os dados do sistema para fornecer respostas mais precisas e personalizadas
- Se não souber algo específico, seja honesto e sugira abrir um chamado no Movidesk
- Mantenha respostas concisas (máximo 3 parágrafos)
- Use linguagem corporativa mas acessível
- Sempre pergunte se pode ajudar com mais alguma coisa

SOBRE OS SISTEMAS:
- Apolar Sales: CRM para gestão de vendas, leads, clientes e oportunidades
- Apolar Net: ERP para gestão financeira, estoque, relatórios e operações

CONTEXTO DO BANCO DE DADOS:${dbContext || ''}

CONTEXTO DO USUÁRIO:`;

  let contextInfo = '';
  if (userContext) {
    if (userContext.userId) contextInfo += `\n- Usuário: ${userContext.userId}`;
    if (userContext.currentSystem) contextInfo += `\n- Sistema atual: ${userContext.currentSystem}`;
    if (userContext.permissions?.length) contextInfo += `\n- Permissões: ${userContext.permissions.join(', ')}`;
    if (userContext.lastAction) contextInfo += `\n- Última ação: ${userContext.lastAction}`;
  }

  return basePrompt + contextInfo;
}

async function saveMessages(supabase: any, conversationId: string, userMessage: string, aiResponse: string) {
  try {
    // Buscar o número atual de mensagens na conversa
    const { data: existingMessages } = await supabase
      .from('chat_messages')
      .select('message_order')
      .eq('conversation_id', conversationId)
      .order('message_order', { ascending: false })
      .limit(1);

    const nextOrder = existingMessages?.length ? existingMessages[0].message_order + 1 : 1;

    // Salvar mensagem do usuário
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        content: userMessage,
        is_user: true,
        message_order: nextOrder,
      });

    // Salvar resposta da IA
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        content: aiResponse,
        is_user: false,
        message_order: nextOrder + 1,
      });

    // Atualizar contador de mensagens na conversa
    await supabase
      .from('chat_conversations')
      .update({ 
        total_messages: nextOrder + 1,
        status: 'active'
      })
      .eq('id', conversationId);

    console.log('Messages saved successfully');
  } catch (error) {
    console.error('Error saving messages:', error);
  }
}