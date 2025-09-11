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
    }
  ): Promise<string> {
    try {
      // Adicionar contexto do sistema Apolar
      const systemPrompt = this.buildSystemPrompt(userContext);
      const fullMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages
      ];

      // TODO: Implementar chamada real para a API
      // const response = await fetch(`${this.baseURL}/chat/completions`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${this.apiKey}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     model: 'gpt-5',
      //     messages: fullMessages,
      //     max_tokens: 500,
      //     temperature: 0.7,
      //   }),
      // });

      // Por enquanto, retornar resposta simulada
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      
      const responses = [
        'Entendi sua pergunta sobre o sistema Apolar. Posso ajudá-lo com informações sobre o CRM Apolar Sales e o ERP Apolar Net.',
        'Para essa funcionalidade específica, recomendo verificar suas permissões no sistema. Caso persista o problema, posso abrir um chamado no Movidesk para você.',
        'Essa configuração pode ser encontrada no menu de administração. Se precisar de acesso especial, entre em contato com o suporte técnico.',
        'Vou te ajudar com essa dúvida do sistema. Primeiro, me conte em qual módulo você está trabalhando (CRM ou ERP)?',
        'Baseado no seu perfil de usuário, você tem acesso a essas funcionalidades. Vou te guiar passo a passo.',
      ];
      
      return responses[Math.floor(Math.random() * responses.length)];
      
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