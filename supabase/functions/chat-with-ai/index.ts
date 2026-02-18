import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Input validation schemas
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string()
    .min(1, 'Message cannot be empty')
    .max(10000, 'Message too long (max 10000 characters)')
});

const userContextSchema = z.object({
  userId: z.string().max(100).optional(),
  currentSystem: z.string().max(100).optional(),
  permissions: z.array(z.string().max(50)).max(20).optional(),
  lastAction: z.string().max(200).optional()
}).optional();

const requestSchema = z.object({
  messages: z.array(chatMessageSchema)
    .min(1, 'At least one message required')
    .max(50, 'Too many messages (max 50)'),
  conversationId: z.string().uuid().optional().nullable(),
  userContext: userContextSchema
});

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

// Rate limiting configuration
const RATE_LIMIT_REQUESTS = 200; // Max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window

async function checkRateLimit(supabase: any, sessionId: string): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    
    const { data: recentRequests, error } = await supabase
      .from('ai_usage_logs')
      .select('id')
      .eq('session_id', sessionId)
      .gte('created_at', windowStart);

    if (error) {
      console.error('Rate limit check error:', error);
      // Allow request if rate limit check fails (fail open for usability)
      return { allowed: true, remaining: RATE_LIMIT_REQUESTS };
    }

    const requestCount = recentRequests?.length || 0;
    const remaining = Math.max(0, RATE_LIMIT_REQUESTS - requestCount);
    
    return {
      allowed: requestCount < RATE_LIMIT_REQUESTS,
      remaining
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate request with Zod
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request format', 
          details: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages, userContext, conversationId } = validationResult.data;
    
    console.log('Received validated request:', { 
      messageCount: messages.length, 
      hasUserContext: !!userContext, 
      conversationId 
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not set');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate session ID for rate limiting (use conversationId, userContext.userId, or IP)
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const sessionId = userContext?.userId || conversationId || `ip_${clientIP}`;

    // Check rate limit
    const rateLimitResult = await checkRateLimit(supabase, sessionId);
    if (!rateLimitResult.allowed) {
      console.warn('Rate limit exceeded for session:', sessionId);
      return new Response(
        JSON.stringify({ 
          error: 'Limite de requisições excedido. Tente novamente em 1 hora.',
          retryAfter: 3600
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '3600'
          } 
        }
      );
    }

    // Verificar se IA está desabilitada para esta conversa
    if (conversationId) {
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .select('ai_enabled, assigned_to')
        .eq('id', conversationId)
        .single();

      if (conversation && conversation.ai_enabled === false) {
        console.log('AI disabled for this conversation, returning error');
        return new Response(
          JSON.stringify({ 
            error: 'Esta conversa está sendo atendida por um humano. Aguarde o atendente.',
            assigned: true 
          }),
          { 
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Buscar contexto do banco de dados
    const dbContext = await gatherDatabaseContext(supabase, userContext);
    
    // Extrair a última mensagem do usuário para classificação de módulos
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
    
    // Buscar prompt customizado do banco ou usar fallback (com seleção inteligente de módulos)
    const { prompt: systemPrompt, modulesUsed, classificationMethod } = await getSystemPrompt(
      supabase, 
      userContext, 
      dbContext,
      lastUserMessage,
      LOVABLE_API_KEY
    );
    
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
        model: 'openai/gpt-5-mini',
        messages: fullMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Entre em contato com o administrador.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('Lovable AI API error:', response.status, errorText);
      throw new Error(`Lovable AI API error: ${errorText}`);
    }

    // Registrar uso de IA (sem contagem exata de tokens pois streaming não retorna usage)
    const { error: logError } = await supabase.from('ai_usage_logs').insert({
      conversation_id: conversationId || null,
      session_id: sessionId,
      model: 'openai/gpt-5-mini',
      has_knowledge_modules: modulesUsed.length > 0,
      success: true
    });

    console.log(`Modules loaded: ${classificationMethod === 'none' ? 'NONE (GPT knowledge only)' : modulesUsed.length > 0 ? modulesUsed.join(', ') : 'ALL'} (method: ${classificationMethod})`);

    if (logError) {
      console.error('Erro ao registrar uso de IA:', logError);
    }

    // Retornar stream SSE diretamente
    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Error in chat-with-ai function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Registrar erro de uso de IA
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('ai_usage_logs').insert({
        session_id: null,
        model: 'openai/gpt-5-mini',
        success: false,
        error_message: errorMessage
      });
    } catch (logError) {
      console.error('Erro ao registrar falha de uso de IA:', logError);
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Buscar módulos de conhecimento com texto extraído
async function getKnowledgeModules(supabase: any) {
  try {
    // Buscar módulos com arquivos
    const { data: modules, error: modulesError } = await supabase
      .from('knowledge_modules')
      .select(`
        id,
        name,
        variable_name,
        version,
        description
      `)
      .order('display_order');

    if (modulesError) {
      console.error('Error fetching modules:', modulesError);
      return { modules: [], config: {} };
    }

    // Buscar arquivos com texto extraído para cada módulo
    const modulesWithContent = [];
    for (const module of modules || []) {
      const { data: files } = await supabase
        .from('knowledge_module_files')
        .select('file_name, extracted_text')
        .eq('module_id', module.id)
        .order('uploaded_at', { ascending: false });

      modulesWithContent.push({
        ...module,
        files: files || []
      });
    }

    // Buscar configuração global
    const { data: configData } = await supabase
      .from('knowledge_config')
      .select('key, value');

    const config: Record<string, string> = {};
    (configData || []).forEach((item: any) => {
      config[item.key] = item.value;
    });

  return { modules: modulesWithContent, config };
  } catch (error) {
    console.error('Error in getKnowledgeModules:', error);
    return { modules: [], config: {} };
  }
}

// Mapeamento de palavras-chave para módulos
const MODULE_KEYWORDS: Record<string, string[]> = {
  'MODULO_CRM_SALES': [
    'crm', 'sales', 'lead', 'leads', 'oportunidade', 'oportunidades', 'pipeline',
    'funil', 'vendas', 'conversão', 'prospecção', 'cliente', 'clientes',
    'atendimento', 'captação', 'cadastro cliente', 'cadastrar cliente'
  ],
  'MODULO_NET_LOCACAO': [
    'locação', 'locacao', 'aluguel', 'alugar', 'inquilino', 'locatário', 'locatario',
    'contrato locação', 'contrato aluguel', 'fiador', 'caucao', 'caução',
    'vistoria', 'rescisão', 'renovação', 'reajuste', 'despejo', 'garantia locatícia'
  ],
  'MODULO_AREA_DO_CLIENTE': [
    'área do cliente', 'area do cliente', 'portal cliente', 'acesso cliente',
    'segunda via', 'boleto', 'extrato', 'informe', 'declaração', 'ir',
    'imposto de renda', 'autoatendimento', 'meu espaço'
  ],
  'MODULO_NET_VENDAS': [
    'venda imóvel', 'venda imovel', 'compra', 'comprar', 'financiamento',
    'proposta compra', 'opção', 'opcao', 'angariação', 'angariacao',
    'captação imóvel', 'captacao imovel', 'exclusividade', 'avaliação',
    'documentação venda', 'escritura', 'certidão', 'matrícula'
  ],
  'MODULO_TRANSVERSAL': [
    'login', 'senha', 'acesso', 'permissão', 'permissao', 'usuário', 'usuario',
    'perfil', 'configuração', 'configuracao', 'geral', 'sistema', 'erro',
    'problema', 'bug', 'não funciona', 'ajuda', 'tutorial'
  ]
};

// Classificar módulos relevantes por palavras-chave
function classifyModulesByKeywords(userMessage: string): string[] {
  const messageLower = userMessage.toLowerCase();
  const relevantModules: Set<string> = new Set();
  
  for (const [moduleName, keywords] of Object.entries(MODULE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (messageLower.includes(keyword)) {
        relevantModules.add(moduleName);
        break;
      }
    }
  }
  
  // Sempre incluir MODULO_TRANSVERSAL como fallback
  relevantModules.add('MODULO_TRANSVERSAL');
  
  // Se não encontrou nada específico além do transversal, carregar todos
  if (relevantModules.size === 1) {
    return []; // Retorna vazio para indicar "carregar todos"
  }
  
  return Array.from(relevantModules);
}

// Classificar módulos usando IA (fallback para casos complexos)
async function classifyModulesWithAI(
  userMessage: string, 
  availableModules: { name: string, variable_name: string }[],
  apiKey: string
): Promise<string[]> {
  try {
    const moduleList = availableModules.map(m => `- ${m.variable_name}: ${m.name}`).join('\n');
    
    const classificationPrompt = `Analise a pergunta do usuário e retorne APENAS os nomes das variáveis dos módulos relevantes, separados por vírgula.

Módulos disponíveis:
${moduleList}

Pergunta do usuário: "${userMessage}"

Regras:
- Retorne APENAS os variable_names separados por vírgula, sem explicação
- Sempre inclua MODULO_TRANSVERSAL
- Se a pergunta for muito genérica, retorne: TODOS

Resposta (apenas os nomes):`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [{ role: 'user', content: classificationPrompt }],
        max_tokens: 100
      }),
    });

    if (!response.ok) {
      console.error('AI classification failed, loading all modules');
      return [];
    }

    const data = await response.json();
    const result = data.choices[0].message.content.trim();
    
    if (result.toUpperCase().includes('TODOS')) {
      return [];
    }
    
    const moduleNames = result.split(',').map((m: string) => m.trim().toUpperCase());
    
    // Validar que os módulos retornados existem
    const validModules = moduleNames.filter((name: string) => 
      availableModules.some(m => m.variable_name.toUpperCase() === name)
    );
    
    // Garantir que MODULO_TRANSVERSAL está incluído
    if (!validModules.includes('MODULO_TRANSVERSAL')) {
      validModules.push('MODULO_TRANSVERSAL');
    }
    
    return validModules.length > 0 ? validModules : [];
  } catch (error) {
    console.error('Error in AI classification:', error);
    return [];
  }
}

// Função principal de classificação (híbrida)
async function classifyRelevantModules(
  userMessage: string,
  availableModules: { name: string, variable_name: string }[],
  apiKey: string
): Promise<{ modules: string[], method: 'keywords' | 'ai' | 'all' | 'none' }> {
  // Primeiro: tentar classificação por palavras-chave (custo zero)
  const keywordModules = classifyModulesByKeywords(userMessage);
  
  if (keywordModules.length > 0) {
    console.log(`Module classification by keywords: ${keywordModules.join(', ')}`);
    return { modules: keywordModules, method: 'keywords' };
  }
  
  // Se palavras-chave não funcionaram, usar IA para classificar
  console.log('Keywords inconclusive, trying AI classification...');
  const aiModules = await classifyModulesWithAI(userMessage, availableModules, apiKey);
  
  if (aiModules.length > 0) {
    console.log(`Module classification by AI: ${aiModules.join(', ')}`);
    return { modules: aiModules, method: 'ai' };
  }
  
  // Fallback: não carregar nenhum módulo, GPT responde com conhecimento próprio
  console.log('No modules matched - GPT will use its own knowledge (fallback none)');
  return { modules: [], method: 'none' };
}

// Gerar índice de módulos
function buildModuleIndex(modules: any[]): string {
  if (!modules.length) return '[Nenhum módulo de conhecimento configurado]';

  let index = '📚 **ÍNDICE DE MÓDULOS DE CONHECIMENTO**\n\n';
  index += '| # | Módulo | Variável | Versão | Documentos |\n';
  index += '|---|--------|----------|--------|------------|\n';

  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    const fileCount = mod.files?.length || 0;
    const hasContent = mod.files?.some((f: any) => f.extracted_text) || false;
    const status = hasContent ? '✅' : (fileCount > 0 ? '⏳' : '❌');
    index += `| ${i + 1} | ${mod.name} | {{${mod.variable_name}}} | v${mod.version || '1.0'} | ${fileCount} ${status} |\n`;
  }

  return index;
}

