import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, GripVertical, ChevronDown, ChevronRight, Save, X, HelpCircle, Loader2, Eye, EyeOff, Rocket, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { UpdatesManager } from './UpdatesManager';
import { GenerateFAQDialog } from './GenerateFAQDialog';

interface FAQQuestion {
  id: string;
  category_id: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
}

interface FAQCategory {
  id: string;
  name: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  questions?: FAQQuestion[];
}

const ICON_OPTIONS = ['💻', '🏠', '📋', '📢', '💰', '🎧', '❓', '📱', '🔧', '📊', '🗂️', '🔐'];

export function FAQManager() {
  const [categories, setCategories] = useState<FAQCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Category dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FAQCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: '❓', is_active: true });
  
  // Question dialog
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<FAQQuestion | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState({ question: '', answer: '', is_active: true });
  
  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ type: 'category' | 'question'; id: string; name: string } | null>(null);
  
  // Generate FAQ dialog
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);

  useEffect(() => {
    loadFAQData();
  }, []);

  const loadFAQData = async () => {
    try {
      setLoading(true);
      
      // Load categories
      const { data: categoriesData, error: catError } = await supabase
        .from('faq_categories')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (catError) throw catError;
      
      // Load questions
      const { data: questionsData, error: qError } = await supabase
        .from('faq_questions')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (qError) throw qError;
      
      // Combine data
      const categoriesWithQuestions = (categoriesData || []).map(cat => ({
        ...cat,
        questions: (questionsData || []).filter(q => q.category_id === cat.id)
      }));
      
      setCategories(categoriesWithQuestions);
    } catch (error) {
      console.error('Erro ao carregar FAQ:', error);
      toast.error('Erro ao carregar dados do FAQ');
    } finally {
      setLoading(false);
    }
  };

  // Category CRUD
  const openCategoryDialog = (category?: FAQCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ name: category.name, icon: category.icon, is_active: category.is_active });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', icon: '❓', is_active: true });
    }
    setCategoryDialogOpen(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Nome da categoria é obrigatório');
      return;
    }
    
    try {
      setSaving(true);
      
      if (editingCategory) {
        const { error } = await supabase
          .from('faq_categories')
          .update({
            name: categoryForm.name,
            icon: categoryForm.icon,
            is_active: categoryForm.is_active
          })
          .eq('id', editingCategory.id);
        
        if (error) throw error;
        toast.success('Categoria atualizada');
      } else {
        const maxOrder = Math.max(...categories.map(c => c.display_order), -1);
        const { error } = await supabase
          .from('faq_categories')
          .insert({
            name: categoryForm.name,
            icon: categoryForm.icon,
            is_active: categoryForm.is_active,
            display_order: maxOrder + 1
          });
        
        if (error) throw error;
        toast.success('Categoria criada');
      }
      
      setCategoryDialogOpen(false);
      loadFAQData();
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      toast.error('Erro ao salvar categoria');
    } finally {
      setSaving(false);
    }
  };

  // Question CRUD
  const openQuestionDialog = (categoryId: string, question?: FAQQuestion) => {
    setSelectedCategoryId(categoryId);
    if (question) {
      setEditingQuestion(question);
      setQuestionForm({ question: question.question, answer: question.answer, is_active: question.is_active });
    } else {
      setEditingQuestion(null);
      setQuestionForm({ question: '', answer: '', is_active: true });
    }
    setQuestionDialogOpen(true);
  };

  const saveQuestion = async () => {
    if (!questionForm.question.trim() || !questionForm.answer.trim()) {
      toast.error('Pergunta e resposta são obrigatórias');
      return;
    }
    
    try {
      setSaving(true);
      
      if (editingQuestion) {
        const { error } = await supabase
          .from('faq_questions')
          .update({
            question: questionForm.question,
            answer: questionForm.answer,
            is_active: questionForm.is_active
          })
          .eq('id', editingQuestion.id);
        
        if (error) throw error;
        toast.success('Pergunta atualizada');
      } else {
        const category = categories.find(c => c.id === selectedCategoryId);
        const maxOrder = Math.max(...(category?.questions?.map(q => q.display_order) || []), -1);
        
        const { error } = await supabase
          .from('faq_questions')
          .insert({
            category_id: selectedCategoryId,
            question: questionForm.question,
            answer: questionForm.answer,
            is_active: questionForm.is_active,
            display_order: maxOrder + 1
          });
        
        if (error) throw error;
        toast.success('Pergunta criada');
      }
      
      setQuestionDialogOpen(false);
      loadFAQData();
    } catch (error) {
      console.error('Erro ao salvar pergunta:', error);
      toast.error('Erro ao salvar pergunta');
    } finally {
      setSaving(false);
    }
  };

  // Delete handlers
  const confirmDelete = async () => {
    if (!deleteDialog) return;
    
    try {
      setSaving(true);
      
      if (deleteDialog.type === 'category') {
        const { error } = await supabase
          .from('faq_categories')
          .delete()
          .eq('id', deleteDialog.id);
        
        if (error) throw error;
        toast.success('Categoria excluída');
      } else {
        const { error } = await supabase
          .from('faq_questions')
          .delete()
          .eq('id', deleteDialog.id);
        
        if (error) throw error;
        toast.success('Pergunta excluída');
      }
      
      setDeleteDialog(null);
      loadFAQData();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir');
    } finally {
      setSaving(false);
    }
  };

  // Toggle active state
  const toggleCategoryActive = async (category: FAQCategory) => {
    try {
      const { error } = await supabase
        .from('faq_categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id);
      
      if (error) throw error;
      loadFAQData();
      toast.success(category.is_active ? 'Categoria desativada' : 'Categoria ativada');
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const toggleQuestionActive = async (question: FAQQuestion) => {
    try {
      const { error } = await supabase
        .from('faq_questions')
        .update({ is_active: !question.is_active })
        .eq('id', question.id);
      
      if (error) throw error;
      loadFAQData();
      toast.success(question.is_active ? 'Pergunta desativada' : 'Pergunta ativada');
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const totalQuestions = categories.reduce((acc, cat) => acc + (cat.questions?.length || 0), 0);
  const activeCategories = categories.filter(c => c.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-apolar-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs para alternar entre FAQ e Atualizações */}
      <Tabs defaultValue="faq" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="faq" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            Perguntas FAQ
          </TabsTrigger>
          <TabsTrigger value="updates" className="gap-2">
            <Rocket className="h-4 w-4" />
            Atualizações
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="faq" className="mt-6">
          {/* FAQ Content */}
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-apolar-blue flex items-center gap-2">
                  <HelpCircle className="h-6 w-6" />
                  Gerenciar FAQ
                </h2>
                <p className="text-muted-foreground mt-1">
                  {activeCategories} categorias ativas • {totalQuestions} perguntas cadastradas
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setGenerateDialogOpen(true)} 
                  variant="outline"
                  className="gap-2 border-apolar-gold text-apolar-gold-alt hover:bg-apolar-gold/10"
                >
                  <Sparkles className="h-4 w-4" />
                  Gerar com IA
                </Button>
                <Button onClick={() => openCategoryDialog()} className="gap-2 bg-apolar-blue hover:bg-apolar-blue/90">
                  <Plus className="h-4 w-4" />
                  Nova Categoria
                </Button>
              </div>
            </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-apolar-blue/10 flex items-center justify-center">
                <span className="text-xl">📚</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-apolar-blue">{categories.length}</p>
                <p className="text-xs text-muted-foreground">Categorias</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-apolar-gold/10 flex items-center justify-center">
                <span className="text-xl">❓</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-apolar-gold-alt">{totalQuestions}</p>
                <p className="text-xs text-muted-foreground">Perguntas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <span className="text-xl">✅</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{activeCategories}</p>
                <p className="text-xs text-muted-foreground">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories List */}
      {categories.length === 0 ? (
        <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              Nenhuma categoria cadastrada
            </h3>
            <p className="text-gray-500 mb-4">
              Crie a primeira categoria para começar a adicionar perguntas ao FAQ
            </p>
            <Button onClick={() => openCategoryDialog()} className="gap-2 bg-apolar-blue hover:bg-apolar-blue/90">
              <Plus className="h-4 w-4" />
              Criar Categoria
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <Card 
              key={category.id} 
              className={cn(
                "bg-white/60 backdrop-blur-sm border-apolar-blue/10 transition-opacity",
                !category.is_active && "opacity-60"
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <CardTitle className="text-lg text-apolar-blue flex items-center gap-2">
                        {category.name}
                        {!category.is_active && (
                          <Badge variant="secondary" className="text-xs">Inativa</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {category.questions?.length || 0} perguntas
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleCategoryActive(category)}
                      className="h-8 w-8"
                      title={category.is_active ? 'Desativar' : 'Ativar'}
                    >
                      {category.is_active ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openCategoryDialog(category)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteDialog({ type: 'category', id: category.id, name: category.name })}
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openQuestionDialog(category.id)}
                      className="gap-1 ml-2"
                    >
                      <Plus className="h-3 w-3" />
                      Pergunta
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {category.questions && category.questions.length > 0 && (
                <CardContent className="pt-2">
                  <Accordion type="single" collapsible className="w-full">
                    {category.questions.map((question, index) => (
                      <AccordionItem 
                        key={question.id} 
                        value={question.id}
                        className={cn(
                          "border-b border-gray-100 last:border-0",
                          !question.is_active && "opacity-50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <AccordionTrigger className="flex-1 py-3 text-left hover:no-underline">
                            <span className="text-sm font-medium text-gray-800 pr-4 flex items-center gap-2">
                              <span className="text-xs text-gray-400 font-mono">#{index + 1}</span>
                              {question.question}
                              {!question.is_active && (
                                <Badge variant="secondary" className="text-xs ml-2">Inativa</Badge>
                              )}
                            </span>
                          </AccordionTrigger>
                          <div className="flex items-center gap-1 pr-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleQuestionActive(question);
                              }}
                              className="h-7 w-7"
                            >
                              {question.is_active ? (
                                <Eye className="h-3 w-3 text-green-600" />
                              ) : (
                                <EyeOff className="h-3 w-3 text-gray-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                openQuestionDialog(category.id, question);
                              }}
                              className="h-7 w-7"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteDialog({ type: 'question', id: question.id, name: question.question });
                              }}
                              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <AccordionContent className="pb-3 pt-0">
                          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3">
                            {question.answer}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory 
                ? 'Atualize as informações da categoria'
                : 'Crie uma nova categoria para organizar as perguntas do FAQ'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nome da Categoria</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Ex: Sistemas e Acessos"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setCategoryForm({ ...categoryForm, icon })}
                    className={cn(
                      "h-10 w-10 rounded-lg border-2 flex items-center justify-center text-xl transition-all",
                      categoryForm.icon === icon
                        ? "border-apolar-blue bg-apolar-blue/10"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="category-active">Categoria ativa</Label>
              <Switch
                id="category-active"
                checked={categoryForm.is_active}
                onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, is_active: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveCategory} disabled={saving} className="gap-2 bg-apolar-blue hover:bg-apolar-blue/90">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingCategory ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? 'Editar Pergunta' : 'Nova Pergunta'}
            </DialogTitle>
            <DialogDescription>
              {editingQuestion 
                ? 'Atualize a pergunta e resposta'
                : 'Adicione uma nova pergunta à categoria selecionada'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="question">Pergunta</Label>
              <Input
                id="question"
                value={questionForm.question}
                onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })}
                placeholder="Ex: Como faço para resetar minha senha?"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="answer">Resposta</Label>
              <Textarea
                id="answer"
                value={questionForm.answer}
                onChange={(e) => setQuestionForm({ ...questionForm, answer: e.target.value })}
                placeholder="Digite a resposta completa..."
                rows={5}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="question-active">Pergunta ativa</Label>
              <Switch
                id="question-active"
                checked={questionForm.is_active}
                onCheckedChange={(checked) => setQuestionForm({ ...questionForm, is_active: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveQuestion} disabled={saving} className="gap-2 bg-apolar-blue hover:bg-apolar-blue/90">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingQuestion ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              {deleteDialog?.type === 'category' 
                ? 'Ao excluir esta categoria, todas as perguntas associadas também serão removidas.'
                : 'Esta ação não pode ser desfeita.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Deseja realmente excluir{' '}
              <span className="font-medium text-gray-900">"{deleteDialog?.name}"</span>?
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={confirmDelete} 
              disabled={saving} 
              variant="destructive"
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </div>
        </TabsContent>
        
        <TabsContent value="updates" className="mt-6">
          <UpdatesManager />
        </TabsContent>
      </Tabs>

      {/* Generate FAQ Dialog */}
      <GenerateFAQDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        categories={categories.map(c => ({ id: c.id, name: c.name, icon: c.icon }))}
        onSuccess={loadFAQData}
      />
    </div>
  );
}
