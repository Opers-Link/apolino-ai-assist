import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Check, X, Edit2, Trash2, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface KnowledgeModule {
  id: string;
  name: string;
  variable_name: string;
  version: string | null;
}

interface FAQCategory {
  id: string;
  name: string;
  icon: string;
}

interface GeneratedQuestion {
  question: string;
  answer: string;
  selected: boolean;
  editing: boolean;
}

interface GenerateFAQDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FAQCategory[];
  onSuccess: () => void;
}

export function GenerateFAQDialog({ open, onOpenChange, categories, onSuccess }: GenerateFAQDialogProps) {
  const [step, setStep] = useState<'config' | 'preview'>('config');
  const [modules, setModules] = useState<KnowledgeModule[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  
  // Config form
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [questionCount, setQuestionCount] = useState<number>(10);
  
  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [sourceModuleName, setSourceModuleName] = useState('');
  
  // Saving state
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadModules();
      setStep('config');
      setGeneratedQuestions([]);
    }
  }, [open]);

  const loadModules = async () => {
    try {
      setLoadingModules(true);
      const { data, error } = await supabase
        .from('knowledge_modules')
        .select('id, name, variable_name, version')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      console.error('Erro ao carregar módulos:', error);
      toast.error('Erro ao carregar módulos de conhecimento');
    } finally {
      setLoadingModules(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedModuleId || !selectedCategoryId) {
      toast.error('Selecione o módulo e a categoria');
      return;
    }

    try {
      setGenerating(true);
      
      const { data, error } = await supabase.functions.invoke('generate-faq-from-knowledge', {
        body: {
          module_id: selectedModuleId,
          question_count: questionCount
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const questions = data.questions.map((q: { question: string; answer: string }) => ({
        ...q,
        selected: true,
        editing: false
      }));

      setGeneratedQuestions(questions);
      setSourceModuleName(data.module_name);
      setStep('preview');
      toast.success(`${questions.length} perguntas geradas com sucesso!`);
    } catch (error) {
      console.error('Erro ao gerar FAQ:', error);
      toast.error('Erro ao gerar perguntas. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelectAll = (selected: boolean) => {
    setGeneratedQuestions(prev => prev.map(q => ({ ...q, selected })));
  };

  const toggleQuestion = (index: number) => {
    setGeneratedQuestions(prev => prev.map((q, i) => 
      i === index ? { ...q, selected: !q.selected } : q
    ));
  };

  const startEditing = (index: number) => {
    setGeneratedQuestions(prev => prev.map((q, i) => 
      i === index ? { ...q, editing: true } : q
    ));
  };

  const saveEdit = (index: number, question: string, answer: string) => {
    setGeneratedQuestions(prev => prev.map((q, i) => 
      i === index ? { ...q, question, answer, editing: false } : q
    ));
  };

  const cancelEdit = (index: number) => {
    setGeneratedQuestions(prev => prev.map((q, i) => 
      i === index ? { ...q, editing: false } : q
    ));
  };

  const removeQuestion = (index: number) => {
    setGeneratedQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const selectedQuestions = generatedQuestions.filter(q => q.selected);
    
    if (selectedQuestions.length === 0) {
      toast.error('Selecione pelo menos uma pergunta para salvar');
      return;
    }

    try {
      setSaving(true);

      // Buscar ordem atual das perguntas na categoria
      const { data: existingQuestions } = await supabase
        .from('faq_questions')
        .select('display_order')
        .eq('category_id', selectedCategoryId)
        .order('display_order', { ascending: false })
        .limit(1);

      let nextOrder = (existingQuestions?.[0]?.display_order || 0) + 1;

      // Preparar perguntas para inserção
      const questionsToInsert = selectedQuestions.map((q, index) => ({
        category_id: selectedCategoryId,
        question: q.question,
        answer: q.answer,
        display_order: nextOrder + index,
        is_active: true,
        source_module_id: selectedModuleId,
        auto_generated: true
      }));

      const { error } = await supabase
        .from('faq_questions')
        .insert(questionsToInsert);

      if (error) throw error;

      toast.success(`${selectedQuestions.length} perguntas adicionadas ao FAQ!`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar perguntas:', error);
      toast.error('Erro ao salvar perguntas');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = generatedQuestions.filter(q => q.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-apolar-gold" />
            Gerar FAQ com IA
          </DialogTitle>
          <DialogDescription>
            {step === 'config' 
              ? 'Selecione o módulo de conhecimento e configure a geração'
              : `Revise as ${generatedQuestions.length} perguntas geradas a partir de "${sourceModuleName}"`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'config' ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Módulo de Conhecimento (Fonte)</Label>
                <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingModules ? 'Carregando...' : 'Selecione um módulo'} />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map(module => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.name} {module.version && `(v${module.version})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A IA analisará o conteúdo dos PDFs deste módulo para gerar as perguntas
                </p>
              </div>

              <div className="space-y-2">
                <Label>Categoria Destino</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantidade de Perguntas</Label>
                <Select value={String(questionCount)} onValueChange={(v) => setQuestionCount(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 perguntas</SelectItem>
                    <SelectItem value="10">10 perguntas</SelectItem>
                    <SelectItem value="15">15 perguntas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  A geração usa IA e pode levar alguns segundos. Você poderá revisar e editar todas as perguntas antes de salvar.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={!selectedModuleId || !selectedCategoryId || generating}
                className="gap-2 bg-apolar-gold hover:bg-apolar-gold/90 text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Gerar Perguntas
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-4">
                <Checkbox 
                  checked={selectedCount === generatedQuestions.length && generatedQuestions.length > 0}
                  onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedCount} de {generatedQuestions.length} selecionadas
                </span>
              </div>
              <Badge variant="outline" className="bg-apolar-gold/10 text-apolar-gold-alt">
                {sourceModuleName}
              </Badge>
            </div>

            <ScrollArea className="flex-1 max-h-[400px] pr-4">
              <div className="space-y-3 py-2">
                {generatedQuestions.map((q, index) => (
                  <QuestionPreviewCard
                    key={index}
                    question={q}
                    index={index}
                    onToggle={() => toggleQuestion(index)}
                    onEdit={() => startEditing(index)}
                    onSave={(question, answer) => saveEdit(index, question, answer)}
                    onCancel={() => cancelEdit(index)}
                    onRemove={() => removeQuestion(index)}
                  />
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('config')}>
                Voltar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={selectedCount === 0 || saving}
                className="gap-2 bg-apolar-blue hover:bg-apolar-blue/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvar {selectedCount} Perguntas
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface QuestionPreviewCardProps {
  question: GeneratedQuestion;
  index: number;
  onToggle: () => void;
  onEdit: () => void;
  onSave: (question: string, answer: string) => void;
  onCancel: () => void;
  onRemove: () => void;
}

function QuestionPreviewCard({ question, index, onToggle, onEdit, onSave, onCancel, onRemove }: QuestionPreviewCardProps) {
  const [editQuestion, setEditQuestion] = useState(question.question);
  const [editAnswer, setEditAnswer] = useState(question.answer);

  if (question.editing) {
    return (
      <Card className="border-apolar-blue">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Pergunta</Label>
            <Input 
              value={editQuestion} 
              onChange={(e) => setEditQuestion(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Resposta</Label>
            <Textarea 
              value={editAnswer} 
              onChange={(e) => setEditAnswer(e.target.value)}
              className="text-sm min-h-[80px]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={() => onSave(editQuestion, editAnswer)}>
              <Check className="h-4 w-4 mr-1" />
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={question.selected ? 'border-green-200 bg-green-50/50' : 'opacity-60'}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox 
            checked={question.selected}
            onCheckedChange={onToggle}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-800">
                <span className="text-xs text-gray-400 mr-2">#{index + 1}</span>
                {question.question}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={onRemove}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {question.answer}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
