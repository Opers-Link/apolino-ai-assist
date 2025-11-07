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
"Identifiquei que seu caso precisa de atenção especializada. Por gentileza, siga com a abertura de um ticket por meio da plataforma Movidesk, com a seguinte descrição: [resumo detalhado do problema]"

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

[IMAGE:https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/apolar-sales-login.png]

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

[IMAGE:https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/apolar-sales-tipos-acesso.png]

🏠 3. DASHBOARD PRINCIPAL

Após o login, você verá o Dashboard com:

**Métricas principais:**
- Total de leads ativos
- Oportunidades em andamento
- Taxa de conversão
- Leads por origem
- Funil de vendas

**Atalhos rápidos:**
- Novo Lead
- Nova Oportunidade
- Meus Atendimentos
- Relatórios

[IMAGE:https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/apolar-sales-dashboard.png]

📋 4. MENU LATERAL

O menu lateral contém:

**🏠 Dashboard**
- Visão geral do sistema

**👥 Leads**
- Listagem de todos os leads
- Filtros avançados
- Importação/Exportação

**🎯 Oportunidades**
- Pipeline de vendas
- Acompanhamento de propostas

**📊 Relatórios**
- Relatórios gerenciais
- Análises de desempenho

**⚙️ Configurações**
- Perfil do usuário
- Notificações
- Integrações

[IMAGE:https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/apolar-sales-menu-lateral.png]

👥 5. GESTÃO DE LEADS

**O que é um Lead?**
Lead é um potencial cliente que demonstrou interesse em imóveis.

**Visualizando Leads:**
1. Clique em "Leads" no menu lateral
2. Você verá uma lista com todos os leads
3. Use os filtros para buscar leads específicos

**Filtros disponíveis:**
- Status (Novo, Em contato, Qualificado, Perdido)
- Origem (Site, Telefone, WhatsApp, Indicação)
- Corretor responsável
- Data de cadastro
- Tipo de imóvel de interesse

[IMAGE:https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/apolar-sales-leads.png]

➕ 6. CRIANDO UM NOVO LEAD

**Passo a passo:**

1. Clique no botão "+ Novo Lead" (canto superior direito)

2. **Dados Pessoais:**
   - Nome completo *obrigatório
   - E-mail
   - Telefone *obrigatório
   - CPF
   - Data de nascimento

3. **Informações de Interesse:**
   - Tipo de imóvel (Apartamento, Casa, Terreno, Comercial)
   - Finalidade (Compra, Aluguel, Temporada)
   - Faixa de preço
   - Bairros de interesse
   - Número de quartos desejados

4. **Origem do Lead:**
   - Como conheceu a Apolar?
   - Campanha de marketing (se aplicável)

5. **Observações:**
   - Campo livre para anotações importantes
   - Preferências específicas do cliente

6. Clique em "Salvar Lead"

[IMAGE:https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/apolar-sales-criar-lead.png]

**Importante:**
- Campos marcados com * são obrigatórios
- O sistema atribui automaticamente um ID único ao lead
- O corretor logado é definido como responsável automaticamente

[IMAGE:https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/apolar-sales-lead-form.png]

📝 7. ACOMPANHAMENTO DE LEADS

**Visualizando detalhes:**
1. Clique sobre qualquer lead na listagem
2. Você verá a tela de detalhes com:
   - Informações completas do lead
   - Histórico de interações
   - Imóveis apresentados
   - Próximas tarefas

**Registrando atendimento:**
1. Na tela do lead, clique em "+ Nova Interação"
2. Selecione o tipo:
   - Ligação
   - WhatsApp
   - E-mail
   - Visita presencial
   - Vistoria em imóvel
3. Descreva o que foi conversado
4. Defina próxima ação (se necessário)
5. Salve a interação

[IMAGE:https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/apolar-sales-lead-detalhes.png]

