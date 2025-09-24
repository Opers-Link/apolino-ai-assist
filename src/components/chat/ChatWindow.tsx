import { useState, useRef, useEffect } from 'react';
import { X, Maximize2, Minimize2, ExternalLink, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import OpenAIService from '@/services/openai';
import { supabase } from '@/integrations/supabase/client';
import apolinoAi from '@/assets/apolino-ai.png';
import apolarLogo from '@/assets/apolar-logo.png';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const ChatWindow = ({ isOpen, onClose, isFullscreen, onToggleFullscreen }: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [sessionId, setSessionId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Instância do serviço OpenAI
  const openaiService = new OpenAIService();

  const MAX_MESSAGES = 30;

  // Gerar ID único da sessão e criar conversa no Supabase
  useEffect(() => {
    if (isOpen && !sessionId) {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      createConversation(newSessionId);
    }
  }, [isOpen, sessionId]);

  // Criar conversa no Supabase
  const createConversation = async (sessionId: string) => {
    try {
      const userAgent = navigator.userAgent;
      
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          session_id: sessionId,
          user_agent: userAgent,
          status: 'active',
          total_messages: 0
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar conversa:', error);
        return;
      }

      if (data) {
        setConversationId(data.id);
      }
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
    }
  };

  // Salvar mensagem no Supabase
  const saveMessage = async (content: string, isUser: boolean, messageOrder: number) => {
    if (!conversationId) return;

    try {
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          content,
          is_user: isUser,
          message_order: messageOrder
        });

      // Atualizar contador de mensagens na conversa
      await supabase
        .from('chat_conversations')
        .update({ 
          total_messages: messageOrder,
          status: 'active'
        })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
    }
  };

  // Finalizar conversa ao fechar
  const finishConversation = async () => {
    if (!conversationId) return;

    try {
      await supabase
        .from('chat_conversations')
        .update({ 
          ended_at: new Date().toISOString(),
          status: 'finished'
        })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Erro ao finalizar conversa:', error);
    }
  };

  // Mensagem de boas-vindas
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: '1',
        content: 'Olá! 👋 Sou o Apolino, assistente virtual da Apolar. Posso te ajudar com dúvidas sobre o CRM (Apolar Sales) e o ERP (Apolar Net).',
        isUser: false,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length]);

  // Auto scroll para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focar no input quando abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Verificar limite de mensagens
    if (messageCount >= MAX_MESSAGES) {
      toast({
        title: "Limite de mensagens atingido",
        description: `Você atingiu o limite de ${MAX_MESSAGES} mensagens por sessão.`,
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setMessageCount(prev => prev + 1);

    // Salvar mensagem do usuário no Supabase
    const currentMessageOrder = messageCount + 1;
    await saveMessage(userMessage.content, true, currentMessageOrder);

    try {
      // Preparar contexto do usuário (pode ser expandido futuramente)
      const userContext = {
        userId: 'usuario_atual', // TODO: Pegar do contexto de autenticação
        currentSystem: 'sistema_atual', // TODO: Detectar sistema atual
        permissions: ['read', 'write'], // TODO: Pegar permissões reais
        lastAction: 'navegacao' // TODO: Rastrear última ação
      };

      // Converter mensagens para o formato da OpenAI
      const chatMessages: Array<{role: 'user' | 'assistant'; content: string}> = messages
        .filter(msg => msg.id !== '1') // Excluir mensagem de boas-vindas
        .slice(-10) // Pegar apenas as últimas 10 mensagens para contexto
        .map(msg => ({
          role: (msg.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
          content: msg.content
        }));

      // Adicionar a nova mensagem do usuário
      chatMessages.push({
        role: 'user',
        content: userMessage.content
      });

      // Chamar OpenAI service
      const response = await openaiService.chatCompletion(chatMessages, userContext);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      
      // Salvar mensagem do bot no Supabase
      await saveMessage(botMessage.content, false, currentMessageOrder + 1);
      setMessageCount(prev => prev + 1);
      
    } catch (error) {
      // Fallback de erro
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '⚠️ Não consegui responder agora. Tente novamente em alguns instantes.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Salvar mensagem de erro no Supabase
      await saveMessage(errorMessage.content, false, currentMessageOrder + 1);
      setMessageCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const openMovidesk = () => {
    window.open('https://apolarimoveis.movidesk.com/', '_blank');
  };

  // Finalizar conversa ao fechar o chat
  const handleClose = () => {
    finishConversation();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed z-40 bg-white rounded-lg shadow-2xl transition-all duration-300 chat-window-enter",
        isFullscreen 
          ? "inset-4 md:inset-8" 
          : "bottom-24 right-6 h-[500px] w-[380px] md:w-[420px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-apolar-blue rounded-t-lg">
        <div className="flex items-center gap-3">
          <img 
            src={apolarLogo} 
            alt="Apolar Imóveis" 
            className="h-8 w-auto"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFullscreen}
            className="text-white hover:bg-white/10"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className={cn(
        "flex-1 p-4",
        isFullscreen ? "h-[calc(100vh-200px)]" : "h-[340px]"
      )}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.isUser ? "justify-end" : "justify-start"
              )}
            >
              {!message.isUser && (
                <img 
                  src={apolinoAi} 
                  alt="Apolino" 
                  className="h-8 w-8 rounded-full flex-shrink-0"
                />
              )}
              
              <div
                className={cn(
                  "max-w-[80%] p-3 rounded-lg text-sm",
                  message.isUser
                    ? "bg-apolar-blue text-white rounded-br-none"
                    : "bg-apolar-light-gray text-apolar-dark-gray rounded-bl-none"
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3">
              <img 
                src={apolinoAi} 
                alt="Apolino" 
                className="h-8 w-8 rounded-full flex-shrink-0"
              />
              <div className="bg-apolar-light-gray p-3 rounded-lg rounded-bl-none">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-apolar-dark-gray/50 rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-apolar-dark-gray/50 rounded-full animate-pulse delay-75" />
                  <div className="w-2 h-2 bg-apolar-dark-gray/50 rounded-full animate-pulse delay-150" />
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4 space-y-3">
        {/* Contador de mensagens */}
        <div className="flex justify-between items-center text-xs text-apolar-dark-gray">
          <span>Mensagens: {messageCount}/{MAX_MESSAGES}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={openMovidesk}
            className="text-xs h-7 gap-1 border-apolar-gold text-apolar-blue hover:bg-apolar-gold/10"
          >
            <ExternalLink className="h-3 w-3" />
            Abrir Chamado
          </Button>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={isLoading || messageCount >= MAX_MESSAGES}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading || messageCount >= MAX_MESSAGES}
            className="bg-apolar-blue hover:bg-apolar-blue/90 text-white"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;