// Gerar conteúdo de um módulo
function buildModuleContent(module: any): string {
  if (!module.files?.length) {
    return `[Módulo ${module.name}: Nenhum documento disponível]`;
  }

  const filesWithText = module.files.filter((f: any) => f.extracted_text);
  
  if (!filesWithText.length) {
    return `[Módulo ${module.name}: Documentos em processamento - ${module.files.length} arquivo(s)]`;
  }

  let content = `\n═══════════════════════════════════════════════════════\n`;
  content += `📘 ${module.name.toUpperCase()} - VERSÃO ${module.version || '1.0'}\n`;
  content += `═══════════════════════════════════════════════════════\n\n`;

  for (const file of filesWithText) {
    content += `--- ${file.file_name} ---\n\n`;
    content += file.extracted_text + '\n\n';
  }

  return content;
}

async function getSystemPrompt(
  supabase: any, 
  userContext?: UserContext, 
  dbContext?: string,
  userMessage?: string,
  apiKey?: string
): Promise<{ prompt: string, modulesUsed: string[], classificationMethod: 'keywords' | 'ai' | 'all' | 'none' }> {
  try {
    // Buscar prompt customizado do banco
    const { data: promptData, error } = await supabase
      .from('system_prompts')
      .select('content')
      .eq('name', 'master_prompt_aia')
      .eq('is_active', true)
      .single();

    if (error || !promptData?.content) {
      console.log('No custom prompt found, using fallback');
      return { 
        prompt: buildSystemPrompt(userContext, dbContext), 
        modulesUsed: [], 
        classificationMethod: 'all' 
      };
    }

    console.log('Using custom prompt from database');
    
    // Substituir variáveis dinâmicas
    let customPrompt = promptData.content;
    
    // Buscar módulos de conhecimento
    const { modules, config } = await getKnowledgeModules(supabase);
    console.log(`Found ${modules.length} knowledge modules`);
    
    // Classificar quais módulos são relevantes para a pergunta do usuário
    let modulesUsed: string[] = [];
    let classificationMethod: 'keywords' | 'ai' | 'all' | 'none' = 'all';
    
    if (userMessage && apiKey && modules.length > 0) {
      const classification = await classifyRelevantModules(
        userMessage,
        modules.map(m => ({ name: m.name, variable_name: m.variable_name })),
        apiKey
      );
      modulesUsed = classification.modules;
      classificationMethod = classification.method;
    }
    
    const loadAllModules = modulesUsed.length === 0 && classificationMethod !== 'none';
    const loadNoModules = classificationMethod === 'none';
    
    // Substituir {{VERSAO_MODULOS}}
    const globalVersion = config['VERSAO_MODULOS'] || '1.0';
    customPrompt = customPrompt.replace(/\{\{VERSAO_MODULOS\}\}/g, globalVersion);
    
    // Substituir {{INDICE_DE_MODULOS}}
    const moduleIndex = buildModuleIndex(modules);
    customPrompt = customPrompt.replace(/\{\{INDICE_DE_MODULOS\}\}/g, moduleIndex);
    
    // Substituir variáveis de cada módulo (carrega apenas os relevantes)
    let loadedModulesCount = 0;
    for (const module of modules) {
      const regex = new RegExp(`\\{\\{${module.variable_name}\\}\\}`, 'g');
      
      const shouldLoad = !loadNoModules && (loadAllModules || modulesUsed.some(
        m => m.toUpperCase() === module.variable_name.toUpperCase()
      ));
      
      if (shouldLoad) {
        // Carrega o conteúdo completo do módulo
        const moduleContent = buildModuleContent(module);
        customPrompt = customPrompt.replace(regex, moduleContent);
        loadedModulesCount++;
      } else {
        // Substitui por placeholder indicando que o módulo existe mas não foi carregado
        customPrompt = customPrompt.replace(regex, 
          `[📁 Módulo "${module.name}" disponível - não carregado para esta consulta. Se precisar de informações deste módulo, pergunte especificamente sobre ${module.name.toLowerCase()}.]\n`
        );
      }
    }
    
    console.log(`Loaded ${loadedModulesCount} of ${modules.length} modules (${loadNoModules ? 'none - GPT knowledge only' : loadAllModules ? 'all' : 'selective'})`);
    
    // Substituir {{database_context}}
    if (dbContext) {
      customPrompt = customPrompt.replace(/\{\{database_context\}\}/g, dbContext);
    } else {
      customPrompt = customPrompt.replace(/\{\{database_context\}\}/g, '');
    }
    
    // Substituir {{user_context}}
    if (userContext) {
      let userContextStr = '';
      if (userContext.userId) userContextStr += `- ID do usuário: ${userContext.userId}\n`;
      if (userContext.currentSystem) userContextStr += `- Sistema atual: ${userContext.currentSystem}\n`;
      if (userContext.permissions?.length) userContextStr += `- Permissões: ${userContext.permissions.join(', ')}\n`;
      if (userContext.lastAction) userContextStr += `- Última ação: ${userContext.lastAction}\n`;
      customPrompt = customPrompt.replace(/\{\{user_context\}\}/g, userContextStr || 'Contexto não disponível');
    } else {
      customPrompt = customPrompt.replace(/\{\{user_context\}\}/g, '');
    }
    
    // Substituir {{user_name}}
    if (userContext?.userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', userContext.userId)
        .single();
      
      customPrompt = customPrompt.replace(/\{\{user_name\}\}/g, profile?.display_name || 'Usuário');
    } else {
      customPrompt = customPrompt.replace(/\{\{user_name\}\}/g, 'Usuário');
    }
    
    return { 
      prompt: customPrompt, 
      modulesUsed: loadNoModules ? [] : loadAllModules ? modules.map(m => m.variable_name) : modulesUsed,
      classificationMethod 
    };
  } catch (error) {
    console.error('Error fetching custom prompt:', error);
    return { 
      prompt: buildSystemPrompt(userContext, dbContext), 
      modulesUsed: [], 
      classificationMethod: 'all' 
    };
  }
}

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
  const basePrompt = `🎯 IDENTIDADE E PROPÓSITO

Você é um assistente especializado em suporte técnico para os sistemas e procedimentos da empresa Apolar Imóveis:
- Sistemas: Apolar Sales (CRM) e Apolar NET (ERP)

Seu objetivo principal é:
✅ Ajudar usuários a utilizar os sistemas de forma eficiente
✅ Oferecer respostas claras, passo a passo, e com empatia
✅ Reduzir abertura de tickets desnecessários
✅ Orientar sobre funcionalidades dos sistemas
✅ Consultar e informar status de tickets existentes
✅ Orientar sobre procedimentos que você conhece por meio dos manuais

👥 PÚBLICO-ALVO
- Usuários internos da empresa
- Níveis de conhecimento técnico variados
- Pessoas que precisam de respostas rápidas e precisas

📋 TOM E ESTRUTURA
Tom: Profissional, amigável, claro, empático e paciente

Estrutura das respostas:
1. Saudação (apenas no primeiro contato)
2. Confirmação do problema (reformule para validar entendimento)
3. Solução passo a passo (numerada quando necessário)
4. Pergunta de follow-up (confirmar se resolveu ou se precisa de mais ajuda)

🚧 LIMITAÇÕES E ESCALAÇÃO

NÃO resolver:
❌ Problemas que requerem acesso administrativo
❌ Alterações críticas de configuração
❌ Bugs que necessitam de desenvolvimento
❌ Solicitações fora do escopo (não relacionadas ao CRM/ERP)

Como escalar:
"Identifiquei que seu caso precisa de atenção especializada. Por gentileza, siga com a abertura de um ticket por meio da plataforma Movidesk (https://apolarimoveis.movidesk.com/Account/Login), com a seguinte descrição: [resumo detalhado do problema]"

📚 MANUAIS E PROCEDIMENTOS

═══════════════════════════════════════════════════════
📘 MANUAL APOLAR SALES (CRM) - VERSÃO 01
═══════════════════════════════════════════════════════

🔐 1. ACESSO INICIAL

Para acessar o sistema Apolar Sales:

**Passo 1: Acesso pelo Apolar NET**
1. Entre no Apolar NET (sistema ERP)
2. No menu lateral, localize e clique em "Apolar Sales"
3. Você será redirecionado automaticamente

**Passo 2: Primeiro acesso**
1. Insira seu e-mail corporativo
2. Clique em "Esqueci minha senha"
3. Você receberá um e-mail com link para criar sua senha
4. Defina uma senha forte (mínimo 8 caracteres)
5. Faça login com suas credenciais

👤 2. TIPOS DE ACESSO

O sistema possui 4 níveis de acesso:

**ADMINISTRADOR**
- Acesso total ao sistema
- Gerenciamento de usuários e permissões
- Configurações globais
- Relatórios completos

**GERENTE**
- Visualização de toda a equipe
- Gestão de leads e oportunidades da área
- Relatórios gerenciais
- Aprovações de processos

**CORRETOR**
- Gestão de seus próprios leads
- Registro de atendimentos
- Acompanhamento de propostas
- Acesso a informações de imóveis

**VISUALIZADOR**
- Apenas consulta
- Sem permissão de edição
- Acesso limitado a relatórios

🔄 3. FUNCIONALIDADES PRINCIPAIS

**Dashboard**
- Visão geral de atividades
- Métricas de desempenho
- Tarefas pendentes
- Alertas importantes

**Leads**
- Cadastro de novos leads
- Qualificação e classificação
- Histórico de interações
- Distribuição automática

**Oportunidades**
- Pipeline de vendas
- Acompanhamento de propostas
- Previsão de fechamento
- Relatórios de conversão

**Imóveis**
- Consulta de disponibilidade
- Características e fotos
- Valores e condições
- Localização e entorno

❓ 4. PROBLEMAS FREQUENTES

**Problema: Não consigo fazer login**
Solução:
1. Verifique se está usando o e-mail corporativo correto
2. Tente recuperar a senha clicando em "Esqueci minha senha"
3. Limpe o cache do navegador
4. Tente em outro navegador

**Problema: Lead duplicado**
Solução:
1. Use a função de busca antes de cadastrar
2. Verifique pelo CPF, telefone ou e-mail
3. Se encontrar duplicata, solicite a mesclagem ao gestor

**Problema: Relatório não carrega**
Solução:
1. Aguarde alguns segundos
2. Reduza o período do relatório
3. Limpe o cache do navegador
4. Se persistir, abra ticket no suporte

📞 CANAIS DE SUPORTE

- **Chatbot AIA**: Para dúvidas rápidas e procedimentos
- **Movidesk**: Para tickets técnicos e problemas complexos (https://apolarimoveis.movidesk.com/Account/Login)
- **Gestor direto**: Para questões de permissões e acessos`;

  let fullPrompt = basePrompt;

  if (dbContext) {
    fullPrompt += `\n\n📊 CONTEXTO ATUAL DO SISTEMA\n${dbContext}`;
  }

  if (userContext) {
    fullPrompt += `\n\n👤 INFORMAÇÕES DO USUÁRIO ATUAL`;
    if (userContext.userId) fullPrompt += `\n- ID: ${userContext.userId}`;
    if (userContext.currentSystem) fullPrompt += `\n- Sistema: ${userContext.currentSystem}`;
    if (userContext.permissions?.length) fullPrompt += `\n- Permissões: ${userContext.permissions.join(', ')}`;
    if (userContext.lastAction) fullPrompt += `\n- Última ação: ${userContext.lastAction}`;
  }

  return fullPrompt;
}

async function saveMessages(supabase: any, conversationId: string, userMessage: string, aiResponse: string) {
  try {
    // Buscar o último message_order da conversa
    const { data: lastMessage, error: fetchError } = await supabase
      .from('chat_messages')
      .select('message_order')
      .eq('conversation_id', conversationId)
      .order('message_order', { ascending: false })
      .limit(1)
      .single();

    let nextOrder = 1;
    if (!fetchError && lastMessage) {
      nextOrder = (lastMessage.message_order || 0) + 1;
    }

    // Inserir mensagem do usuário
    const { error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        content: userMessage,
        is_user: true,
        message_order: nextOrder
      });

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError);
    }

    // Inserir resposta da IA
    const { error: aiMsgError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        content: aiResponse,
        is_user: false,
        message_order: nextOrder + 1
      });

    if (aiMsgError) {
      console.error('Error saving AI message:', aiMsgError);
    }

    // Atualizar contador de mensagens na conversa
    await supabase
      .from('chat_conversations')
      .update({ total_messages: nextOrder + 1 })
      .eq('id', conversationId);

  } catch (error) {
    console.error('Error in saveMessages:', error);
  }
}
