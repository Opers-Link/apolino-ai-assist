import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Menu, Send, Sparkles, Ticket, Headphones, CheckCircle, HelpCircle, Calculator, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
// OpenAIService não é mais usado diretamente - streaming SSE é feito via fetch
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
  isEmbedded?: boolean;
}

const AIAssistantPanel = ({ isOpen, onClose, isEmbedded = false }: AIAssistantPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false); // Usado apenas durante criação no envio
  const [messageCount, setMessageCount] = useState(0);
  const [sessionId, setSessionId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');
  const [aiDisabled, setAiDisabled] = useState(false);
  const [conversationClosed, setConversationClosed] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState<Date>(new Date());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  
  const MAX_MESSAGES = 200;
  const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
  const MOVIDESK_URL = 'https://apolarimoveis.movidesk.com/Account/Login'; // URL do Movidesk

  const handleOpenTicket = () => {
    window.open(MOVIDESK_URL, '_blank');
  };

  // Recuperar conversa existente ao abrir o chat (sem criar nova)
  useEffect(() => {
    if (isOpen) {
      recoverExistingConversation();
    }
  }, [isOpen]);

  const recoverExistingConversation = async () => {
    try {
      // Tentar recuperar conversa ativa do localStorage
      const storedConversationId = localStorage.getItem('aia_conversation_id');
      
      if (storedConversationId) {
        // Verificar se a conversa ainda está ativa
        const { data: existingConversation, error } = await supabase
          .from('chat_conversations')
          .select('id, session_id, status, ai_enabled')
          .eq('id', storedConversationId)
          .in('status', ['active', 'needs_help', 'in_progress'])
          .single();

        if (!error && existingConversation) {
          setConversationId(existingConversation.id);
          setSessionId(existingConversation.session_id);
          setAiDisabled(existingConversation.ai_enabled === false || existingConversation.status === 'in_progress');
          
          // Recuperar mensagens existentes
          await loadExistingMessages(existingConversation.id);
          return;
        } else {
          // Conversa não existe mais ou está fechada, limpar localStorage
          localStorage.removeItem('aia_conversation_id');
        }
      }
      
      // Não cria conversa automaticamente - será criada no primeiro envio de mensagem
    } catch (error) {
      console.error('Erro ao recuperar conversa:', error);
    }
  };

  const loadExistingMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('message_order', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedMessages: Message[] = data.map((msg) => ({
          id: msg.id,
          content: msg.content,
          isUser: msg.is_user,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(loadedMessages);
        setMessageCount(data.length);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const createConversation = async (sid: string): Promise<string | null> => {
    try {
      const userAgent = navigator.userAgent;
      
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          session_id: sid,
          user_agent: userAgent,
          status: 'active',
          total_messages: 0
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar conversa:', error);
        return null;
      }

      if (data) {
        setConversationId(data.id);
        // Salvar no localStorage para recuperação
        localStorage.setItem('aia_conversation_id', data.id);
        return data.id;
      }
      return null;
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      return null;
    }
  };

  const saveMessage = async (content: string, isUser: boolean, messageOrder: number, convId?: string): Promise<string | null> => {
    const targetConversationId = convId || conversationId;
    if (!targetConversationId) {
      console.error('Erro: conversationId não disponível para salvar mensagem');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: targetConversationId,
          content,
          is_user: isUser,
          message_order: messageOrder
        })
        .select('id')
        .single();

      if (error) {
        console.error('Erro ao inserir mensagem:', error);
        return null;
      }

      await supabase
        .from('chat_conversations')
        .update({ 
          total_messages: messageOrder,
          status: 'active'
        })
        .eq('id', targetConversationId);

      return data?.id ?? null;
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
      return null;
    }
  };

  const finishConversation = async (forceFinish = false) => {
    if (!conversationId) return;

    try {
      // Verificar status atual da conversa
      const { data } = await supabase
        .from('chat_conversations')
        .select('status, human_requested_at')
        .eq('id', conversationId)
        .single();

      // NÃO finalizar se está aguardando ou em atendimento humano (exceto se forçar)
      if (!forceFinish && data && (
        data.status === 'needs_help' || 
        data.status === 'in_progress' || 
        data.human_requested_at
      )) {
        // Manter a conversa para o usuário poder voltar
        return;
      }

      await supabase
        .from('chat_conversations')
        .update({ 
          ended_at: new Date().toISOString(),
          status: 'finished'
        })
        .eq('id', conversationId);

      // Limpar localStorage apenas se finalizou
      localStorage.removeItem('aia_conversation_id');
    } catch (error) {
      console.error('Erro ao finalizar conversa:', error);
    }
  };

  const handleRequestHumanHelp = async () => {
    // Só permite solicitar ajuda se já existe uma conversa (usuário enviou pelo menos 1 mensagem)
    if (!conversationId) {
      toast({
        title: "Envie uma mensagem primeiro",
        description: "Por favor, descreva seu problema antes de solicitar um atendente.",
      });
      return;
    }
  
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
              // Verificar por ID ou por conteúdo idêntico (sem janela de tempo)
              const exists = prev.some(m => 
                m.id === message.id || 
                (m.content === message.content && !m.isUser)
              );
              if (exists) return prev;
              return [...prev, message];
            });
            
            setMessageCount(prev => Math.max(prev, newMessage.message_order));
            setLastActivityTime(new Date()); // Resetar timer ao receber mensagem do agente
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
        // Detectar conversa encerrada pelo agente
        if (data.status === 'closed' && !conversationClosed) {
          setConversationClosed(true);
          setAiDisabled(false); // Permitir nova interação
          
          toast({
            title: "Atendimento encerrado",
            description: "O agente finalizou seu atendimento. Você pode iniciar uma nova conversa.",
          });
          return;
        }

        // Detectar agente assumindo a conversa
        if ((data.ai_enabled === false || data.status === 'in_progress') && !aiDisabled && !conversationClosed) {
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
  }, [conversationId, aiDisabled, conversationClosed]);

  // Verificar inatividade a cada 30 segundos
  useEffect(() => {
    if (!conversationId || aiDisabled) return;

    const checkInactivity = async () => {
      const now = new Date();
      const timeSinceLastActivity = now.getTime() - lastActivityTime.getTime();

      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT_MS) {
        // Verificar se NÃO solicitou atendimento humano
        const { data } = await supabase
          .from('chat_conversations')
          .select('status, human_requested_at')
          .eq('id', conversationId)
          .single();

        // Só inativar se NÃO solicitou humano
        if (data && !data.human_requested_at && data.status !== 'needs_help' && data.status !== 'in_progress') {
          await supabase
            .from('chat_conversations')
            .update({
              status: 'inactive'
              // NÃO define ended_at - reservado para atendimentos humanos finalizados
            })
            .eq('id', conversationId);

          // Limpar localStorage ao inativar
          localStorage.removeItem('aia_conversation_id');

          toast({
            title: "Conversa encerrada",
            description: "Sua conversa foi encerrada por inatividade. Inicie uma nova conversa se precisar de ajuda.",
          });

          // Resetar estado para nova conversa
          setConversationId('');
          setSessionId('');
          setMessages([]);
          setMessageCount(0);
          onClose();
        }
      }
    };

    const interval = setInterval(checkInactivity, 30000); // Verificar a cada 30 segundos
    
    return () => clearInterval(interval);
  }, [conversationId, lastActivityTime, aiDisabled]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || isCreatingConversation) return;

    // Se a conversa foi encerrada, iniciar uma nova
    if (conversationClosed) {
      setConversationClosed(false);
      setMessages([]);
      setMessageCount(0);
      setAiDisabled(false);
      localStorage.removeItem('aia_conversation_id');
      
      setIsCreatingConversation(true);
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      const newConversationId = await createConversation(newSessionId);
      setIsCreatingConversation(false);
      
      if (!newConversationId) {
        toast({
          title: "Erro",
          description: "Não foi possível iniciar nova conversa.",
          variant: "destructive",
        });
        return;
      }
      
      setConversationId(newConversationId);
    }

    if (messageCount >= MAX_MESSAGES) {
      toast({
        title: "Limite de mensagens atingido",
        description: `Você atingiu o limite de ${MAX_MESSAGES} mensagens por sessão.`,
        variant: "destructive",
      });
      return;
    }

    // Garantir que temos um conversationId válido
    let currentConversationId = conversationId;
    
    if (!currentConversationId) {
      // Se não tem conversa ainda, criar uma agora (lazy loading)
      setIsCreatingConversation(true);
      const newSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (!sessionId) setSessionId(newSessionId);
      
      currentConversationId = await createConversation(newSessionId);
      setIsCreatingConversation(false);
      
      if (!currentConversationId) {
        toast({
          title: "Erro",
          description: "Não foi possível iniciar a conversa. Tente novamente.",
          variant: "destructive",
        });
        return;
      }
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
    setLastActivityTime(new Date()); // Resetar timer de inatividade

    const currentMessageOrder = messageCount + 1;
    await saveMessage(userMessage.content, true, currentMessageOrder, currentConversationId);

    // Se está em atendimento humano, apenas salvar a mensagem e não chamar a IA
    if (aiDisabled) {
      setIsLoading(false);
      return;
    }

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

      // Streaming SSE - fetch direto para a edge function
      const CHAT_URL = `https://nodhzumnsioftsftsbsn.supabase.co/functions/v1/chat-with-ai`;
      
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vZGh6dW1uc2lvZnRzZnRzYnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MjM1NzIsImV4cCI6MjA3MzE5OTU3Mn0._po-LDJsDJe6GQEj2Tw_rqY3MouIZF_3nzHs3-JG_y4`,
        },
        body: JSON.stringify({
          messages: chatMessages,
          userContext,
          conversationId: currentConversationId
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: 'Erro desconhecido' }));
        if (resp.status === 429) {
          toast({ title: "Limite excedido", description: errData.error || "Tente novamente em instantes.", variant: "destructive" });
        } else if (resp.status === 402) {
          toast({ title: "Créditos insuficientes", description: errData.error || "Entre em contato com o administrador.", variant: "destructive" });
        }
        throw new Error(errData.error || 'Erro na resposta da IA');
      }

      if (!resp.body) throw new Error('Stream não disponível');

      // Criar mensagem assistant vazia para preenchimento progressivo
      const botId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: botId, content: '', isUser: false, timestamp: new Date() }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullResponse = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullResponse += content;
              const captured = fullResponse;
              setMessages(prev =>
                prev.map(m => m.id === botId ? { ...m, content: captured } : m)
              );
            }
          } catch {
            // JSON incompleto - recolocar no buffer e aguardar mais dados
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Flush final do buffer
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullResponse += content;
            }
          } catch { /* ignorar restos parciais */ }
        }
        // Atualizar mensagem final
        const finalContent = fullResponse;
        setMessages(prev =>
          prev.map(m => m.id === botId ? { ...m, content: finalContent } : m)
        );
      }

      // Salvar mensagem completa no banco após stream finalizar
      if (fullResponse) {
        const savedId = await saveMessage(fullResponse, false, currentMessageOrder + 1, currentConversationId);
        // Atualizar ID local para o UUID do banco (evita duplicata do realtime)
        if (savedId) {
          setMessages(prev => prev.map(m => m.id === botId ? { ...m, id: savedId } : m));
        }
        setMessageCount(prev => prev + 1);
      }
      setLastActivityTime(new Date());
      
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '⚠️ Não consegui responder agora. Tente novamente em alguns instantes.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      await saveMessage(errorMessage.content, false, currentMessageOrder + 1, currentConversationId);
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
    // Apenas fecha o painel, não finaliza conversas que aguardam atendimento
    finishConversation(false);
    onClose();
  };

  return (
    <>
      {/* Overlay - hidden when embedded */}
      {!isEmbedded && (
        <div 
          className={cn(
            "fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={handleClose}
        />
      )}
      
      {/* Panel */}
      <div
        className={cn(
          "bg-white flex flex-col",
          isEmbedded 
            ? "h-full w-full" 
            : "fixed top-0 right-0 h-full w-full sm:w-[420px] md:w-[480px] z-50 shadow-2xl transition-transform duration-300 ease-out",
          !isEmbedded && (isOpen ? "translate-x-0" : "translate-x-full")
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-apolar-gold via-apolar-gold-alt to-apolar-gold-light p-1 shadow-md">
                <img src={aiaLogo} alt="AIA" className="h-full w-full object-contain brightness-0 opacity-70" />
              </div>
              <span className="font-semibold text-gray-800">AIA</span>
            </div>
          </div>
          {!isEmbedded && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClose}
              className="h-8 w-8 text-gray-600 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
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
          {conversationClosed && (
            <div className="flex items-center justify-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg py-2 mb-3">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Atendimento encerrado - digite para iniciar nova conversa</span>
            </div>
          )}

          {aiDisabled && !conversationClosed && (
            <div className="flex items-center justify-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg py-2 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Conectado com atendente humano - continue a conversa normalmente</span>
            </div>
          )}

          {isCreatingConversation && (
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-2 mb-2">
              <span className="animate-spin">⏳</span>
              <span>Iniciando conversa...</span>
            </div>
          )}
          
          <div className="relative bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-apolar-blue/50 focus-within:ring-2 focus-within:ring-apolar-blue/10 transition-all">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={conversationClosed ? "Iniciar nova conversa..." : "Pedir para AIA"}
              disabled={isLoading || isCreatingConversation}
              className="min-h-[52px] max-h-[120px] resize-none border-0 bg-transparent px-4 py-3 pr-20 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-400"
              rows={1}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-apolar-gold hover:bg-apolar-gold/10 transition-colors"
                    >
                      <Lightbulb className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] p-3">
                    <p className="font-semibold text-xs mb-1.5">Dicas para melhores respostas:</p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• Faça uma pergunta por vez.</li>
                      <li>• Use palavras-chave claras (ex: comissão, vistoria, contrato, proposta).</li>
                      <li>• Seja específico: informe o processo e o sistema envolvidos.</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading || isCreatingConversation}
                size="icon"
                className="h-8 w-8 rounded-full bg-gray-200 hover:bg-apolar-blue text-gray-600 hover:text-white transition-colors disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* CTAs destacados */}
          <div className="flex gap-2 mt-3">
            <Button
              onClick={handleOpenTicket}
              variant="outline"
              size="sm"
              className="flex-1 gap-2 border-apolar-blue/40 text-apolar-blue hover:bg-apolar-blue hover:text-white transition-all"
            >
              <Ticket className="h-4 w-4" />
              Abrir ticket
            </Button>
            <Button
              onClick={() => window.open('/simulador', '_blank')}
              variant="outline"
              size="sm"
              className="flex-1 gap-2 border-apolar-gold text-apolar-blue hover:bg-apolar-gold/10 transition-all"
            >
              <Calculator className="h-4 w-4" />
              Simulador
            </Button>
            <Button
              onClick={() => window.open('/faq', '_blank')}
              variant="outline"
              size="sm"
              className="flex-1 gap-2 border-apolar-blue/40 text-apolar-blue hover:bg-apolar-blue/5 transition-all"
            >
              <HelpCircle className="h-4 w-4" />
              FAQ
            </Button>
          </div>
          
          <p className="text-[10px] text-gray-400 text-center mt-3">
            A AIA pode cometer erros. Por isso, cheque as respostas.
          </p>
        </div>
      </div>
    </>
  );
};

export default AIAssistantPanel;
