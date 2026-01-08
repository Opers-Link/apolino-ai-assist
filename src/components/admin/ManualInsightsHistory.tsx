import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { History, FileText, Calendar, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface ManualInsight {
  id: string;
  title: string;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  source_files: Array<{ file_name: string; file_type: string }>;
  insights_data: any;
  generated_at: string;
  file_count: number;
  total_records: number;
}

interface ManualInsightsHistoryProps {
  onSelectInsight: (insight: ManualInsight) => void;
  selectedInsightId?: string;
  refreshTrigger?: number;
}

export function ManualInsightsHistory({ 
  onSelectInsight, 
  selectedInsightId,
  refreshTrigger 
}: ManualInsightsHistoryProps) {
  const [insights, setInsights] = useState<ManualInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadHistory();
  }, [refreshTrigger]);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('manual_insights')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Type assertion para o source_files
      const typedData = (data || []).map(item => ({
        ...item,
        source_files: item.source_files as Array<{ file_name: string; file_type: string }>
      }));
      
      setInsights(typedData);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Deseja realmente excluir este insight?')) return;

    try {
      const { error } = await supabase
        .from('manual_insights')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Insight excluído',
        description: 'O insight foi removido do histórico',
      });

      loadHistory();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o insight',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card className="bg-white/40 backdrop-blur-sm border-apolar-blue/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-apolar-blue">
            <History className="h-4 w-4" />
            Histórico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/40 backdrop-blur-sm border-apolar-blue/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 text-apolar-blue">
          <History className="h-4 w-4" />
          Histórico de Insights Manuais
          {insights.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {insights.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {insights.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum insight gerado ainda</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-1 p-3">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  onClick={() => onSelectInsight(insight)}
                  className={`
                    p-3 rounded-lg cursor-pointer transition-all duration-200
                    hover:bg-apolar-blue/5 border border-transparent
                    ${selectedInsightId === insight.id 
                      ? 'bg-apolar-blue/10 border-apolar-blue/20' 
                      : 'hover:border-apolar-blue/10'}
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-apolar-blue truncate">
                        {insight.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(insight.generated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {insight.file_count} arquivo(s)
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {insight.total_records} registros
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectInsight(insight);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => handleDelete(insight.id, e)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
