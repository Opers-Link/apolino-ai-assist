import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Save, 
  History, 
  RotateCcw, 
  Info, 
  Sparkles,
  Clock,
  User,
  FileText,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  description: string | null;
  is_active: boolean;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface PromptHistory {
  id: string;
  prompt_id: string;
  content: string;
  version: number;
  changed_by: string | null;
  change_reason: string | null;
  changed_at: string;
}

export const PromptEditor = () => {
  const [prompt, setPrompt] = useState<SystemPrompt | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [history, setHistory] = useState<PromptHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPrompt();
    loadHistory();
  }, []);

  useEffect(() => {
    if (prompt) {
      setHasChanges(editedContent !== prompt.content);
    }
  }, [editedContent, prompt]);

  const loadPrompt = async () => {
    try {
      const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .eq('name', 'master_prompt_aia')
        .eq('is_active', true)
        .single();

      if (error) throw error;

      setPrompt(data);
      setEditedContent(data.content);
    } catch (error) {
      console.error('Erro ao carregar prompt:', error);
      toast({
        title: 'Erro ao carregar prompt',
        description: 'Não foi possível carregar o prompt do sistema',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const { data: promptData } = await supabase
        .from('system_prompts')
        .select('id')
        .eq('name', 'master_prompt_aia')
        .single();

      if (!promptData) return;

      const { data, error } = await supabase
        .from('system_prompts_history')
        .select('*')
        .eq('prompt_id', promptData.id)
        .order('changed_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const handleSave = async () => {
    if (!prompt || !changeReason.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Por favor, informe o motivo da alteração',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Salvar versão anterior no histórico
      const { error: historyError } = await supabase
        .from('system_prompts_history')
        .insert({
          prompt_id: prompt.id,
          content: prompt.content,
          version: prompt.version,
          changed_by: user?.id,
          change_reason: changeReason,
        });

      if (historyError) throw historyError;

      // Atualizar prompt
      const { error: updateError } = await supabase
        .from('system_prompts')
        .update({
          content: editedContent,
          version: prompt.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', prompt.id);

      if (updateError) throw updateError;

      toast({
        title: 'Prompt salvo com sucesso!',
        description: `Versão ${prompt.version + 1} ativada`,
      });

      setChangeReason('');
      loadPrompt();
      loadHistory();
    } catch (error) {
      console.error('Erro ao salvar prompt:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as alterações',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (historyItem: PromptHistory) => {
    setEditedContent(historyItem.content);
    setChangeReason(`Restaurado da versão ${historyItem.version}`);
    toast({
      title: 'Conteúdo restaurado',
      description: `Versão ${historyItem.version} carregada no editor. Salve para aplicar.`,
    });
  };

  const dynamicVariables = [
    { name: '{{database_context}}', description: 'Estatísticas e contexto do banco de dados' },
    { name: '{{user_context}}', description: 'Informações do usuário atual (ID, sistema, permissões)' },
    { name: '{{user_name}}', description: 'Nome do usuário atual' },
    { name: '{{VERSAO_MODULOS}}', description: 'Versão global dos módulos de conhecimento' },
    { name: '{{INDICE_DE_MODULOS}}', description: 'Tabela com todos os módulos e seus documentos' },
    { name: '{{MODULO_CRM_SALES}}', description: 'Conteúdo do módulo CRM Sales' },
    { name: '{{MODULO_NET_LOCACAO}}', description: 'Conteúdo do módulo NET Locação' },
    { name: '{{MODULO_NET_VENDAS}}', description: 'Conteúdo do módulo NET Vendas' },
    { name: '{{MODULO_AREA_DO_CLIENTE}}', description: 'Conteúdo do módulo Área do Cliente' },
    { name: '{{MODULO_TRANSVERSAL}}', description: 'Conteúdo do módulo Transversal' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apolar-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-br from-white to-apolar-gold/5 border-apolar-gold/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-apolar-gold via-apolar-gold-alt to-apolar-gold-light flex items-center justify-center shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-apolar-blue">Prompt da AIA</CardTitle>
                <CardDescription>
                  Configure o comportamento e personalidade da assistente
                </CardDescription>
              </div>
            </div>
            {prompt && (
              <Badge variant="outline" className="bg-apolar-gold/10 text-apolar-gold-alt border-apolar-gold/30">
                Versão {prompt.version}
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Principal */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-apolar-blue" />
                  Editor do Master Prompt
                </CardTitle>
                {hasChanges && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Alterações não salvas
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[500px] font-mono text-sm bg-slate-50/80 border-slate-200 focus:border-apolar-gold/50"
                placeholder="Digite o prompt do sistema..."
              />

              <div className="space-y-3 pt-2">
                <Label htmlFor="change-reason" className="text-sm font-medium">
                  Motivo da alteração <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="change-reason"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Ex: Adicionado tutorial de reservas, Ajuste no tom de voz..."
                  className="bg-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !hasChanges || !changeReason.trim()}
                  className="flex-1 bg-gradient-to-r from-apolar-gold via-apolar-gold-alt to-apolar-gold-light hover:opacity-90 text-white"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (prompt) {
                      setEditedContent(prompt.content);
                      setChangeReason('');
                    }
                  }}
                  disabled={!hasChanges}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Descartar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Variáveis Dinâmicas */}
          <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-apolar-blue" />
                Variáveis Dinâmicas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dynamicVariables.map((variable) => (
                  <div
                    key={variable.name}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <code className="text-xs font-mono text-apolar-blue bg-apolar-blue/10 px-1.5 py-0.5 rounded">
                      {variable.name}
                    </code>
                    <p className="text-xs text-muted-foreground mt-1">
                      {variable.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Histórico de Versões */}
          <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-apolar-blue" />
                Histórico de Versões
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma versão anterior
                </p>
              ) : (
                <ScrollArea className="h-[300px] pr-2">
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-apolar-gold/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="secondary" className="text-xs">
                            v{item.version}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(item.changed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {item.change_reason && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {item.change_reason}
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2 h-7 text-xs hover:bg-apolar-gold/10 hover:text-apolar-gold-alt"
                          onClick={() => handleRestore(item)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Restaurar
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Dicas */}
          <Card className="bg-gradient-to-br from-apolar-blue/5 to-white border-apolar-blue/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Dicas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-xs text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-apolar-gold mt-1.5 shrink-0" />
                  Use emojis para organizar seções
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-apolar-gold mt-1.5 shrink-0" />
                  Seja específico nas instruções
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-apolar-gold mt-1.5 shrink-0" />
                  Teste após cada alteração
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-apolar-gold mt-1.5 shrink-0" />
                  Mantenha o tom consistente
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PromptEditor;
