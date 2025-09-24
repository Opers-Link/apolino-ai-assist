import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { LogOut, MessageSquare, Users, BarChart3, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Conversation {
  id: string;
  session_id: string;
  user_ip: string | null;
  user_agent: string | null;
  started_at: string;
  ended_at: string | null;
  total_messages: number;
  status: string;
}

interface Message {
  id: string;
  content: string;
  is_user: boolean;
  timestamp: string;
  message_order: number;
}

interface Stats {
  totalConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  activeConversations: number;
}

const Admin = () => {
  const { signOut, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalConversations: 0,
    totalMessages: 0,
    averageMessagesPerConversation: 0,
    activeConversations: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    loadConversations();
    
    // Set up real-time updates
    const channel = supabase
      .channel('admin-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations'
        },
        () => {
          loadStats();
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages'
        },
        () => {
          loadStats();
          if (selectedConversation) {
            loadMessages(selectedConversation.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation]);

  const loadStats = async () => {
    try {
      const [conversationsRes, messagesRes] = await Promise.all([
        supabase.from('chat_conversations').select('*'),
        supabase.from('chat_messages').select('*')
      ]);

      if (conversationsRes.data && messagesRes.data) {
        const totalConversations = conversationsRes.data.length;
        const totalMessages = messagesRes.data.length;
        const activeConversations = conversationsRes.data.filter(c => c.status === 'active').length;
        const averageMessagesPerConversation = totalConversations > 0 
          ? Math.round(totalMessages / totalConversations) 
          : 0;

        setStats({
          totalConversations,
          totalMessages,
          averageMessagesPerConversation,
          activeConversations,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .order('started_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('message_order', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const selectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground">
              Bem-vindo, {user?.email}
            </p>
          </div>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="conversations">Conversas</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Conversas</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalConversations}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalMessages}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeConversations}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Média Msgs/Conversa</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.averageMessagesPerConversation}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Últimas Conversas</CardTitle>
                <CardDescription>
                  As 10 conversas mais recentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {conversations.slice(0, 10).map((conversation, index) => (
                    <div key={conversation.id}>
                      <div className="flex justify-between items-center py-2">
                        <div>
                          <p className="text-sm font-medium">
                            Sessão: {conversation.session_id.slice(0, 8)}...
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(conversation.started_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'}>
                            {conversation.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {conversation.total_messages} msgs
                          </span>
                        </div>
                      </div>
                      {index < 9 && <Separator />}
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversations">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lista de Conversas */}
              <Card>
                <CardHeader>
                  <CardTitle>Todas as Conversas</CardTitle>
                  <CardDescription>
                    Clique em uma conversa para ver as mensagens
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    {conversations.map((conversation, index) => (
                      <div key={conversation.id}>
                        <div 
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedConversation?.id === conversation.id 
                              ? 'bg-primary/10 border-primary border' 
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => selectConversation(conversation)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-sm">
                                Sessão: {conversation.session_id.slice(0, 12)}...
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(conversation.started_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </p>
                            </div>
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex justify-between items-center">
                            <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'}>
                              {conversation.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {conversation.total_messages} mensagens
                            </span>
                          </div>
                          {conversation.user_ip && (
                            <p className="text-xs text-muted-foreground mt-1">
                              IP: {conversation.user_ip}
                            </p>
                          )}
                        </div>
                        {index < conversations.length - 1 && <Separator className="my-2" />}
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Mensagens da Conversa Selecionada */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedConversation 
                      ? `Mensagens - ${selectedConversation.session_id.slice(0, 12)}...` 
                      : 'Selecione uma conversa'
                    }
                  </CardTitle>
                  {selectedConversation && (
                    <CardDescription>
                      Iniciada em {format(new Date(selectedConversation.started_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    {selectedConversation ? (
                      messages.length > 0 ? (
                        messages.map((message, index) => (
                          <div key={message.id}>
                            <div className={`p-3 rounded-lg mb-2 ${
                              message.is_user 
                                ? 'bg-primary/10 ml-8' 
                                : 'bg-muted mr-8'
                            }`}>
                              <div className="flex justify-between items-start mb-1">
                                <Badge variant={message.is_user ? 'default' : 'secondary'} className="text-xs">
                                  {message.is_user ? 'Usuário' : 'AI'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(message.timestamp), 'HH:mm', { locale: ptBR })}
                                </span>
                              </div>
                              <p className="text-sm">{message.content}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          Nenhuma mensagem encontrada
                        </div>
                      )
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        Selecione uma conversa para ver as mensagens
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;