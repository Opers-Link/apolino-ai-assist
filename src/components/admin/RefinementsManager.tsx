import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, AlertTriangle, CheckCircle, Shield, Lightbulb, MessageSquarePlus, Check, X, Pencil } from 'lucide-react';

interface UserSuggestion {
  id: string;
  suggestion: string;
  context: string | null;
  status: string;
  created_at: string;
  external_user_id: string | null;
}

interface Refinement {
  id: string;
  instruction: string;
  category: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  module_hint: string | null;
}

const CATEGORY_OPTIONS = [
  { value: 'correção', label: 'Correção', icon: AlertTriangle, color: 'bg-red-100 text-red-800' },
  { value: 'complemento', label: 'Complemento', icon: Plus, color: 'bg-blue-100 text-blue-800' },
  { value: 'restrição', label: 'Restrição', icon: Shield, color: 'bg-orange-100 text-orange-800' },
  { value: 'dica', label: 'Dica', icon: Lightbulb, color: 'bg-green-100 text-green-800' },
];

export function RefinementsManager() {
  const [refinements, setRefinements] = useState<Refinement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newInstruction, setNewInstruction] = useState('');
  const [newCategory, setNewCategory] = useState('correção');
  const [newPriority, setNewPriority] = useState(0);
  const [newModuleHint, setNewModuleHint] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [suggestionFilter, setSuggestionFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const { toast } = useToast();

  useEffect(() => {
    loadRefinements();
    loadSuggestions();
  }, []);

  const loadRefinements = async () => {
    try {
      const { data, error } = await supabase
        .from('prompt_refinements')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRefinements(data || []);
    } catch (error) {
      console.error('Erro ao carregar refinamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_refinement_suggestions')
        .select('id, suggestion, context, status, created_at, external_user_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Erro ao carregar sugestões:', error);
    }
  };

  const handleApproveSuggestion = async (s: UserSuggestion) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error: insertError } = await supabase
        .from('prompt_refinements')
        .insert({
          instruction: s.suggestion,
          category: 'correção',
          priority: 0,
          created_by: user?.id || null,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('user_refinement_suggestions')
        .update({
          status: 'approved',
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
          promoted_refinement_id: inserted?.id || null,
        })
        .eq('id', s.id);
      if (updateError) throw updateError;

      toast({ title: 'Sugestão aprovada', description: 'Convertida em instrução de refinamento ativa.' });
      loadRefinements();
      loadSuggestions();
    } catch (error) {
      console.error('Erro ao aprovar sugestão:', error);
      toast({ title: 'Erro', description: 'Não foi possível aprovar a sugestão.', variant: 'destructive' });
    }
  };

  const handleRejectSuggestion = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('user_refinement_suggestions')
        .update({
          status: 'rejected',
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      loadSuggestions();
      toast({ title: 'Sugestão rejeitada' });
    } catch (error) {
      console.error('Erro ao rejeitar sugestão:', error);
    }
  };

  const handleDeleteSuggestion = async (id: string) => {
    try {
      const { error } = await supabase.from('user_refinement_suggestions').delete().eq('id', id);
      if (error) throw error;
      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Erro ao remover sugestão:', error);
    }
  };


  const handleAdd = async () => {
    if (!newInstruction.trim()) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('prompt_refinements')
        .insert({
          instruction: newInstruction.trim(),
          category: newCategory,
          priority: newPriority,
          module_hint: newModuleHint.trim() || null,
          created_by: user?.id || null,
        });

      if (error) throw error;

      toast({ title: 'Refinamento adicionado', description: 'A instrução será aplicada nas próximas conversas.' });
      setNewInstruction('');
      setNewCategory('correção');
      setNewPriority(0);
      setNewModuleHint('');
      setShowForm(false);
      loadRefinements();
    } catch (error) {
      console.error('Erro ao adicionar refinamento:', error);
      toast({ title: 'Erro', description: 'Não foi possível adicionar o refinamento.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('prompt_refinements')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      setRefinements(prev => prev.map(r => r.id === id ? { ...r, is_active: !isActive } : r));
    } catch (error) {
      console.error('Erro ao alternar refinamento:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('prompt_refinements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setRefinements(prev => prev.filter(r => r.id !== id));
      toast({ title: 'Refinamento removido' });
    } catch (error) {
      console.error('Erro ao remover refinamento:', error);
    }
  };

  const activeCount = refinements.filter(r => r.is_active).length;
  const getCategoryConfig = (cat: string) => CATEGORY_OPTIONS.find(c => c.value === cat) || CATEGORY_OPTIONS[0];

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando refinamentos...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-apolar-blue">Instruções de Refinamento</h3>
          <p className="text-sm text-muted-foreground">
            Correções e instruções específicas injetadas automaticamente no contexto da IA.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            <CheckCircle className="h-3.5 w-3.5 mr-1 text-green-600" />
            {activeCount} ativa{activeCount !== 1 ? 's' : ''}
          </Badge>
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Novo Refinamento
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-apolar-gold/30 bg-apolar-gold/5">
          <CardContent className="pt-4 space-y-4">
            <div>
              <Label>Instrução *</Label>
              <Textarea
                value={newInstruction}
                onChange={(e) => setNewInstruction(e.target.value)}
                placeholder='Ex: "Quando perguntarem sobre rescisão de contrato de locação, o prazo correto é 30 dias de aviso prévio, NÃO 90 dias."'
                className="min-h-[100px] mt-1"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade (0-10)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={newPriority}
                  onChange={(e) => setNewPriority(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Módulo relacionado (opcional)</Label>
                <Input
                  value={newModuleHint}
                  onChange={(e) => setNewModuleHint(e.target.value)}
                  placeholder="Ex: locação, vendas"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAdd} disabled={!newInstruction.trim() || saving}>
                {saving ? 'Salvando...' : 'Adicionar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {refinements.length === 0 ? (
        <Card className="bg-white/60">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Lightbulb className="h-10 w-10 mx-auto mb-3 text-apolar-gold/50" />
            <p>Nenhum refinamento cadastrado.</p>
            <p className="text-xs mt-1">Adicione instruções para corrigir ou complementar as respostas da IA.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {refinements.map((ref) => {
            const catConfig = getCategoryConfig(ref.category);
            return (
              <Card key={ref.id} className={`bg-white/60 transition-opacity ${!ref.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <Switch
                      checked={ref.is_active}
                      onCheckedChange={() => handleToggle(ref.id, ref.is_active)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap">{ref.instruction}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={`text-xs ${catConfig.color}`}>
                          {catConfig.label}
                        </Badge>
                        {ref.module_hint && (
                          <Badge variant="outline" className="text-xs">
                            {ref.module_hint}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Prioridade: {ref.priority}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ref.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(ref.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sugestões dos usuários */}
      <div className="pt-6 border-t border-apolar-blue/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-apolar-blue flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5" />
              Refinamentos Sugeridos pelo Usuário
            </h3>
            <p className="text-sm text-muted-foreground">
              Sugestões enviadas pelos usuários via chat. Aprove para transformar em instrução ativa.
            </p>
          </div>
          <Select value={suggestionFilter} onValueChange={(v: any) => setSuggestionFilter(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes ({suggestions.filter(s => s.status === 'pending').length})</SelectItem>
              <SelectItem value="approved">Aprovadas</SelectItem>
              <SelectItem value="rejected">Rejeitadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {suggestions.filter(s => s.status === suggestionFilter).length === 0 ? (
          <Card className="bg-white/60">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma sugestão {suggestionFilter === 'pending' ? 'pendente' : suggestionFilter === 'approved' ? 'aprovada' : 'rejeitada'}.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {suggestions.filter(s => s.status === suggestionFilter).map((s) => (
              <Card key={s.id} className="bg-white/60">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap">{s.suggestion}</p>
                      {s.context && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-apolar-blue">
                            Ver contexto da conversa
                          </summary>
                          <pre className="text-xs bg-muted/50 p-2 rounded mt-1 whitespace-pre-wrap font-sans">{s.context}</pre>
                        </details>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {new Date(s.created_at).toLocaleString('pt-BR')}
                        </Badge>
                        {s.external_user_id && (
                          <Badge variant="outline" className="text-xs">user: {s.external_user_id}</Badge>
                        )}
                      </div>
                    </div>
                    {s.status === 'pending' ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => handleApproveSuggestion(s)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-red-700 border-red-300 hover:bg-red-50"
                          onClick={() => handleRejectSuggestion(s.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                          Rejeitar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteSuggestion(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

