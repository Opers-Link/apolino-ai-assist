import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, User, Bot, Clock, MessageSquare, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  conversation_id: string;
  content: string;
  is_user: boolean;
  timestamp: string;
  message_order: number;
}

interface Conversation {
  id: string;
  session_id: string;
  started_at: string;
  ended_at?: string;
  status: string;
  total_messages: number;
  category?: string;
  tags?: string[];
  assigned_to?: string;
  assigned_at?: string;
  ai_enabled?: boolean;
  human_requested_at?: string;
  first_response_time?: number;
}

interface Agent {
  id: string;
  display_name: string;
  email: string;
}

interface ConversationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  onUpdate?: () => void;
}

export function ConversationDetailModal({
  isOpen,
  onClose,
  conversation,
  onUpdate
}: ConversationDetailModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [aiEnabled, setAiEnabled] = useState(conversation.ai_enabled ?? true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAssignedToMe = conversation.assigned_to === user?.id;
  const isAssignedToSomeone = !!conversation.assigned_to;

  useEffect(() => {
    if (isOpen) {
      loadMessages();
      loadAgents();
      setAiEnabled(conversation.ai_enabled ?? true);
    }
  }, [isOpen, conversation.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('message_order', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          email,
          user_roles!inner(role)
        `)
        .or('user_roles.role.eq.agente,user_roles.role.eq.gerente,user_roles.role.eq.admin');

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
    }
  };

  const handleTakeConversation = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const updates: any = {
        assigned_to: user.id,
        assigned_at: new Date().toISOString(),
        status: 'in_progress',
        ai_enabled: false
      };

      // Calcular first_response_time se ainda não foi calculado
      if (!conversation.first_response_time && conversation.human_requested_at) {
        const requestedAt = new Date(conversation.human_requested_at);
        const now = new Date();
        updates.first_response_time = Math.floor(
          (now.getTime() - requestedAt.getTime()) / 1000
        );
      }

      const { error } = await supabase
        .from('chat_conversations')
        .update(updates)
        .eq('id', conversation.id);

      if (error) throw error;

      setAiEnabled(false);
      toast({
        title: 'Atendimento assumido',
        description: 'Você agora é responsável por este atendimento',
      });
      
      onUpdate?.();
    } catch (error) {
      console.error('Erro ao assumir atendimento:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível assumir o atendimento',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isAssignedToMe) return;

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user?.id)
        .single();

      const agentName = profile?.display_name || 'Agente';
      const messageContent = `[AGENTE: ${agentName}]\n${newMessage}`;

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation.id,
          content: messageContent,
          is_user: false,
          message_order: messages.length + 1
        });

      if (error) throw error;

      // Atualizar contador de mensagens
      await supabase
        .from('chat_conversations')
        .update({ 
          total_messages: messages.length + 1
        })
        .eq('id', conversation.id);

      setNewMessage('');
      loadMessages();
      
      toast({
        title: 'Mensagem enviada',
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a mensagem',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAI = async () => {
    if (!isAssignedToMe) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ ai_enabled: !aiEnabled })
        .eq('id', conversation.id);

      if (error) throw error;

      setAiEnabled(!aiEnabled);
      toast({
        title: aiEnabled ? 'IA desativada' : 'IA ativada',
        description: aiEnabled 
          ? 'Você está no controle do atendimento' 
          : 'A IA pode responder ao usuário',
      });
      
      onUpdate?.();
    } catch (error) {
      console.error('Erro ao alternar IA:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alternar o estado da IA',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (targetAgentId: string) => {
    if (!user?.id || !isAssignedToMe) return;

    setLoading(true);
    try {
      // Registrar transferência
      await supabase.from('user_assignments').insert({
        conversation_id: conversation.id,
        assigned_from: user.id,
        assigned_to: targetAgentId,
        reason: 'Transferência manual'
      });

      // Atualizar conversa
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          assigned_to: targetAgentId,
          assigned_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

      if (error) throw error;

      toast({
        title: 'Atendimento transferido',
        description: 'O atendimento foi transferido com sucesso',
      });
      
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Erro ao transferir:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível transferir o atendimento',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!isAssignedToMe) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          status: 'closed',
          resolved_at: new Date().toISOString(),
          ended_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

      if (error) throw error;

      toast({
        title: 'Atendimento resolvido',
        description: 'O atendimento foi marcado como resolvido',
      });
      
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Erro ao resolver:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível resolver o atendimento',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Atendimento #{conversation.session_id.slice(0, 8)}</DialogTitle>
              <div className="flex gap-2 mt-2">
                <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'}>
                  {conversation.status}
                </Badge>
                {conversation.category && (
                  <Badge variant="outline">{conversation.category}</Badge>
                )}
                {aiEnabled && <Badge variant="secondary">IA Ativa</Badge>}
              </div>
            </div>
            
            <div className="flex gap-2">
              {isAssignedToMe ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleToggleAI} disabled={loading}>
                    {aiEnabled ? 'Desativar IA' : 'Ativar IA'}
                  </Button>
                  <Select onValueChange={handleTransfer}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Transferir" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents
                        .filter(a => a.id !== user?.id)
                        .map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.display_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleResolve} disabled={loading}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Resolver
                  </Button>
                </>
              ) : !isAssignedToSomeone ? (
                <Button onClick={handleTakeConversation} disabled={loading}>
                  Assumir Atendimento
                </Button>
              ) : (
                <Badge variant="outline" className="text-sm">
                  Atribuído a outro agente
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>
        
        {/* Área de mensagens */}
        <ScrollArea className="h-[500px] pr-4 border rounded-lg">
          <div className="p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.is_user ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.is_user
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {message.is_user ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                    <span className="text-xs opacity-70">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        {/* Input de mensagem */}
        {isAssignedToMe && (
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Digite sua mensagem..."
              disabled={loading}
            />
            <Button onClick={handleSendMessage} disabled={loading || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
