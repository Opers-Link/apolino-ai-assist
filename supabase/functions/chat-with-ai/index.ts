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
const RATE_LIMIT_REQUESTS = 200;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

// ============ OTIMIZAÇÃO: Modelo mais rápido ============
const AI_MODEL = 'google/gemini-3-flash-preview';

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const sessionId = userContext?.userId || conversationId || `ip_${clientIP}`;

    // ============ OTIMIZAÇÃO A: Paralelizar queries iniciais ============
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
    
    // Executar rate limit, conversation check e busca de dados em paralelo
    const [rateLimitResult, conversationCheck, promptData, modulesData, allModuleFiles, configData] = await Promise.all([
      // 1. Rate limit
      checkRateLimit(supabase, sessionId),
      // 2. Conversation check (se temos conversationId)
      conversationId 
        ? supabase.from('chat_conversations').select('ai_enabled, assigned_to').eq('id', conversationId).single()
        : Promise.resolve({ data: null }),
      // 3. System prompt
      supabase.from('system_prompts').select('content').eq('name', 'master_prompt_aia').eq('is_active', true).single(),
      // 4. Knowledge modules
      supabase.from('knowledge_modules').select('id, name, variable_name, version, description').order('display_order'),
      // 5. OTIMIZAÇÃO B: Query ÚNICA para TODOS os arquivos de módulos
      supabase.from('knowledge_module_files').select('module_id, file_name, extracted_text').order('uploaded_at', { ascending: false }),
      // 6. Knowledge config
      supabase.from('knowledge_config').select('key, value'),
    ]);

    // Verificar rate limit
    if (!rateLimitResult.allowed) {
      console.warn('Rate limit exceeded for session:', sessionId);
      return new Response(
        JSON.stringify({ 
          error: 'Limite de requisições excedido. Tente novamente em 1 hora.',
          retryAfter: 3600
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' } 
        }
      );
    }

    // Verificar se IA está desabilitada
    if (conversationCheck.data && conversationCheck.data.ai_enabled === false) {
      console.log('AI disabled for this conversation');
      return new Response(
        JSON.stringify({ 
          error: 'Esta conversa está sendo atendida por um humano. Aguarde o atendente.',
          assigned: true 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Montar módulos com arquivos (sem loop de queries)
    const modules = (modulesData.data || []).map((mod: any) => ({
      ...mod,
      files: (allModuleFiles.data || []).filter((f: any) => f.module_id === mod.id)
    }));

    const config: Record<string, string> = {};
    (configData.data || []).forEach((item: any) => { config[item.key] = item.value; });

    // ============ OTIMIZAÇÃO C: Classificação APENAS por keywords (sem IA) ============
    let modulesUsed: string[] = [];
    let classificationMethod: 'keywords' | 'none' = 'none';

    if (modules.length > 0) {
      const keywordModules = classifyModulesByKeywords(lastUserMessage);
      if (keywordModules.length > 0) {
        modulesUsed = keywordModules;
        classificationMethod = 'keywords';
        console.log(`Module classification by keywords: ${keywordModules.join(', ')}`);
      } else {
        // Fallback direto: GPT responde com conhecimento próprio (sem chamada de IA extra)
        console.log('No keyword match - GPT will use own knowledge (no AI classification call)');
      }
    }

    // Montar prompt do sistema
    const systemPrompt = buildFinalPrompt(
      promptData.data?.content,
      modules,
      config,
      modulesUsed,
      classificationMethod,
      userContext,
      lastUserMessage,
      supabase
    );

    // Buscar profile name em paralelo com o financing context (se necessário)
    const needsFinancing = hasFinancingIntent(lastUserMessage);
    const [resolvedPrompt] = await Promise.all([
      resolvePromptAsync(systemPrompt, userContext, supabase, needsFinancing),
    ]);

    const fullMessages = [
      { role: 'system' as const, content: resolvedPrompt },
      ...messages
    ];

    console.log('Making Lovable AI request with', fullMessages.length, 'messages');

    // ============ OTIMIZAÇÃO D+E: Modelo rápido + limitar tokens ============
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: fullMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 1500,
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

    // Log de uso (fire-and-forget, não bloqueia a resposta)
    supabase.from('ai_usage_logs').insert({
      conversation_id: conversationId || null,
      session_id: sessionId,
      model: AI_MODEL,
      has_knowledge_modules: modulesUsed.length > 0,
      success: true
    }).then(({ error: logError }: any) => {
      if (logError) console.error('Erro ao registrar uso de IA:', logError);
    });

    console.log(`Modules loaded: ${classificationMethod === 'none' ? 'NONE (GPT knowledge only)' : modulesUsed.join(', ')} (method: ${classificationMethod})`);

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Error in chat-with-ai function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('ai_usage_logs').insert({
        session_id: null,
        model: AI_MODEL,
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
  ],
  'MODULO_SIMULADOR_FINANCIAMENTO': [
    'simular', 'simulação', 'simulacao', 'simulador', 'financiamento', 'financiar',
    'parcela', 'parcelas', 'prestação', 'prestacao', 'quanto fico pagando',
    'taxa de juros', 'juros', 'sac', 'price', 'tabela sac', 'tabela price',
    'caixa', 'banco do brasil', 'itaú', 'itau', 'bradesco', 'santander',
    'entrada imóvel', 'entrada imovel', 'valor de entrada', 'minha casa minha vida',
    'mcmv', 'pro-cotista', 'fgts', 'renda', 'comprometimento de renda',
    'amortização', 'amortizacao', 'saldo devedor', 'cet', 'custo efetivo',
    'financiar imóvel', 'financiar imovel', 'crédito imobiliário', 'credito imobiliario'
  ]
};

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
  
  // Se não encontrou nada específico além do transversal, retorna vazio
  if (relevantModules.size === 1) {
    return [];
  }
  
  return Array.from(relevantModules);
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

// Detectar intenção de simulação de financiamento
const FINANCING_KEYWORDS = [
  'simular', 'simulação', 'simulacao', 'simulador', 'financiamento', 'financiar',
  'parcela', 'prestação', 'prestacao', 'quanto fico pagando', 'quanto vou pagar',
  'taxa de juros', 'sac', 'price', 'caixa', 'banco do brasil', 'itaú', 'itau',
  'bradesco', 'santander', 'minha casa', 'mcmv', 'pro-cotista', 'fgts',
  'crédito imobiliário', 'credito imobiliario', 'financiar imóvel', 'financiar imovel'
];

function hasFinancingIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return FINANCING_KEYWORDS.some(kw => lower.includes(kw));
}

async function getFinancingContext(supabase: any): Promise<string> {
  try {
    const { data: rates, error } = await supabase
      .from('bank_rates')
      .select('bank_name, bank_code, modality, min_rate, max_rate, max_ltv, max_term_months, max_income_ratio, notes')
      .eq('is_active', true);

    if (error || !rates?.length) return '';

    let ctx = `\n\n🏦 SIMULADOR DE FINANCIAMENTO IMOBILIÁRIO\n`;
    ctx += `═══════════════════════════════════════════════════════\n\n`;
    ctx += `Você tem acesso a um simulador de financiamento com dados dos seguintes bancos:\n\n`;
    
    for (const r of rates) {
      ctx += `• **${r.bank_name}** (${r.modality}): Taxa ${r.min_rate}% a ${r.max_rate}% a.a. | `;
      ctx += `LTV máx ${(r.max_ltv * 100).toFixed(0)}% | Prazo máx ${Math.floor(r.max_term_months / 12)} anos\n`;
    }

    ctx += `\n**INSTRUÇÕES PARA SIMULAÇÃO:**\n`;
    ctx += `Quando o usuário quiser simular financiamento, colete as seguintes informações:\n`;
    ctx += `1. Valor do imóvel\n2. Valor de entrada (ou percentual)\n3. Prazo desejado (em anos ou meses)\n`;
    ctx += `4. Renda bruta familiar\n5. Tipo do imóvel (novo ou usado) - opcional\n`;
    ctx += `6. Se é primeira propriedade - opcional\n7. FGTS disponível - opcional\n\n`;
    ctx += `Após coletar os dados, informe ao usuário que ele pode usar o **Simulador de Financiamento** `;
    ctx += `disponível em /simulador para ver uma comparação detalhada entre todos os bancos.\n`;
    ctx += `Enquanto isso, você pode dar estimativas rápidas com base nas taxas acima.\n\n`;
    ctx += `**Fórmulas de referência:**\n`;
    ctx += `- SAC: Amortização fixa = Valor Financiado / Meses. Parcela decresce.\n`;
    ctx += `- Price: Parcela fixa = VP × [i(1+i)^n] / [(1+i)^n - 1]\n`;
    ctx += `- Comprometimento de renda: máximo 30% da renda bruta\n\n`;
    ctx += `**IMPORTANTE:** Sempre mencione que os valores são estimativas e que a análise de crédito `;
    ctx += `final é feita pelo banco. Recomende o simulador completo em /simulador para comparação detalhada.\n`;
    
    return ctx;
  } catch (err) {
    console.error('Error fetching financing context:', err);
    return '';
  }
}

// Montar prompt final (síncrono, sem queries)
function buildFinalPrompt(
  customPromptContent: string | null,
  modules: any[],
  config: Record<string, string>,
  modulesUsed: string[],
  classificationMethod: 'keywords' | 'none',
  userContext?: UserContext,
  userMessage?: string,
  supabase?: any
): string {
  if (!customPromptContent) {
    return buildSystemPrompt(userContext);
  }

  let customPrompt = customPromptContent;
  
  const loadNoModules = classificationMethod === 'none';
  const loadAllModules = modulesUsed.length === 0 && !loadNoModules;
  
  // Substituir {{VERSAO_MODULOS}}
  const globalVersion = config['VERSAO_MODULOS'] || '1.0';
  customPrompt = customPrompt.replace(/\{\{VERSAO_MODULOS\}\}/g, globalVersion);
  
  // Substituir {{INDICE_DE_MODULOS}}
  const moduleIndex = buildModuleIndex(modules);
  customPrompt = customPrompt.replace(/\{\{INDICE_DE_MODULOS\}\}/g, moduleIndex);
  
  // Substituir variáveis de cada módulo
  let loadedModulesCount = 0;
  for (const module of modules) {
    const regex = new RegExp(`\\{\\{${module.variable_name}\\}\\}`, 'g');
    
    const shouldLoad = !loadNoModules && (loadAllModules || modulesUsed.some(
      (m: string) => m.toUpperCase() === module.variable_name.toUpperCase()
    ));
    
    if (shouldLoad) {
      const moduleContent = buildModuleContent(module);
      customPrompt = customPrompt.replace(regex, moduleContent);
      loadedModulesCount++;
    } else {
      customPrompt = customPrompt.replace(regex, 
        `[📁 Módulo "${module.name}" disponível - não carregado para esta consulta. Se precisar de informações deste módulo, pergunte especificamente sobre ${module.name.toLowerCase()}.]\n`
      );
    }
  }
  
  console.log(`Loaded ${loadedModulesCount} of ${modules.length} modules (${loadNoModules ? 'none - GPT knowledge only' : loadAllModules ? 'all' : 'selective'})`);
  
  // Substituir {{database_context}} - removido busca de contexto pesado
  customPrompt = customPrompt.replace(/\{\{database_context\}\}/g, '');
  
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
  
  // {{user_name}} será resolvido assincronamente em resolvePromptAsync
  
  return customPrompt;
}

// Resolver partes assíncronas do prompt (profile name + financing context)
async function resolvePromptAsync(
  prompt: string,
  userContext: UserContext | undefined,
  supabase: any,
  needsFinancing: boolean
): Promise<string> {
  let resolvedPrompt = prompt;

  // Executar profile fetch e financing context em paralelo
  const promises: Promise<any>[] = [];
  
  // Profile name
  if (userContext?.userId && prompt.includes('{{user_name}}')) {
    promises.push(
      supabase.from('profiles').select('display_name').eq('user_id', userContext.userId).single()
        .then(({ data }: any) => ({ type: 'profile', name: data?.display_name || 'Usuário' }))
    );
  } else {
    promises.push(Promise.resolve({ type: 'profile', name: 'Usuário' }));
  }

  // Financing context (only if intent detected)
  if (needsFinancing) {
    promises.push(
      getFinancingContext(supabase).then(ctx => ({ type: 'financing', ctx }))
    );
  }

  const results = await Promise.all(promises);
  
  for (const result of results) {
    if (result.type === 'profile') {
      resolvedPrompt = resolvedPrompt.replace(/\{\{user_name\}\}/g, result.name);
    }
    if (result.type === 'financing' && result.ctx) {
      resolvedPrompt += result.ctx;
      console.log('Financing context injected into prompt');
    }
  }

  return resolvedPrompt;
}

function buildSystemPrompt(userContext?: UserContext): string {
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

📞 CANAIS DE SUPORTE

- **Chatbot AIA**: Para dúvidas rápidas e procedimentos
- **Movidesk**: Para tickets técnicos e problemas complexos (https://apolarimoveis.movidesk.com/Account/Login)
- **Gestor direto**: Para questões de permissões e acessos`;

  let fullPrompt = basePrompt;

  if (userContext) {
    fullPrompt += `\n\n👤 INFORMAÇÕES DO USUÁRIO ATUAL`;
    if (userContext.userId) fullPrompt += `\n- ID: ${userContext.userId}`;
    if (userContext.currentSystem) fullPrompt += `\n- Sistema: ${userContext.currentSystem}`;
    if (userContext.permissions?.length) fullPrompt += `\n- Permissões: ${userContext.permissions.join(', ')}`;
    if (userContext.lastAction) fullPrompt += `\n- Última ação: ${userContext.lastAction}`;
  }

  return fullPrompt;
}
