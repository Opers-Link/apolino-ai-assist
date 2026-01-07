import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { KanbanBoard } from '@/components/admin/KanbanBoard';
import { ConversationDetailModal } from '@/components/admin/ConversationDetailModal';
import { UserManagement } from '@/components/admin/UserManagement';
import { InsightsPanel } from '@/components/admin/InsightsPanel';
import { MessageSquare, Users, TrendingUp, Clock, Tag, PieChart, UserCircle, Settings, Bot, CheckCircle, Send, FileText, Save, Sparkles, BookOpen, Brain, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PromptEditor } from '@/components/admin/PromptEditor';
import { KnowledgeModulesManager } from '@/components/admin/KnowledgeModulesManager';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DateRangeFilter } from '@/components/admin/DateRangeFilter';
import { isWithinInterval } from 'date-fns';

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
  assigned_to?: string;
  assigned_at?: string;
  ai_enabled?: boolean;
  human_requested_at?: string;
  first_response_time?: number;
  agent_notes?: string;
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
  aiRequests: number;
  avgAiRequestsPerConversation: number;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalConversations: 0,
    totalMessages: 0,
    activeConversations: 0,
    aiRequests: 0,
    avgAiRequestsPerConversation: 0
  });
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [tagStats, setTagStats] = useState<TagStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentNotes, setAgentNotes] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState<{
    startDate: Date | null;
    endDate: Date | null;
  }>({ startDate: null, endDate: null });
  const { toast } = useToast();

  useEffect(() => {
    loadCurrentUser();
    loadStats(dateFilter.startDate, dateFilter.endDate);
    loadConversations(dateFilter.startDate, dateFilter.endDate);
    
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
          loadStats(dateFilter.startDate, dateFilter.endDate);
          loadConversations(dateFilter.startDate, dateFilter.endDate);
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
          loadStats(dateFilter.startDate, dateFilter.endDate);
          if (selectedConversation) {
            loadMessages(selectedConversation.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, dateFilter]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Buscar perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // Buscar roles separadamente
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      setCurrentUser({ 
        ...user, 
        profile: { 
          ...profile, 
          user_roles: userRoles || [] 
        } 
      });
    }
  };

  const loadStats = async (startDate: Date | null = null, endDate: Date | null = null) => {
    try {
      const { data: conversationsData } = await supabase
        .from('chat_conversations')
        .select('*');

      const { data: messagesData } = await supabase
        .from('chat_messages')
        .select('*');

      // Buscar requisições de IA
      let aiQuery = supabase
        .from('ai_usage_logs')
        .select('*', { count: 'exact' });
      
      if (startDate && endDate) {
        aiQuery = aiQuery
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
      }
      
      const { count: aiRequestsCount } = await aiQuery;

      if (conversationsData && messagesData) {
        // Filter by date range if provided
        const filteredConversations = startDate && endDate
          ? conversationsData.filter(conv => {
              const convDate = new Date(conv.started_at);
              return isWithinInterval(convDate, { start: startDate, end: endDate });
            })
          : conversationsData;
        const totalConversations = filteredConversations.length;
        const activeConversations = filteredConversations.filter(c => c.status === 'active').length;
        
        // Filter messages based on filtered conversations
        const filteredConversationIds = new Set(filteredConversations.map(c => c.id));
        const filteredMessages = messagesData.filter(m => filteredConversationIds.has(m.conversation_id));
        const totalMessages = filteredMessages.length;

        const avgAiRequestsPerConversation = totalConversations > 0 
          ? Math.round((aiRequestsCount || 0) / totalConversations * 10) / 10
          : 0;

        setStats({
          totalConversations,
          totalMessages,
          activeConversations,
          aiRequests: aiRequestsCount || 0,
          avgAiRequestsPerConversation
        });

        // Calcular estatísticas por categoria
        const categoryCounts = filteredConversations.reduce((acc: Record<string, number>, conv) => {
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
        
        filteredConversations.forEach(conv => {
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

  const loadConversations = async (startDate: Date | null = null, endDate: Date | null = null) => {
    try {
      let query = supabase
        .from('chat_conversations')
        .select('*')
        .order('started_at', { ascending: false });

      // Apply date filter if provided
      if (startDate && endDate) {
        query = query
          .gte('started_at', startDate.toISOString())
          .lte('started_at', endDate.toISOString());
      }

      const { data, error } = await query;

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

  // Para tela de Conversas (SEM modal)
  const selectConversationInList = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setAgentNotes(conversation.agent_notes || '');
    setReplyMessage('');
    loadMessages(conversation.id);
  };

  // Para Kanban e Dashboard (COM modal)
  const selectConversationInKanban = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setIsModalOpen(true);
    loadMessages(conversation.id);
  };

  const canManageConversations = (user: any) => {
    const role = user?.profile?.user_roles?.[0]?.role;
    return role === 'admin' || role === 'gerente' || role === 'agente';
  };

  const handleAssignToMeInList = async (conversation: Conversation) => {
    if (!currentUser?.id) return;
    
    try {
      const updates: any = {
        assigned_to: currentUser.id,
        assigned_at: new Date().toISOString(),
        status: 'in_progress',
        ai_enabled: false
      };

      if (!conversation.first_response_time && conversation.human_requested_at) {
        const requestedAt = new Date(conversation.human_requested_at);
        const now = new Date();
        updates.first_response_time = Math.floor(
          (now.getTime() - requestedAt.getTime()) / 1000
        );
      }

      await supabase
        .from('chat_conversations')
        .update(updates)
        .eq('id', conversation.id);

      toast({
        title: 'Atendimento assumido',
        description: 'Você agora é responsável por este atendimento',
      });
      
      loadConversations(dateFilter.startDate, dateFilter.endDate);
      selectConversationInList({ ...conversation, ...updates });
    } catch (error) {
      console.error('Erro ao assumir atendimento:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível assumir o atendimento',
        variant: 'destructive',
      });
    }
  };

  const handleToggleAIInList = async (conversation: Conversation) => {
    try {
      const newAiState = !conversation.ai_enabled;
      
      await supabase
        .from('chat_conversations')
        .update({ ai_enabled: newAiState })
        .eq('id', conversation.id);

      toast({
        title: newAiState ? 'IA ativada' : 'IA desativada',
        description: newAiState 
          ? 'A IA pode responder ao usuário' 
          : 'Você está no controle do atendimento',
      });
      
      loadConversations(dateFilter.startDate, dateFilter.endDate);
      selectConversationInList({ ...conversation, ai_enabled: newAiState });
    } catch (error) {
      console.error('Erro ao alternar IA:', error);
    }
  };

  const handleResolveInList = async (conversation: Conversation) => {
    try {
      await supabase
        .from('chat_conversations')
        .update({
          status: 'closed',
          resolved_at: new Date().toISOString(),
          ended_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

      toast({
        title: 'Atendimento resolvido',
        description: 'O atendimento foi marcado como resolvido',
      });
      
      loadConversations(dateFilter.startDate, dateFilter.endDate);
      setSelectedConversation(null);
    } catch (error) {
      console.error('Erro ao resolver:', error);
    }
  };

  const handleSaveNotes = async (conversation: Conversation) => {
    try {
      await supabase
        .from('chat_conversations')
        .update({ agent_notes: agentNotes })
        .eq('id', conversation.id);

      toast({
        title: 'Notas salvas',
        description: 'As notas internas foram salvas com sucesso',
      });
      
      loadConversations(dateFilter.startDate, dateFilter.endDate);
    } catch (error) {
      console.error('Erro ao salvar notas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as notas',
        variant: 'destructive',
      });
    }
  };

  const handleSendReplyInList = async (conversation: Conversation) => {
    if (!replyMessage.trim()) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', currentUser?.id)
        .single();

      const agentName = profile?.display_name || 'Agente';
      const messageContent = `[AGENTE: ${agentName}]\n${replyMessage}`;

      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation.id,
          content: messageContent,
          is_user: false,
          message_order: messages.length + 1
        });

      await supabase
        .from('chat_conversations')
        .update({ 
          total_messages: messages.length + 1
        })
        .eq('id', conversation.id);

      setReplyMessage('');
      loadMessages(conversation.id);
      
      toast({
        title: 'Mensagem enviada',
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
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

  const handleDateFilterChange = (startDate: Date | null, endDate: Date | null) => {
    setDateFilter({ startDate, endDate });
    loadStats(startDate, endDate);
    loadConversations(startDate, endDate);
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
      <DateRangeFilter onFilterChange={handleDateFilterChange} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card - Total Conversas */}
              <Card className="group bg-white rounded-xl shadow-lg border border-apolar-light-gray hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-apolar-dark-gray uppercase tracking-wide">
                      Total de Conversas
                    </CardTitle>
                    <div className="text-4xl font-bold text-apolar-blue mt-2">
                      {stats.totalConversations}
                    </div>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-apolar-blue/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageSquare className="h-7 w-7 text-apolar-blue" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-medium text-green-600">+12% vs. mês anterior</p>
                  </div>
                </CardContent>
              </Card>

              {/* Card - Total Mensagens */}
              <Card className="group bg-white rounded-xl shadow-lg border border-apolar-light-gray hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-apolar-dark-gray uppercase tracking-wide">
                      Total de Mensagens
                    </CardTitle>
                    <div className="text-4xl font-bold text-apolar-blue mt-2">
                      {stats.totalMessages}
                    </div>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-apolar-blue/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="h-7 w-7 text-apolar-blue" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-medium text-green-600">+8% vs. mês anterior</p>
                  </div>
                </CardContent>
              </Card>

              {/* Card - Ativas */}
              <Card className="group bg-white rounded-xl shadow-lg border border-apolar-light-gray hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-apolar-dark-gray uppercase tracking-wide">
                      Conversas Ativas
                    </CardTitle>
                    <div className="text-4xl font-bold text-apolar-blue mt-2">
                      {stats.activeConversations}
                    </div>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-apolar-blue/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-7 w-7 text-apolar-blue" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-sm font-medium text-apolar-dark-gray">Em tempo real</p>
                  </div>
                </CardContent>
              </Card>

              {/* Card - Requisições por conversa */}
              <Card className="group bg-white rounded-xl shadow-lg border border-apolar-light-gray hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-apolar-dark-gray uppercase tracking-wide">
                      Requisições por conversa
                    </CardTitle>
                    <div className="text-4xl font-bold text-apolar-blue mt-2">
                      {stats.avgAiRequestsPerConversation}
                    </div>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-apolar-blue/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Brain className="h-7 w-7 text-apolar-blue" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-apolar-gold" />
                    <p className="text-sm font-medium text-apolar-dark-gray">Média de chamadas à IA</p>
                  </div>
                </CardContent>
              </Card>

              {/* Card - Total de Requisições */}
              <Card className="group bg-white rounded-xl shadow-lg border border-apolar-light-gray hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-apolar-dark-gray uppercase tracking-wide">
                      Total de Requisições
                    </CardTitle>
                    <div className="text-4xl font-bold text-apolar-blue mt-2">
                      {stats.aiRequests}
                    </div>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-apolar-blue/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Sparkles className="h-7 w-7 text-apolar-blue" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-apolar-gold" />
                    <p className="text-sm font-medium text-apolar-dark-gray">Chamadas à API Gemini no período</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Seção de Insights */}
            <InsightsPanel dateFilter={dateFilter} />
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
      <DateRangeFilter onFilterChange={handleDateFilterChange} />
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
                        onClick={() => selectConversationInList(conversation)}
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
                  <div className="flex items-center justify-between">
                    <div>
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
                    </div>
                    
                    {/* Botões de ação para agentes */}
                    {selectedConversation && canManageConversations(currentUser) && (
                      <div className="flex gap-2">
                        {selectedConversation.assigned_to === currentUser?.id ? (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleToggleAIInList(selectedConversation)}
                            >
                              <Bot className="h-4 w-4 mr-1" />
                              {selectedConversation.ai_enabled ? 'Desativar' : 'Ativar'} IA
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => handleResolveInList(selectedConversation)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Resolver
                            </Button>
                          </>
                        ) : !selectedConversation.assigned_to ? (
                          <Button 
                            size="sm"
                            onClick={() => handleAssignToMeInList(selectedConversation)}
                          >
                            <UserCircle className="h-4 w-4 mr-1" />
                            Assumir
                          </Button>
                        ) : (
                          <Badge variant="outline">
                            Atribuído a outro agente
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ScrollArea className="h-[300px]">
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

                  {/* Campo de Notas do Agente */}
                  {selectedConversation && canManageConversations(currentUser) && (
                    <div className="space-y-2 border-t pt-4">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Notas Internas do Agente
                      </Label>
                      <Textarea
                        value={agentNotes}
                        onChange={(e) => setAgentNotes(e.target.value)}
                        placeholder="Adicione notas sobre esta conversa (contexto, observações, próximos passos...)&#10;&#10;Estas notas são internas e não são enviadas ao usuário."
                        className="min-h-[100px] resize-none"
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleSaveNotes(selectedConversation)}
                        className="w-full"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Notas
                      </Button>
                    </div>
                  )}

                  {/* Campo de resposta (visível para agentes quando há mensagens) */}
                  {selectedConversation && canManageConversations(currentUser) && messages.length > 0 && (
                    <div className="space-y-2 border-t pt-4">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Responder ao Usuário
                      </Label>
                      <div className="flex gap-2">
                        <Textarea
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder="Digite sua resposta para o usuário..."
                          className="min-h-[80px] resize-none"
                        />
                        <Button 
                          onClick={() => handleSendReplyInList(selectedConversation)}
                          disabled={!replyMessage.trim()}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
    </div>
  );

  const renderAtendimentos = () => (
    <div className="h-full flex flex-col">
      <DateRangeFilter onFilterChange={handleDateFilterChange} />
      <div className="flex-1">
        <KanbanBoard 
          conversations={conversations} 
          onConversationClick={selectConversationInKanban}
        />
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <Card className="bg-white/40 backdrop-blur-sm border-apolar-blue/20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-apolar-gold/5 via-transparent to-apolar-blue/5" />
        <CardHeader className="relative pb-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-apolar-gold/10 flex items-center justify-center">
              <Settings className="h-6 w-6 text-apolar-gold-alt" />
            </div>
            <div>
              <CardTitle className="text-apolar-gold-alt">Configurações</CardTitle>
              <CardDescription>Gerencie as configurações do sistema</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative pt-0">
          <Tabs defaultValue="prompt" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-100/80">
              <TabsTrigger value="prompt" className="data-[state=active]:bg-white data-[state=active]:text-apolar-gold-alt">
                <Sparkles className="h-4 w-4 mr-2" />
                Prompt da IA
              </TabsTrigger>
              <TabsTrigger value="manuals" className="data-[state=active]:bg-white data-[state=active]:text-apolar-gold-alt">
                <BookOpen className="h-4 w-4 mr-2" />
                Manuais
              </TabsTrigger>
              <TabsTrigger value="general" className="data-[state=active]:bg-white data-[state=active]:text-apolar-gold-alt">
                <Settings className="h-4 w-4 mr-2" />
                Geral
              </TabsTrigger>
              <TabsTrigger value="integrations" className="data-[state=active]:bg-white data-[state=active]:text-apolar-gold-alt">
                <Bot className="h-4 w-4 mr-2" />
                Integrações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="prompt" className="mt-6">
              <PromptEditor />
            </TabsContent>

            <TabsContent value="manuals" className="mt-6">
              <KnowledgeModulesManager />
            </TabsContent>

            <TabsContent value="general" className="mt-6">
              <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
                <CardHeader>
                  <CardTitle className="text-lg">Configurações Gerais</CardTitle>
                  <CardDescription>Em desenvolvimento</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Esta seção permitirá configurar preferências gerais do sistema como notificações, idioma e tema.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations" className="mt-6">
              <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
                <CardHeader>
                  <CardTitle className="text-lg">Integrações</CardTitle>
                  <CardDescription>Em desenvolvimento</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Esta seção permitirá configurar integrações com outros sistemas como Movidesk, WhatsApp e APIs externas.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );

  const renderUsers = () => <UserManagement />;

  return (
    <>
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

      {/* Modal de detalhes da conversa */}
      {selectedConversation && (
        <ConversationDetailModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedConversation(null);
          }}
          conversation={selectedConversation}
          onUpdate={() => {
            loadConversations();
            loadStats();
          }}
        />
      )}
    </>
  );
};

export default Admin;