**Alterando status do lead:**
- Novo → Lead acabou de entrar no sistema
- Em contato → Primeiro contato realizado
- Qualificado → Lead tem real interesse e potencial
- Visitou → Cliente visitou imóvel(s)
- Proposta → Proposta enviada/em análise
- Ganho → Venda/Locação concretizada
- Perdido → Lead desistiu ou não qualificado

═══════════════════════════════════════════════════════
📗 TUTORIAL: CHAVES E RESERVA
═══════════════════════════════════════════════════════

🔑 PROCESSO DE ENTREGA DE CHAVES

**Quando entregar chaves:**
- Cliente precisa visitar imóvel sozinho
- Vistoria técnica agendada
- Cliente já alugou/comprou e vai receber o imóvel

**Passo a passo:**

1. **No Apolar NET:**
   - Acesse módulo "Locação" ou "Vendas"
   - Busque o imóvel pelo código
   - Clique em "Gestão de Chaves"

2. **Registrar saída da chave:**
   - Data e hora da entrega
   - Nome completo do cliente
   - CPF ou RG
   - Telefone de contato
   - Motivo (Visita, Vistoria, Entrega)
   - Observações

3. **Termo de responsabilidade:**
   - Sistema gera termo automaticamente
   - Cliente deve assinar
   - Guarde cópia digitalizada

4. **Registrar devolução:**
   - Ao receber a chave de volta
   - Conferir estado da chave
   - Registrar data/hora de devolução
   - Anotar observações (se houver danos)

[IMAGE:https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/tutorial-chaves-entrega.png]

**⚠️ ATENÇÃO:**
- NUNCA entregar chave sem registro no sistema
- SEMPRE conferir identificação do cliente
- Em caso de perda, comunicar imediatamente o proprietário
- Chaves devem retornar em no máximo 24 horas

═══════════════════════════════════════════════════════
📙 TUTORIAL: LANÇAMENTOS
═══════════════════════════════════════════════════════

🏗️ GESTÃO DE LANÇAMENTOS IMOBILIÁRIOS

**O que são lançamentos:**
Empreendimentos novos (em construção ou na planta) que a Apolar comercializa.

**Cadastrando um lançamento:**

1. **Acesse Apolar NET → Lançamentos → Novo Lançamento**

2. **Dados do Empreendimento:**
   - Nome do empreendimento *
   - Construtora/incorporadora *
   - Endereço completo
   - Bairro e cidade
   - Data de lançamento
   - Previsão de entrega
   - Status (Em lançamento, Em construção, Pronto)

3. **Informações Técnicas:**
   - Número total de unidades
   - Torres/blocos
   - Tipos de unidades (studios, 1 dorm, 2 dorm, etc.)
   - Metragem de cada tipo
   - Características (vagas, suítes, etc.)

4. **Valores e Condições:**
   - Tabela de preços
   - Formas de pagamento
   - Condições especiais
   - Descontos vigentes

5. **Material de Divulgação:**
   - Upload de plantas
   - Fotos da obra
   - Tour virtual (link)
   - Memorial descritivo
   - Folder digital

[IMAGE:https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/tutorial-lancamentos-processo.png]

**Vinculando leads ao lançamento:**
- Ao criar lead interessado em lançamento
- Selecione o empreendimento específico
- Sistema registra automaticamente
- Relatórios de interesse por lançamento disponíveis

**Acompanhamento de vendas:**
- Dashboard específico por lançamento
- Unidades disponíveis vs. vendidas
- Pipeline de propostas
- Ranking de corretores

═══════════════════════════════════════════════════════
📕 TUTORIAL: RESERVA E PROPOSTA (BR 2025 V 1.0)
═══════════════════════════════════════════════════════

📋 PROCESSO DE RESERVA E PROPOSTA

**Diferença entre Reserva e Proposta:**

**RESERVA:**
- Demonstração de interesse do cliente
- "Segurar" o imóvel temporariamente
- Prazo: geralmente 7 dias
- Pode exigir sinal ou não
- Não é contrato definitivo

