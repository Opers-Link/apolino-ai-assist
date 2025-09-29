import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Header } from '@/components/ui/header';
import { MessageSquare, Users, TrendingUp, Clock, Tag, BarChart3, PieChart } from 'lucide-react';

interface Conversation {
  id: string;
  session_id: string;
  started_at: string;
  ended_at?: string;
  status: string;
  total_messages: number;
  user_agent?: string;
  user_ip?: string;
  category?: 'usabilidade' | 'procedimentos' | 'marketing' | 'vendas' | 'outros';
  tags?: string[];
  sentiment?: 'positivo' | 'neutro' | 'negativo';
}

interface Message {
  id: string;
  conversation_id: string;
  content: string;
  is_user: boolean;
  timestamp: string;
  message_order: number;
}

interface Stats {
  totalConversations: number;
  totalMessages: number;
  activeConversations: number;
  avgMessagesPerConversation: number;
}

interface CategoryStats {
  category: string;
  count: number;
  percentage: number;
}

interface TagStats {
  tag: string;
  count: number;
  category: string;
}

const Admin = () => {
  const { signOut, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalConversations: 0,
    totalMessages: 0,
    activeConversations: 0,
    avgMessagesPerConversation: 0
  });
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [tagStats, setTagStats] = useState<TagStats[]>([]);
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
      const { data: conversationsData } = await supabase
        .from('chat_conversations')
        .select('*');

      const { data: messagesData } = await supabase
        .from('chat_messages')
        .select('*');

      if (conversationsData && messagesData) {
        const totalConversations = conversationsData.length;
        const totalMessages = messagesData.length;
        const activeConversations = conversationsData.filter(c => c.status === 'active').length;
        const avgMessagesPerConversation = totalConversations > 0 ? Math.round(totalMessages / totalConversations) : 0;

        setStats({
          totalConversations,
          totalMessages,
          activeConversations,
          avgMessagesPerConversation
        });

        // Calcular estatísticas por categoria
        const categoryCounts = conversationsData.reduce((acc: Record<string, number>, conv) => {
          const category = conv.category || 'outros';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {});

        const categoryStatsData = Object.entries(categoryCounts).map(([category, count]) => ({
          category,
          count,
          percentage: Math.round((count / totalConversations) * 100)
        }));

        setCategoryStats(categoryStatsData);

        // Calcular estatísticas de tags por categoria
        const tagCounts: Record<string, { count: number; categories: Set<string> }> = {};
        
        conversationsData.forEach(conv => {
          const category = conv.category || 'outros';
          const tags = conv.tags || [];
          
          tags.forEach(tag => {
            if (!tagCounts[tag]) {
              tagCounts[tag] = { count: 0, categories: new Set() };
            }
            tagCounts[tag].count += 1;
            tagCounts[tag].categories.add(category);
          });
        });

        const tagStatsData = Object.entries(tagCounts)
          .map(([tag, data]) => ({
            tag,
            count: data.count,
            category: Array.from(data.categories).join(', ')
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10); // Top 10 tags

        setTagStats(tagStatsData);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'completed':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'usabilidade':
        return 'bg-red-100 text-red-800';
      case 'procedimentos':
        return 'bg-blue-100 text-blue-800';
      case 'marketing':
        return 'bg-purple-100 text-purple-800';
      case 'vendas':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positivo':
        return 'bg-green-100 text-green-800';
      case 'negativo':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-lg">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={{
          name: user?.email?.split('@')[0],
          email: user?.email || '',
        }}
        onProfileClick={signOut}
      />
      
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard Administrativo</h1>
          <p className="text-muted-foreground">
            Análise completa das conversas do chatbot
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="conversations">Conversas</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-apolar-blue/10 to-apolar-blue/5 border-apolar-blue/20 hover:shadow-lg hover:shadow-apolar-blue/10 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-apolar-blue">Total de Conversas</CardTitle>
                  <MessageSquare className="h-4 w-4 text-apolar-blue/70" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-apolar-blue">{stats.totalConversations}</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-apolar-gold/15 to-apolar-gold/8 border-apolar-gold/30 hover:shadow-lg hover:shadow-apolar-gold/10 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-apolar-gold-alt">Total de Mensagens</CardTitle>
                  <Users className="h-4 w-4 text-apolar-gold-alt/80" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-apolar-gold-alt">{stats.totalMessages}</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-700">Conversas Ativas</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600/80" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700">{stats.activeConversations}</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-apolar-red/10 to-apolar-red/5 border-apolar-red/20 hover:shadow-lg hover:shadow-apolar-red/10 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-apolar-red">Média de Mensagens</CardTitle>
                  <Clock className="h-4 w-4 text-apolar-red/70" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-apolar-red">{stats.avgMessagesPerConversation}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gradient-to-br from-apolar-blue/5 to-background border-apolar-blue/15">
              <CardHeader>
                <CardTitle className="text-apolar-blue">Conversas Recentes</CardTitle>
                <CardDescription>Últimas 10 conversas registradas</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {conversations.slice(0, 10).map((conversation) => (
                      <div
                        key={conversation.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-apolar-blue/5 cursor-pointer transition-all duration-200 border-apolar-blue/10"
                        onClick={() => selectConversation(conversation)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(conversation.status)}`} />
                          <div>
                            <p className="font-medium">{conversation.session_id.slice(0, 8)}...</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(conversation.started_at)}
                            </p>
                            <div className="flex gap-2 mt-2">
                              {conversation.category && (
                                <Badge className={getCategoryColor(conversation.category)}>
                                  {conversation.category}
                                </Badge>
                              )}
                              {conversation.tags && conversation.tags.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  +{conversation.tags.length} tags
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">
                            {conversation.total_messages} mensagens
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {conversation.status === 'active' ? 'Ativa' : 'Finalizada'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-apolar-gold/8 to-background border-apolar-gold/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-apolar-gold-alt">
                    <PieChart className="h-5 w-5" />
                    Distribuição por Categoria
                  </CardTitle>
                  <CardDescription>Análise das conversas por tipo de assunto</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoryStats.map((stat) => (
                      <div key={stat.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={getCategoryColor(stat.category)}>
                            {stat.category}
                          </Badge>
                          <span className="text-sm font-medium">{stat.count} conversas</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {stat.percentage}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-apolar-red/8 to-background border-apolar-red/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-apolar-red">
                    <Tag className="h-5 w-5" />
                    Principais Dúvidas
                  </CardTitle>
                  <CardDescription>Tags mais frequentes por categoria</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tagStats.map((stat) => (
                      <div key={stat.tag} className="flex items-center justify-between p-3 bg-apolar-blue/5 rounded-lg border border-apolar-blue/10">
                        <div>
                          <div className="font-medium text-apolar-blue">{stat.tag}</div>
                          <div className="text-sm text-muted-foreground">
                            Categorias: {stat.category}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {stat.count}x
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="conversations">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lista de Conversas */}
              <Card className="bg-gradient-to-br from-apolar-blue/6 to-background border-apolar-blue/15">
                <CardHeader>
                  <CardTitle className="text-apolar-blue">Todas as Conversas</CardTitle>
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
                              ? 'bg-apolar-gold/20 border-apolar-gold border' 
                              : 'hover:bg-apolar-blue/10 border border-apolar-blue/10'
                          }`}
                          onClick={() => selectConversation(conversation)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-sm">
                                Sessão: {conversation.session_id.slice(0, 12)}...
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(conversation.started_at)}
                              </p>
                              <div className="flex gap-2 mt-2">
                                {conversation.category && (
                                  <Badge className={getCategoryColor(conversation.category)}>
                                    {conversation.category}
                                  </Badge>
                                )}
                                {conversation.sentiment && (
                                  <Badge className={getSentimentColor(conversation.sentiment)}>
                                    {conversation.sentiment}
                                  </Badge>
                                )}
                              </div>
                            </div>
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
                          {conversation.tags && conversation.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {conversation.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {conversation.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{conversation.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        {index < conversations.length - 1 && <div className="border-b my-2" />}
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Mensagens da Conversa Selecionada */}
              <Card className="bg-gradient-to-br from-apolar-gold/6 to-background border-apolar-gold/15">
                <CardHeader>
                  <CardTitle className="text-apolar-gold-alt">
                    {selectedConversation 
                      ? `Mensagens - ${selectedConversation.session_id.slice(0, 12)}...` 
                      : 'Selecione uma conversa'
                    }
                  </CardTitle>
                  {selectedConversation && (
                    <CardDescription>
                      Iniciada em {formatDateTime(selectedConversation.started_at)}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    {selectedConversation ? (
                      messages.length > 0 ? (
                        messages.map((message) => (
                          <div key={message.id}>
                            <div className={`p-3 rounded-lg mb-2 border transition-all duration-200 ${
                              message.is_user 
                                ? 'bg-apolar-blue/10 ml-8 border-apolar-blue/20' 
                                : 'bg-apolar-gold/10 mr-8 border-apolar-gold/20'
                            }`}>
                              <div className="flex justify-between items-start mb-1">
                                <Badge variant={message.is_user ? 'default' : 'secondary'} className="text-xs">
                                  {message.is_user ? 'Usuário' : 'AI'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTime(message.timestamp)}
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