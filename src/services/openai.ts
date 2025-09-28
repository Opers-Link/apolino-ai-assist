// Serviço de integração com OpenAI GPT-5
// TODO: Implementar integração completa com a API da OpenAI

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

class OpenAIService {
  private apiKey: string = '';
  private baseURL: string = 'https://api.openai.com/v1';

  constructor(apiKey?: string) {
    // TODO: Configurar chave da API via Supabase secrets (frontend não deve acessar variáveis de ambiente)
    this.apiKey = apiKey || '';
  }

  async chatCompletion(
    messages: ChatMessage[],
    userContext?: {
      userId?: string;
      currentSystem?: string;
      permissions?: string[];
      lastAction?: string;
    },
    conversationId?: string
  ): Promise<string> {
    try {
      // Chamar a edge function que integra com OpenAI e banco de dados
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data, error } = await supabase.functions.invoke('chat-with-ai', {
        body: {
          messages,
          userContext,
          conversationId
        }
      });

      if (error) {
        console.error('Erro na edge function:', error);
        throw new Error('Erro ao conectar com o serviço de IA');
      }

      if (!data?.response) {
        throw new Error('Resposta inválida do serviço de IA');
      }

      return data.response;
      
    } catch (error) {
      console.error('Erro na API OpenAI:', error);
      throw new Error('Erro ao processar mensagem');
    }
  }

  private buildSystemPrompt(userContext?: {
    userId?: string;
    currentSystem?: string;
    permissions?: string[];
    lastAction?: string;
  }): string {
    const basePrompt = `
Você é o Apolino, assistente virtual da Apolar Imóveis. 

INSTRUÇÕES:
- Seja sempre prestativo, profissional e amigável
- Foque em ajudar com dúvidas sobre o CRM (Apolar Sales) e ERP (Apolar Net)
- Se não souber algo, seja honesto e sugira abrir um chamado no Movidesk
- Mantenha respostas concisas (máximo 3 parágrafos)
- Use linguagem corporativa mas acessível
- Sempre pergunte se pode ajudar com mais alguma coisa

SOBRE OS SISTEMAS:
- Apolar Sales: CRM para gestão de vendas, leads, clientes e oportunidades
- Apolar Net: ERP para gestão financeira, estoque, relatórios e operações

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
}

export default OpenAIService;