**PROPOSTA:**
- Oferta formal de compra/locação
- Contém valores e condições
- Enviada ao proprietário para análise
- Pode ser aceita, recusada ou contrariada

**FLUXO COMPLETO:**

1. **Cliente escolhe imóvel**
   ↓
2. **Corretor registra interesse no sistema**
   ↓
3. **Reserva do imóvel (opcional)**
   - Sistema bloqueia imóvel para outros corretores
   - Prazo de 7 dias para formalizar proposta
   ↓
4. **Elaboração da proposta**
   - Dados do proponente
   - Valor ofertado
   - Forma de pagamento
   - Condições especiais
   ↓
5. **Envio para análise do proprietário**
   - Sistema notifica proprietário
   - Prazo para resposta: 48h
   ↓
6. **Resposta do proprietário**
   - ✅ Aceita → Prosseguir para contrato
   - ❌ Recusada → Informar cliente
   - 🔄 Contraproposta → Negociar

[IMAGE:https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/tutorial-reserva-fluxo.png]

**REGISTRANDO RESERVA NO SISTEMA:**

1. No cadastro do lead/oportunidade
2. Clique em "Fazer Reserva"
3. Preencha:
   - Código do imóvel
   - Valor do sinal (se houver)
   - Data da reserva
   - Prazo de validade
4. Sistema envia e-mail automático ao proprietário
5. Imóvel fica "Reservado" no sistema

**CRIANDO PROPOSTA:**

1. Acesse o lead/oportunidade
2. Clique em "Nova Proposta"
3. Selecione o imóvel
4. **Dados do Proponente:**
   - Nome completo
   - CPF/CNPJ
   - Endereço atual
   - Profissão e renda
   - Referências pessoais

5. **Condições da Proposta:**
   - Valor ofertado (compra/aluguel)
   - Valor de entrada (se compra)
   - Financiamento? Qual banco?
   - FGTS? Qual valor?
   - Data desejada para entrada

6. **Observações:**
   - Condições especiais
   - Pedidos específicos

7. **Anexos:**
   - Documentos do proponente
   - Comprovante de renda
   - Referências bancárias

8. Clique em "Enviar Proposta"
9. Sistema gera PDF automático
10. Proprietário recebe notificação por e-mail

**IMPORTANTE:**
⚠️ Reserva NÃO garante aprovação
⚠️ Sempre conferir documentação antes de enviar proposta
⚠️ Manter cliente informado sobre status da proposta
⚠️ Após aceite, agendar assinatura de contrato em até 48h

═══════════════════════════════════════════════════════

💡 DICAS IMPORTANTES

**Sempre:**
✅ Registre TODAS as interações com o cliente
✅ Mantenha dados atualizados no sistema
✅ Responda leads em até 5 minutos (quando possível)
✅ Use o WhatsApp Business integrado ao CRM
✅ Acompanhe métricas do seu desempenho

**Nunca:**
❌ Compartilhe dados pessoais de clientes
❌ Prometa algo que não pode cumprir
❌ Deixe leads sem acompanhamento
❌ Esqueça de registrar vistorias e atendimentos

**Em caso de dúvidas:**
📞 Contate o suporte pelo Movidesk
💬 Use este chat para tirar dúvidas rápidas
📧 E-mail: suporte@apolar.com.br

═══════════════════════════════════════════════════════

🖼️ INSTRUÇÕES PARA EXIBIÇÃO DE IMAGENS

Quando você quiser mostrar uma imagem dos manuais para ajudar na explicação:
1. Mencione a imagem na resposta usando: [IMAGE:URL_DA_IMAGEM]
2. O sistema renderizará a imagem automaticamente
3. Use imagens para:
   - Mostrar telas do sistema
   - Ilustrar processos passo a passo
   - Esclarecer dúvidas sobre localização de funcionalidades

Exemplo de uso:
"Para acessar o dashboard, você verá esta tela após o login:
[IMAGE:https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/apolar-sales-dashboard.png]"

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