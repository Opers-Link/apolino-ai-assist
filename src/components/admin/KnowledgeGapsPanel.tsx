import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, FileQuestion, Frown, Headset, Lightbulb, Loader2, Download, Search, BookOpen } from 'lucide-react';

interface GapTopic {
  topic: string;
  gap_type: string;
  occurrences: number;
  severity: 'high' | 'medium' | 'low';
  example_question?: string;
  related_manual?: string | null;
  recommendation?: string;
  conversation_ids?: string[];
}
interface Report {
  id: string;
  created_at: string;
  period_start: string;
  period_end: string;
  conversation_count: number;
  flagged_count: number;
  report_data: { summary: string; counts: { not_found: number; unhappy: number; escalated: number; suggestions: number }; topics: GapTopic[] };
}

const gapLabel: Record<string, string> = {
  sem_resposta: 'Sem resposta nos manuais',
  insatisfeito: 'Usuário insatisfeito',
  escalado: 'Escalado p/ humano',
  sugestao: 'Sugestão de usuário',
};
const sevClass: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
};
const sevLabel: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };

interface Props {
  dateFilter: { startDate: Date | null; endDate: Date | null };
  onOpenConversation?: (id: string) => void;
}

export function KnowledgeGapsPanel({ dateFilter, onOpenConversation }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('knowledge_gap_reports' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setReport(data as unknown as Report);
    })();
  }, []);

  const analyze = async () => {
    setLoading(true);
    const end = dateFilter.endDate ?? new Date();
    const start = dateFilter.startDate ?? new Date(end.getTime() - 30 * 86400000);
    const { data, error } = await supabase.functions.invoke('analyze-knowledge-gaps', {
      body: { period_start: start.toISOString(), period_end: end.toISOString() },
    });
    setLoading(false);
    const msg = (data as any)?.error || (error as any)?.context?.error || error?.message;
    if (error || (data as any)?.error) {
      let detail = msg;
      try { detail = (await (error as any)?.context?.json?.())?.error || msg; } catch { /* ignore */ }
      toast({ title: 'Não foi possível analisar', description: detail, variant: 'destructive' });
      return;
    }
    setReport((data as any).report);
    toast({ title: 'Análise concluída', description: 'Lacunas de conhecimento atualizadas.' });
  };

  const exportCsv = () => {
    if (!report) return;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Assunto', 'Tipo', 'Ocorrências', 'Severidade', 'Exemplo', 'Manual relacionado', 'Recomendação'],
      ...report.report_data.topics.map((t) => [t.topic, gapLabel[t.gap_type] || t.gap_type, t.occurrences, sevLabel[t.severity] || t.severity, t.example_question, t.related_manual || '', t.recommendation]),
    ];
    const blob = new Blob(['\ufeff' + rows.map((r) => r.map(esc).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lacunas-conhecimento-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const counts = report?.report_data.counts;
  const cards = [
    { label: 'Sem resposta nos manuais', value: counts?.not_found, icon: FileQuestion },
    { label: 'Usuário insatisfeito', value: counts?.unhappy, icon: Frown },
    { label: 'Escalado para humano', value: counts?.escalated, icon: Headset },
    { label: 'Sugestões de refinamento', value: counts?.suggestions, icon: Lightbulb },
  ];

  return (
    <Card className="bg-white/70 backdrop-blur-xl border-apolar-blue/10 shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-apolar-blue">
            <AlertTriangle className="h-5 w-5 text-apolar-gold" /> Lacunas de Conhecimento
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Assuntos que a IA não esclareceu — use para saber quais manuais complementar.
          </p>
          {report && (
            <p className="text-xs text-muted-foreground mt-1">
              Última análise: {new Date(report.created_at).toLocaleString('pt-BR')} · período {new Date(report.period_start).toLocaleDateString('pt-BR')} a {new Date(report.period_end).toLocaleDateString('pt-BR')} · {report.flagged_count} de {report.conversation_count} conversas sinalizadas
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {report && report.report_data.topics.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
          )}
          <Button size="sm" onClick={analyze} disabled={loading} className="bg-apolar-blue hover:bg-apolar-blue-dark">
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
            {loading ? 'Analisando…' : 'Analisar lacunas'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!report ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma análise ainda. Escolha o período no filtro acima (padrão: últimos 30 dias) e clique em "Analisar lacunas".
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {cards.map((c) => (
                <div key={c.label} className="rounded-xl border border-apolar-blue/10 bg-white/60 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><c.icon className="h-4 w-4 text-apolar-blue" />{c.label}</div>
                  <div className="text-2xl font-bold text-apolar-blue mt-1">{c.value ?? 0}</div>
                </div>
              ))}
            </div>
            {report.report_data.summary && (
              <p className="text-sm text-apolar-dark-gray bg-apolar-gold/10 rounded-lg p-3">{report.report_data.summary}</p>
            )}
            <div className="space-y-3">
              {report.report_data.topics.map((t, i) => (
                <div key={i} className="rounded-xl border border-apolar-blue/10 bg-white/60 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-apolar-blue">{i + 1}. {t.topic}</span>
                    <Badge variant="outline">{t.occurrences} caso(s)</Badge>
                    <Badge variant="outline">{gapLabel[t.gap_type] || t.gap_type}</Badge>
                    <Badge variant="outline" className={sevClass[t.severity]}>{sevLabel[t.severity] || t.severity}</Badge>
                  </div>
                  {t.example_question && <p className="text-sm italic text-muted-foreground">“{t.example_question}”</p>}
                  {t.recommendation && <p className="text-sm"><strong>O que complementar:</strong> {t.recommendation}</p>}
                  <p className="text-xs flex items-center gap-1 text-muted-foreground">
                    <BookOpen className="h-3 w-3" /> Manual relacionado: {t.related_manual || 'nenhum — avaliar novo material'}
                  </p>
                  {onOpenConversation && t.conversation_ids && t.conversation_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {t.conversation_ids.slice(0, 5).map((id, j) => (
                        <Button key={id} variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onOpenConversation(id)}>
                          Ver conversa {j + 1}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {report.report_data.topics.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma lacuna encontrada nesse período.</p>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
