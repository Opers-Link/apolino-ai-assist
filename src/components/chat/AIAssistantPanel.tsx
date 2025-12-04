import { useState, useRef, useEffect } from 'react';
import { X, Menu, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import OpenAIService from '@/services/openai';
import { supabase } from '@/integrations/supabase/client';
import aiaLogo from '@/assets/aia-logo.png';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIAssistantPanel = ({ isOpen, onClose }: AIAssistantPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [sessionId, setSessionId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');
  const [aiDisabled, setAiDisabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const openaiService = new OpenAIService();
  const MAX_MESSAGES = 30;

  useEffect(() => {
    if (isOpen && !sessionId) {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      createConversation(newSessionId);
    }
  }, [isOpen, sessionId]);

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

  const handleRequestHumanHelp = async () => {
    if (!conversationId) return;
  
    try {
      await supabase
        .from('chat_conversations')
        .update({
          status: 'needs_help',
          human_requested_at: new Date().toISOString(),
          tags: ['humano_solicitado']
        })
        .eq('id', conversationId);
  
      const systemMessage: Message = {
        id: Date.now().toString(),
        content: 'Aguarde um pouco, você será atendido em breve.',
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, systemMessage]);
      setAiDisabled(true);
      
      toast({
        title: "Atendente solicitado",
        description: "Você será atendido em breve por nossa equipe.",
      });
    } catch (error) {
      console.error('Erro ao solicitar ajuda humana:', error);
      toast({
        title: "Erro",
        description: "Não foi possível solicitar um atendente.",
        variant: "destructive",
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Listener de tempo real
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          if (!newMessage.is_user) {
            const message: Message = {
              id: newMessage.id,
              content: newMessage.content,
              isUser: false,
              timestamp: new Date(newMessage.timestamp)
            };
            
            setMessages(prev => {
              const exists = prev.some(m => m.id === message.id);
              if (exists) return prev;
              return [...prev, message];
            });
            
            setMessageCount(prev => Math.max(prev, newMessage.message_order));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const checkConversationStatus = async () => {
      const { data } = await supabase
        .from('chat_conversations')
        .select('ai_enabled, status')
        .eq('id', conversationId)
        .single();
      
      if (data) {
        if ((data.ai_enabled === false || data.status === 'in_progress') && !aiDisabled) {
          setAiDisabled(true);
          
          const confirmMessage: Message = {
            id: `agent-${Date.now()}`,
            content: '✅ Um atendente assumiu sua conversa!',
            isUser: false,
            timestamp: new Date()
          };
          
          setMessages(prev => {
            const hasConfirmMessage = prev.some(m => m.id.startsWith('agent-'));
            if (hasConfirmMessage) return prev;
            return [...prev, confirmMessage];
          });
        }
      }
    };

    checkConversationStatus();
    const interval = setInterval(checkConversationStatus, 5000);
    
    return () => clearInterval(interval);
  }, [conversationId, aiDisabled]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

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

    const currentMessageOrder = messageCount + 1;
    await saveMessage(userMessage.content, true, currentMessageOrder);

    try {
      const userContext = {
        userId: 'usuario_atual',
        currentSystem: 'sistema_atual',
        permissions: ['read', 'write'],
        lastAction: 'navegacao'
      };

      const chatMessages: Array<{role: 'user' | 'assistant'; content: string}> = messages
        .filter(msg => msg.id !== '1')
        .slice(-10)
        .map(msg => ({
          role: (msg.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
          content: msg.content
        }));

      chatMessages.push({
        role: 'user',
        content: userMessage.content
      });

      const response = await openaiService.chatCompletion(chatMessages, userContext, conversationId);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      await saveMessage(botMessage.content, false, currentMessageOrder + 1);
      setMessageCount(prev => prev + 1);
      
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '⚠️ Não consegui responder agora. Tente novamente em alguns instantes.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
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

  const handleClose = () => {
    finishConversation();
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
      />
      
      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[420px] md:w-[480px] bg-white z-50 shadow-2xl transition-transform duration-300 ease-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-apolar-gold via-apolar-gold-alt to-apolar-gold-light p-1 shadow-md">
                <img src={aiaLogo} alt="AIA" className="h-full w-full object-contain brightness-0 opacity-70" />
              </div>
              <span className="font-semibold text-gray-800">AIA</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClose}
            className="h-8 w-8 text-gray-600 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-apolar-gold via-apolar-gold-alt to-apolar-gold-light p-3 shadow-lg mb-6">
                <img src={aiaLogo} alt="AIA" className="h-full w-full object-contain brightness-0 opacity-70" />
              </div>
              <h2 className="text-2xl font-light text-gray-800 mb-2">
                <span className="bg-gradient-to-r from-apolar-blue to-apolar-gold bg-clip-text text-transparent font-medium">
                  Encontre informações
                </span>
              </h2>
              <p className="text-sm text-gray-500 text-center max-w-xs">
                Pergunte sobre sistemas, procedimentos ou processos da Apolar
              </p>
            </div>
          ) : (
            <div className="py-6 space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.isUser ? "justify-end" : "justify-start"
                  )}
                >
                  {!message.isUser && (
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-apolar-gold via-apolar-gold-alt to-apolar-gold-light p-1.5 flex-shrink-0 shadow-sm">
                      <img src={aiaLogo} alt="AIA" className="h-full w-full object-contain brightness-0 opacity-70" />
                    </div>
                  )}
                  
                  <div
                    className={cn(
                      "max-w-[85%] text-sm leading-relaxed",
                      message.isUser
                        ? "bg-apolar-blue text-white px-4 py-2.5 rounded-2xl rounded-br-md"
                        : "text-gray-700"
                    )}
                  >
                    {message.content.split(/(\[IMAGE:.*?\])/).map((part, index) => {
                      const imageMatch = part.match(/\[IMAGE:(.*?)\]/);
                      if (imageMatch) {
                        const imageUrl = imageMatch[1];
                        return (
                          <div key={index} className="my-2">
                            <img 
                              src={imageUrl} 
                              alt="Imagem do manual" 
                              className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => window.open(imageUrl, '_blank')}
                              loading="lazy"
                            />
                          </div>
                        );
                      }
                      return part ? <span key={index} className="whitespace-pre-wrap">{part}</span> : null;
                    })}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-apolar-gold via-apolar-gold-alt to-apolar-gold-light p-1.5 flex-shrink-0">
                    <img src={aiaLogo} alt="AIA" className="h-full w-full object-contain brightness-0 opacity-70 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-1 py-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-100">
          {aiDisabled && (
            <div className="flex items-center justify-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg py-2 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Aguardando atendente humano...</span>
            </div>
          )}
          
          <div className="relative bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-apolar-blue/50 focus-within:ring-2 focus-within:ring-apolar-blue/10 transition-all">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Pedir para AIA"
              disabled={isLoading || aiDisabled}
              className="min-h-[52px] max-h-[120px] resize-none border-0 bg-transparent px-4 py-3 pr-12 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-400"
              rows={1}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading || aiDisabled}
              size="icon"
              className="absolute right-2 bottom-2 h-8 w-8 rounded-full bg-gray-200 hover:bg-apolar-blue text-gray-600 hover:text-white transition-colors disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          <p className="text-[10px] text-gray-400 text-center mt-3">
            A AIA pode cometer erros. Por isso, cheque as respostas.{' '}
            {!aiDisabled && messageCount >= 5 && (
              <button
                onClick={handleRequestHumanHelp}
                className="text-apolar-blue hover:underline"
              >
                Falar com atendente
              </button>
            )}
          </p>
        </div>
      </div>
    </>
  );
};

export default AIAssistantPanel;
