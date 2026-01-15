import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Sparkles, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  PieChart,
  Clock,
  CheckCircle,
  FileDown,
  Mail
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { EmailInsightDialog } from './EmailInsightDialog';

interface InsightsData {
  summary: string;
  top_topics: Array<{ topic: string; count: number; percentage: number }>;
  recurring_issues: Array<{ issue: string; frequency: number; severity: 'high' | 'medium' | 'low' }>;
  operational_gaps: Array<{ gap: string; recommendation: string }>;
  sentiment_analysis: { positive: number; neutral: number; negative: number };
  trends: Array<{ trend: string; direction: 'up' | 'down' | 'stable'; change: string }>;
}

interface ConversationInsight {
  id: string;
  period_start: string;
  period_end: string;
  insights_data: InsightsData;
  generated_at: string;
  conversation_count: number;
  message_count: number;
}

interface MetricsData {
  totalConversations: number;
  totalMessages: number;
  activeConversations: number;
  aiRequests: number;
  avgAiRequestsPerConversation: number;
}

interface InsightsPanelProps {
  dateFilter?: { startDate: Date | null; endDate: Date | null };
  metrics?: MetricsData;
}

const InsightsPanelComponent: React.FC<InsightsPanelProps> = ({ dateFilter, metrics }) => {
  const [insights, setInsights] = useState<ConversationInsight | null>(null);
  const [insightsHistory, setInsightsHistory] = useState<ConversationInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Memoizar filtro efetivo - usar filtro externo ou padrão de 7 dias
  const effectiveDateFilter = useMemo(() => {
    if (dateFilter?.startDate && dateFilter?.endDate) {
      return dateFilter;
    }
    return { startDate: subDays(new Date(), 7), endDate: new Date() };
  }, [dateFilter?.startDate, dateFilter?.endDate]);

  // Carregar histórico apenas uma vez na montagem
  useEffect(() => {
    loadInsightsHistory();
  }, []);

  const loadInsightsHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversation_insights')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const typedData = data as unknown as ConversationInsight[];
      setInsightsHistory(typedData || []);
      
      if (typedData && typedData.length > 0) {
        setInsights(typedData[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico de insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInsights = async () => {
    if (!effectiveDateFilter.startDate || !effectiveDateFilter.endDate) {
      toast({
        title: 'Selecione um período',
        description: 'É necessário selecionar as datas de início e fim para gerar os insights.',
        variant: 'destructive'
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: {
          period_start: effectiveDateFilter.startDate!.toISOString(),
          period_end: effectiveDateFilter.endDate!.toISOString()
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Insights gerados!',
        description: data.message || 'Análise concluída com sucesso.',
      });

      await loadInsightsHistory();
    } catch (error) {
      console.error('Erro ao gerar insights:', error);
      toast({
        title: 'Erro ao gerar insights',
        description: error instanceof Error ? error.message : 'Tente novamente mais tarde.',
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPdf = async () => {
    if (!insights || !contentRef.current) {
      toast({
        title: 'Nenhum insight para exportar',
        description: 'Gere um insight primeiro.',
        variant: 'destructive'
      });
      return;
    }

    setExportingPdf(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      const periodStart = format(new Date(insights.period_start), 'dd-MM-yyyy');
      const periodEnd = format(new Date(insights.period_end), 'dd-MM-yyyy');
      pdf.save(`insights-conversas-${periodStart}-a-${periodEnd}.pdf`);

      toast({
        title: 'PDF exportado!',
        description: 'O arquivo foi baixado com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o PDF.',
        variant: 'destructive'
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const selectInsight = (insight: ConversationInsight) => {
    setInsights(insight);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-apolar-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com botão de gerar e ações */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-apolar-blue/10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-apolar-blue" />
          <span className="font-medium text-apolar-blue">Insights do Período</span>
          {effectiveDateFilter.startDate && effectiveDateFilter.endDate && (
            <Badge variant="outline" className="ml-2">
              {format(effectiveDateFilter.startDate, 'dd/MM', { locale: ptBR })} - {format(effectiveDateFilter.endDate, 'dd/MM', { locale: ptBR })}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {insights && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="border-apolar-blue/30 hover:bg-apolar-blue/10"
              >
                {exportingPdf ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                Exportar PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEmailDialogOpen(true)}
                className="border-apolar-blue/30 hover:bg-apolar-blue/10"
              >
                <Mail className="h-4 w-4 mr-2" />
                Enviar por E-mail
              </Button>
            </>
          )}
          <Button 
            onClick={handleGenerateInsights} 
            disabled={generating}
            className="bg-gradient-to-r from-apolar-blue to-apolar-blue-dark hover:opacity-90 text-white"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Insights
              </>
            )}
          </Button>
        </div>
      </div>

      {!insights ? (
        <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-16 w-16 text-apolar-blue/30 mb-4" />
            <h3 className="text-lg font-semibold text-apolar-blue mb-2">Nenhum insight disponível</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Selecione um período no filtro acima e clique em "Gerar Insights" para analisar as conversas com IA.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div ref={contentRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna principal - Insights */}
          <div className="lg:col-span-2 space-y-6">
            {/* Métricas do Período */}
            {metrics && (
              <Card className="bg-gradient-to-br from-apolar-gold/10 to-white border-apolar-gold/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-apolar-blue">
                    <TrendingUp className="h-5 w-5" />
                    Métricas do Período
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-3 bg-white/60 rounded-lg border border-apolar-blue/10">
                      <p className="text-2xl font-bold text-apolar-blue">{metrics.totalConversations}</p>
                      <p className="text-xs text-muted-foreground">Conversas</p>
                    </div>
                    <div className="text-center p-3 bg-white/60 rounded-lg border border-apolar-blue/10">
                      <p className="text-2xl font-bold text-apolar-blue">{metrics.totalMessages}</p>
                      <p className="text-xs text-muted-foreground">Mensagens</p>
                    </div>
                    <div className="text-center p-3 bg-white/60 rounded-lg border border-apolar-blue/10">
                      <p className="text-2xl font-bold text-green-600">{metrics.activeConversations}</p>
                      <p className="text-xs text-muted-foreground">Ativas</p>
                    </div>
                    <div className="text-center p-3 bg-white/60 rounded-lg border border-apolar-blue/10">
                      <p className="text-2xl font-bold text-apolar-blue">{metrics.aiRequests}</p>
                      <p className="text-xs text-muted-foreground">Req. IA</p>
                    </div>
                    <div className="text-center p-3 bg-white/60 rounded-lg border border-apolar-blue/10">
                      <p className="text-2xl font-bold text-apolar-blue">{metrics.avgAiRequestsPerConversation}</p>
                      <p className="text-xs text-muted-foreground">Req./Conv.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Resumo Executivo */}
            <Card className="bg-gradient-to-br from-apolar-blue/5 to-white border-apolar-blue/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-apolar-blue">
                    <Sparkles className="h-5 w-5" />
                    Resumo Executivo
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {insights.conversation_count} conversas • {insights.message_count} mensagens
                  </Badge>
                </div>
                <CardDescription>
                  Período: {format(new Date(insights.period_start), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(insights.period_end), "dd/MM/yyyy", { locale: ptBR })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed">{insights.insights_data.summary}</p>
              </CardContent>
            </Card>

            {/* Top Assuntos */}
            <Card className="bg-white/60 backdrop-blur-sm border-apolar-gold/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-apolar-gold-alt">
                  <MessageSquare className="h-5 w-5" />
                  Top Assuntos Requisitados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.insights_data.top_topics.map((topic, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 bg-white/50 rounded-lg border border-apolar-blue/10">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-apolar-gold to-apolar-gold-alt flex items-center justify-center text-sm font-bold text-apolar-blue">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{topic.topic}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-gradient-to-r from-apolar-blue to-apolar-gold h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(topic.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">
                        {topic.count}x ({topic.percentage}%)
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Problemas Recorrentes */}
            <Card className="bg-white/60 backdrop-blur-sm border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Problemas Recorrentes
                </CardTitle>
                <CardDescription>Gaps identificados que necessitam atenção</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.insights_data.recurring_issues.map((issue, index) => (
                    <div key={index} className="p-4 bg-white/80 rounded-lg border border-red-100">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{issue.issue}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Frequência: {issue.frequency}x no período
                          </p>
                        </div>
                        <Badge className={getSeverityColor(issue.severity)}>
                          {issue.severity === 'high' ? 'Alta' : issue.severity === 'medium' ? 'Média' : 'Baixa'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Gaps Operacionais */}
            <Card className="bg-white/60 backdrop-blur-sm border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Lightbulb className="h-5 w-5" />
                  Oportunidades de Melhoria
                </CardTitle>
                <CardDescription>Recomendações baseadas nas análises</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights.insights_data.operational_gaps.map((gap, index) => (
                    <div key={index} className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">{gap.gap}</p>
                          <p className="text-sm text-blue-700 mt-2 bg-blue-100/50 rounded px-2 py-1">
                            💡 {gap.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna lateral */}
          <div className="space-y-6">
            {/* Análise de Sentimento */}
            <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-apolar-blue text-lg">
                  <PieChart className="h-5 w-5" />
                  Sentimento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700">😊 Positivo</span>
                    <span className="font-medium">{insights.insights_data.sentiment_analysis.positive}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-green-500 h-3 rounded-full transition-all"
                      style={{ width: `${insights.insights_data.sentiment_analysis.positive}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-yellow-700">😐 Neutro</span>
                    <span className="font-medium">{insights.insights_data.sentiment_analysis.neutral}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-yellow-500 h-3 rounded-full transition-all"
                      style={{ width: `${insights.insights_data.sentiment_analysis.neutral}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-700">😞 Negativo</span>
                    <span className="font-medium">{insights.insights_data.sentiment_analysis.negative}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-red-500 h-3 rounded-full transition-all"
                      style={{ width: `${insights.insights_data.sentiment_analysis.negative}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tendências */}
            <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-apolar-blue text-lg">
                  <TrendingUp className="h-5 w-5" />
                  Tendências
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.insights_data.trends.map((trend, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white/50 rounded-lg border border-apolar-blue/10">
                      {getTrendIcon(trend.direction)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{trend.trend}</p>
                        <p className="text-xs text-muted-foreground">{trend.change}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Histórico de Insights */}
            <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-apolar-blue text-lg">
                  <Clock className="h-5 w-5" />
                  Histórico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {insightsHistory.map((hist) => (
                      <button
                        key={hist.id}
                        onClick={() => selectInsight(hist)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          insights?.id === hist.id 
                            ? 'bg-apolar-blue/10 border-apolar-blue/30' 
                            : 'bg-white/50 border-apolar-blue/10 hover:bg-white/80'
                        }`}
                      >
                        <p className="text-sm font-medium text-foreground">
                          {format(new Date(hist.generated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {hist.conversation_count} conversas analisadas
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Dialog de envio por e-mail */}
      {insights && (
        <EmailInsightDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          insightId={insights.id}
          insightTitle={`Insights ${format(new Date(insights.period_start), 'dd/MM', { locale: ptBR })} - ${format(new Date(insights.period_end), 'dd/MM', { locale: ptBR })}`}
          insightType="conversation"
          metrics={metrics}
        />
      )}
    </div>
  );
};

// Componente memoizado com comparação customizada para evitar re-renders desnecessários
export const InsightsPanel = React.memo(InsightsPanelComponent, (prevProps, nextProps) => {
  // Retorna true se as props são iguais (não precisa re-render)
  const dateEqual = 
    prevProps.dateFilter?.startDate?.getTime() === nextProps.dateFilter?.startDate?.getTime() &&
    prevProps.dateFilter?.endDate?.getTime() === nextProps.dateFilter?.endDate?.getTime();
  
  const metricsEqual = 
    prevProps.metrics?.totalConversations === nextProps.metrics?.totalConversations &&
    prevProps.metrics?.totalMessages === nextProps.metrics?.totalMessages &&
    prevProps.metrics?.activeConversations === nextProps.metrics?.activeConversations &&
    prevProps.metrics?.aiRequests === nextProps.metrics?.aiRequests &&
    prevProps.metrics?.avgAiRequestsPerConversation === nextProps.metrics?.avgAiRequestsPerConversation;
  
  return dateEqual && metricsEqual;
});
