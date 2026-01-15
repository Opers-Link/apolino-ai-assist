// Manual Insights Panel - PDF Export & Email functionality
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileUploadZone, UploadedFile } from './FileUploadZone';
import { ManualInsightsHistory } from './ManualInsightsHistory';
import { EmailInsightDialog } from './EmailInsightDialog';
import { 
  Sparkles, 
  FileUp, 
  Lightbulb, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  Target,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  Meh,
  Loader2,
  FileDown,
  Mail,
  Server,
  CheckSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface InsightsData {
  summary: string;
  systems_affected?: Array<{ 
    system: string; 
    ticket_count: number; 
    main_issues: string[];
  }>;
  top_topics: Array<{ 
    topic: string; 
    count: number; 
    percentage: number;
    example_tickets?: string[];
  }>;
  recurring_issues: Array<{ 
    issue: string; 
    frequency: number; 
    severity: 'high' | 'medium' | 'low';
    probable_cause?: string;
    affected_system?: string;
  }>;
  operational_gaps: Array<{ 
    gap: string; 
    recommendation: string;
    priority?: 'alta' | 'média' | 'baixa';
    estimated_effort?: 'baixo' | 'médio' | 'alto';
  }>;
  action_plan?: Array<{
    action: string;
    responsible: string;
    priority: number;
    expected_impact: string;
  }>;
  sentiment_analysis?: { positive: number; neutral: number; negative: number };
  trends: Array<{ trend: string; direction: 'up' | 'down' | 'stable'; change: string }>;
}

interface SelectedInsight {
  id: string;
  title: string;
  description: string | null;
  insights_data: InsightsData;
  generated_at: string;
  file_count: number;
  total_records: number;
}

export function ManualInsightsPanel() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<SelectedInsight | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleExportPdf = async () => {
    if (!resultsRef.current || !selectedInsight) return;

    setExportingPdf(true);
    try {
      const canvas = await html2canvas(resultsRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      
      const fileName = `${selectedInsight.title.replace(/[^a-zA-Z0-9]/g, '-')}-insights.pdf`;
      pdf.save(fileName);

      toast({
        title: 'PDF exportado!',
        description: `Arquivo "${fileName}" baixado com sucesso`,
      });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast({
        title: 'Erro ao exportar PDF',
        description: 'Não foi possível gerar o arquivo PDF',
        variant: 'destructive',
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Informe um título para o relatório',
        variant: 'destructive',
      });
      return;
    }

    if (files.length === 0) {
      toast({
        title: 'Arquivos obrigatórios',
        description: 'Adicione pelo menos um arquivo para análise',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);

    try {
      // 1. Upload dos arquivos para o storage
      const uploadedFiles: Array<{ file_path: string; file_name: string; file_type: string }> = [];

      for (const file of files) {
        const filePath = `${Date.now()}-${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('manual-insights-files')
          .upload(filePath, file.file);

        if (uploadError) {
          throw new Error(`Erro ao enviar ${file.name}: ${uploadError.message}`);
        }

        uploadedFiles.push({
          file_path: filePath,
          file_name: file.name,
          file_type: file.type,
        });
      }

      // 2. Chamar a edge function
      const { data, error } = await supabase.functions.invoke('generate-manual-insights', {
        body: {
          title: title.trim(),
          description: description.trim() || undefined,
          period_start: periodStart || undefined,
          period_end: periodEnd || undefined,
          files: uploadedFiles,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Insights gerados!',
        description: data.message || 'Análise concluída com sucesso',
      });

      // Limpar formulário e selecionar o novo insight
      setFiles([]);
      setTitle('');
      setDescription('');
      setPeriodStart('');
      setPeriodEnd('');
      
      if (data?.insight) {
        setSelectedInsight(data.insight);
      }
      
      setRefreshTrigger(prev => prev + 1);

    } catch (error) {
      console.error('Erro ao gerar insights:', error);
      toast({
        title: 'Erro ao gerar insights',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta': return 'border-red-300 text-red-600 bg-red-50';
      case 'média': return 'border-yellow-300 text-yellow-600 bg-yellow-50';
      case 'baixa': return 'border-green-300 text-green-600 bg-green-50';
      default: return 'border-gray-300 text-gray-600 bg-gray-50';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const insights = selectedInsight?.insights_data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna de Upload e Configuração */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload de Arquivos */}
          <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-apolar-blue">
                <FileUp className="h-5 w-5" />
                Upload de Dados
              </CardTitle>
              <CardDescription>
                Faça upload de arquivos com tickets de suporte, feedbacks ou dados para análise
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                files={files}
                onFilesChange={setFiles}
                disabled={generating}
              />
            </CardContent>
          </Card>

          {/* Configurações */}
          <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
            <CardHeader>
              <CardTitle className="text-apolar-blue text-lg">Configurações do Relatório</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título do Relatório *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Análise de Tickets Janeiro 2025"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={generating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição / Contexto</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o contexto dos dados. Ex: Tickets de suporte abertos para TI no mês de janeiro, incluindo todos os sistemas."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={generating}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="periodStart">Período Início</Label>
                  <Input
                    id="periodStart"
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    disabled={generating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodEnd">Período Fim</Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    disabled={generating}
                  />
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating || files.length === 0 || !title.trim()}
                className="w-full bg-gradient-to-r from-apolar-blue to-apolar-blue-dark hover:from-apolar-blue-dark hover:to-apolar-blue text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando dados...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar Insights
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Coluna de Histórico */}
        <div>
          <ManualInsightsHistory
            onSelectInsight={setSelectedInsight}
            selectedInsightId={selectedInsight?.id}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>

      {/* Resultados */}
      {insights && selectedInsight && (
        <div className="space-y-6" ref={resultsRef}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-xl font-semibold text-apolar-blue flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              {selectedInsight.title}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">
                {selectedInsight.file_count} arquivo(s) • {selectedInsight.total_records} registros
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="gap-2"
              >
                {exportingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                Exportar PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEmailDialogOpen(true)}
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                Enviar por E-mail
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Resumo Executivo */}
            <Card className="lg:col-span-2 bg-gradient-to-br from-apolar-blue/5 to-apolar-gold/5 border-apolar-blue/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-apolar-blue">📊 Resumo Executivo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-apolar-dark-gray leading-relaxed">{insights.summary}</p>
              </CardContent>
            </Card>

            {/* Sistemas Afetados - Nova Seção */}
            {insights.systems_affected && insights.systems_affected.length > 0 && (
              <Card className="lg:col-span-2 bg-white/60 backdrop-blur-sm border-apolar-blue/10">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-apolar-blue">
                    <Server className="h-5 w-5" />
                    Sistemas Afetados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {insights.systems_affected.map((sys, idx) => (
                      <div key={idx} className="p-4 bg-white rounded-lg border border-apolar-light-gray hover:shadow-md transition-shadow">
                        <p className="font-semibold text-apolar-blue truncate" title={sys.system}>{sys.system}</p>
                        <p className="text-2xl font-bold text-apolar-gold-alt">{sys.ticket_count}</p>
                        <p className="text-xs text-muted-foreground mb-2">tickets</p>
                        <div className="space-y-1">
                          {sys.main_issues.slice(0, 2).map((issue, i) => (
                            <p key={i} className="text-xs text-muted-foreground truncate" title={issue}>• {issue}</p>
                          ))}
                          {sys.main_issues.length > 2 && (
                            <p className="text-xs text-muted-foreground">+{sys.main_issues.length - 2} outros</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Plano de Ação - Nova Seção */}
            {insights.action_plan && insights.action_plan.length > 0 && (
              <Card className="lg:col-span-2 bg-white/60 backdrop-blur-sm border-apolar-blue/10">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-apolar-blue">
                    <CheckSquare className="h-5 w-5" />
                    Plano de Ação Recomendado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.action_plan.map((action, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 bg-white rounded-lg border border-apolar-light-gray hover:shadow-sm transition-shadow">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-apolar-blue flex items-center justify-center text-white font-bold text-lg">
                          {action.priority}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-apolar-blue">{action.action}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                            <Badge variant="outline" className="bg-white">
                              {action.responsible}
                            </Badge>
                            <span className="text-muted-foreground">
                              Impacto: {action.expected_impact}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Principais Tópicos */}
            <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-apolar-blue">
                  <BarChart3 className="h-5 w-5" />
                  Principais Tópicos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-3">
                    {insights.top_topics?.map((topic, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-lg border border-apolar-light-gray">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-apolar-blue">{topic.topic}</p>
                            <p className="text-xs text-muted-foreground">{topic.count} menções</p>
                          </div>
                          <Badge className="bg-apolar-gold/20 text-apolar-gold-alt border-apolar-gold/30 flex-shrink-0">
                            {topic.percentage}%
                          </Badge>
                        </div>
                        {topic.example_tickets && topic.example_tickets.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2 italic truncate" title={topic.example_tickets[0]}>
                            Ex: "{topic.example_tickets[0]}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Problemas Recorrentes */}
            <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-apolar-blue">
                  <AlertTriangle className="h-5 w-5" />
                  Problemas Recorrentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-3">
                    {insights.recurring_issues?.map((issue, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-lg border border-apolar-light-gray">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-apolar-blue flex-1">{issue.issue}</p>
                          <Badge className={`flex-shrink-0 ${getSeverityColor(issue.severity)}`}>
                            {issue.severity === 'high' ? 'Alta' : issue.severity === 'medium' ? 'Média' : 'Baixa'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>Frequência: {issue.frequency}x</span>
                          {issue.affected_system && (
                            <span className="bg-gray-100 px-2 py-0.5 rounded">{issue.affected_system}</span>
                          )}
                        </div>
                        {issue.probable_cause && (
                          <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5 mt-2">
                            <strong>Causa provável:</strong> {issue.probable_cause}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Lacunas Operacionais */}
            <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-apolar-blue">
                  <Target className="h-5 w-5" />
                  Oportunidades de Melhoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-3">
                    {insights.operational_gaps?.map((gap, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-lg border border-apolar-light-gray">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-apolar-blue flex-1">{gap.gap}</p>
                          {gap.priority && (
                            <Badge variant="outline" className={`flex-shrink-0 ${getPriorityColor(gap.priority)}`}>
                              {gap.priority}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          💡 {gap.recommendation}
                        </p>
                        {gap.estimated_effort && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Esforço estimado: <span className="font-medium">{gap.estimated_effort}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Análise de Sentimento */}
            {insights.sentiment_analysis && (
              <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-apolar-blue">Análise de Sentimento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <ThumbsUp className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-green-700">Positivo</span>
                      </div>
                      <span className="text-2xl font-bold text-green-600">
                        {insights.sentiment_analysis.positive || 0}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Meh className="h-5 w-5 text-gray-600" />
                        <span className="font-medium text-gray-700">Neutro</span>
                      </div>
                      <span className="text-2xl font-bold text-gray-600">
                        {insights.sentiment_analysis.neutral || 0}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <ThumbsDown className="h-5 w-5 text-red-600" />
                        <span className="font-medium text-red-700">Negativo</span>
                      </div>
                      <span className="text-2xl font-bold text-red-600">
                        {insights.sentiment_analysis.negative || 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tendências */}
            {insights.trends && insights.trends.length > 0 && (
              <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-apolar-blue">
                    <TrendingUp className="h-5 w-5" />
                    Tendências Observadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      {insights.trends.map((trend, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-apolar-light-gray">
                          <div className="mt-0.5">
                            {getTrendIcon(trend.direction)}
                          </div>
                          <div>
                            <p className="font-medium text-apolar-blue">{trend.trend}</p>
                            <p className="text-sm text-muted-foreground">{trend.change}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Estado vazio quando não há insight selecionado */}
      {!insights && (
        <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-apolar-blue/10 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-apolar-blue" />
            </div>
            <h3 className="text-lg font-semibold text-apolar-blue mb-2">
              Nenhum insight selecionado
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              Faça upload de arquivos e gere novos insights, ou selecione um relatório do histórico para visualizar os resultados.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Email */}
      {selectedInsight && (
        <EmailInsightDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          insightType="manual"
          insightId={selectedInsight.id}
          insightTitle={selectedInsight.title}
        />
      )}
    </div>
  );
}
