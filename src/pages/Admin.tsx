import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { KanbanBoard } from '@/components/admin/KanbanBoard';
import { MessageSquare, Users, TrendingUp, Clock, Tag, PieChart, UserCircle, Settings } from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-apolar-blue/5 to-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-apolar-blue"></div>
          <p className="mt-4 text-lg text-apolar-blue">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const renderDashboard = () => (
    <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-white/40 backdrop-blur-sm border-apolar-blue/20 hover:bg-white/50 hover:scale-[1.02] transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-apolar-blue">Total de Conversas</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-apolar-blue/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-apolar-blue" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-apolar-blue">{stats.totalConversations}</div>
                  <p className="text-xs text-apolar-blue-med mt-1">+12% vs. mês anterior</p>
                </CardContent>
              </Card>

              <Card className="bg-white/40 backdrop-blur-sm border-apolar-gold/20 hover:bg-white/50 hover:scale-[1.02] transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-apolar-gold-alt">Total de Mensagens</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-apolar-gold/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-apolar-gold-alt" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-apolar-gold-alt">{stats.totalMessages}</div>
                  <p className="text-xs text-apolar-gold-alt/70 mt-1">+8% vs. mês anterior</p>
                </CardContent>
              </Card>

              <Card className="bg-white/40 backdrop-blur-sm border-green-500/20 hover:bg-white/50 hover:scale-[1.02] transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-700">Conversas Ativas</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-700">{stats.activeConversations}</div>
                  <p className="text-xs text-green-600/70 mt-1">Em tempo real</p>
                </CardContent>
              </Card>

              <Card className="bg-white/40 backdrop-blur-sm border-apolar-red/20 hover:bg-white/50 hover:scale-[1.02] transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-apolar-red">Média de Mensagens</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-apolar-red/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-apolar-red" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-apolar-red">{stats.avgMessagesPerConversation}</div>
                  <p className="text-xs text-apolar-red/70 mt-1">Por conversa</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/40 backdrop-blur-sm border-apolar-blue/20">
              <CardHeader>
                <CardTitle className="text-apolar-blue">Conversas Recentes</CardTitle>
                <CardDescription>Últimas 10 conversas registradas</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {conversations.slice(0, 10).map((conversation) => (
                      <div
                        key={conversation.id}
                        className="flex items-center justify-between p-4 bg-white/50 backdrop-blur-sm border border-apolar-blue/20 rounded-lg hover:bg-white/80 hover:scale-[1.01] cursor-pointer transition-all duration-200"
                        onClick={() => selectConversation(conversation)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(conversation.status)} shadow-lg`} />
                          <div>
                            <p className="font-medium text-apolar-blue">{conversation.session_id.slice(0, 8)}...</p>
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
                                <Badge variant="outline" className="text-xs bg-white/50">
                                  +{conversation.tags.length} tags
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="bg-apolar-blue/10 text-apolar-blue">
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
    </div>
  );

  const renderCategories = () => (
    <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/40 backdrop-blur-sm border-apolar-gold/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-apolar-gold-alt">
                    <div className="h-10 w-10 rounded-full bg-apolar-gold/10 flex items-center justify-center">
                      <PieChart className="h-5 w-5" />
                    </div>
                    Distribuição por Categoria
                  </CardTitle>
                  <CardDescription>Análise das conversas por tipo de assunto</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoryStats.map((stat) => (
                      <div key={stat.category} className="flex items-center justify-between p-3 bg-white/50 backdrop-blur-sm rounded-lg border border-apolar-blue/10 hover:bg-white/80 transition-all">
                        <div className="flex items-center gap-3">
                          <Badge className={getCategoryColor(stat.category)}>
                            {stat.category}
                          </Badge>
                          <span className="text-sm font-medium text-apolar-blue">{stat.count} conversas</span>
                        </div>
                        <div className="text-lg font-bold text-apolar-gold-alt">
                          {stat.percentage}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/40 backdrop-blur-sm border-apolar-red/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-apolar-red">
                    <div className="h-10 w-10 rounded-full bg-apolar-red/10 flex items-center justify-center">
                      <Tag className="h-5 w-5" />
                    </div>
                    Principais Dúvidas
                  </CardTitle>
                  <CardDescription>Tags mais frequentes por categoria</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tagStats.map((stat) => (
                      <div key={stat.tag} className="flex items-center justify-between p-3 bg-white/50 backdrop-blur-sm rounded-lg border border-apolar-blue/10 hover:bg-white/80 transition-all">
                        <div>
                          <div className="font-medium text-apolar-blue">{stat.tag}</div>
                          <div className="text-sm text-muted-foreground">
                            Categorias: {stat.category}
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-apolar-red/10 text-apolar-red border-apolar-red/30">
                          {stat.count}x
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
    </div>
  );

  const renderConversations = () => (
    <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lista de Conversas */}
              <Card className="bg-white/40 backdrop-blur-sm border-apolar-blue/20">
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
                          className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                            selectedConversation?.id === conversation.id 
                              ? 'bg-apolar-gold/20 border-apolar-gold border-2 scale-[1.02]' 
                              : 'bg-white/50 hover:bg-white/80 border border-apolar-blue/20'
                          }`}
                          onClick={() => selectConversation(conversation)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-sm text-apolar-blue">
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
                            <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'} className="bg-apolar-blue/10 text-apolar-blue">
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
                                <Badge key={tag} variant="outline" className="text-xs bg-white/50">
                                  {tag}
                                </Badge>
                              ))}
                              {conversation.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs bg-white/50">
                                  +{conversation.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        {index < conversations.length - 1 && <div className="border-b border-apolar-blue/10 my-2" />}
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Mensagens da Conversa Selecionada */}
              <Card className="bg-white/40 backdrop-blur-sm border-apolar-gold/20">
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
                            <div className={`p-4 rounded-lg mb-3 border backdrop-blur-sm transition-all duration-200 ${
                              message.is_user 
                                ? 'bg-apolar-blue/15 ml-8 border-apolar-blue/30 hover:bg-apolar-blue/20' 
                                : 'bg-apolar-gold/15 mr-8 border-apolar-gold/30 hover:bg-apolar-gold/20'
                            }`}>
                              <div className="flex justify-between items-start mb-2">
                                <Badge variant={message.is_user ? 'default' : 'secondary'} className={message.is_user ? 'bg-apolar-blue text-white' : 'bg-apolar-gold-alt text-white'}>
                                  {message.is_user ? 'Usuário' : 'AI'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTime(message.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed">{message.content}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground py-8 bg-white/30 backdrop-blur-sm rounded-lg">
                          Nenhuma mensagem encontrada
                        </div>
                      )
                    ) : (
                      <div className="text-center text-muted-foreground py-8 bg-white/30 backdrop-blur-sm rounded-lg">
                        Selecione uma conversa para ver as mensagens
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
    </div>
  );

  const renderAtendimentos = () => (
    <div className="h-full">
      <KanbanBoard 
        conversations={conversations} 
        onConversationClick={selectConversation}
      />
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <Card className="bg-white/40 backdrop-blur-sm border-apolar-blue/20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-apolar-gold/5 via-transparent to-apolar-blue/5" />
        <CardHeader className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-apolar-gold/10 flex items-center justify-center">
              <Settings className="h-6 w-6 text-apolar-gold-alt" />
            </div>
            <div>
              <CardTitle className="text-apolar-gold-alt">Configurações</CardTitle>
              <CardDescription>Funcionalidade em desenvolvimento</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <p className="text-muted-foreground mb-4">Esta seção estará disponível em breve e permitirá:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-apolar-gold-alt" />
              Personalizar respostas do chatbot
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-apolar-gold-alt" />
              Configurar integrações
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-apolar-gold-alt" />
              Ajustar preferências do sistema
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <Card className="bg-white/40 backdrop-blur-sm border-apolar-blue/20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-apolar-red/5 via-transparent to-apolar-blue/5" />
        <CardHeader className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-apolar-red/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-apolar-red" />
            </div>
            <div>
              <CardTitle className="text-apolar-red">Usuários</CardTitle>
              <CardDescription>Funcionalidade em desenvolvimento</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <p className="text-muted-foreground mb-4">Esta seção estará disponível em breve e permitirá:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-apolar-red" />
              Gerenciar usuários administrativos
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-apolar-red" />
              Definir permissões de acesso
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-apolar-red" />
              Auditoria de ações
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <AdminLayout>
      {(activeTab) => {
        switch (activeTab) {
          case 'dashboard':
            return renderDashboard();
          case 'conversations':
            return renderConversations();
          case 'atendimentos':
            return renderAtendimentos();
          case 'settings':
            return renderSettings();
          case 'users':
            return renderUsers();
          default:
            return renderDashboard();
        }
      }}
    </AdminLayout>
  );
};

export default Admin;