import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Loader2, Eye, EyeOff, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface UpcomingUpdate {
  id: string;
  title: string;
  description: string;
  status: string;
  display_order: number;
  is_active: boolean;
}

const STATUS_OPTIONS = [
  { value: 'Em breve', label: 'Em breve', color: 'bg-green-100 text-green-700' },
  { value: 'Em desenvolvimento', label: 'Em desenvolvimento', color: 'bg-blue-100 text-blue-700' },
  { value: 'Planejado', label: 'Planejado', color: 'bg-gray-100 text-gray-600' },
  { value: 'Em análise', label: 'Em análise', color: 'bg-purple-100 text-purple-700' },
];

export function UpdatesManager() {
  const [updates, setUpdates] = useState<UpcomingUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Update dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<UpcomingUpdate | null>(null);
  const [form, setForm] = useState({ title: '', description: '', status: 'Planejado', is_active: true });
  
  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('upcoming_updates')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      setUpdates(data || []);
    } catch (error) {
      console.error('Erro ao carregar atualizações:', error);
      toast.error('Erro ao carregar atualizações');
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (update?: UpcomingUpdate) => {
    if (update) {
      setEditingUpdate(update);
      setForm({ title: update.title, description: update.description, status: update.status, is_active: update.is_active });
    } else {
      setEditingUpdate(null);
      setForm({ title: '', description: '', status: 'Planejado', is_active: true });
    }
    setDialogOpen(true);
  };

  const saveUpdate = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Título e descrição são obrigatórios');
      return;
    }
    
    try {
      setSaving(true);
      
      if (editingUpdate) {
        const { error } = await supabase
          .from('upcoming_updates')
          .update({
            title: form.title,
            description: form.description,
            status: form.status,
            is_active: form.is_active
          })
          .eq('id', editingUpdate.id);
        
        if (error) throw error;
        toast.success('Atualização editada');
      } else {
        const maxOrder = Math.max(...updates.map(u => u.display_order), -1);
        const { error } = await supabase
          .from('upcoming_updates')
          .insert({
            title: form.title,
            description: form.description,
            status: form.status,
            is_active: form.is_active,
            display_order: maxOrder + 1
          });
        
        if (error) throw error;
        toast.success('Atualização criada');
      }
      
      setDialogOpen(false);
      loadUpdates();
    } catch (error) {
      console.error('Erro ao salvar atualização:', error);
      toast.error('Erro ao salvar atualização');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('upcoming_updates')
        .delete()
        .eq('id', deleteDialog.id);
      
      if (error) throw error;
      toast.success('Atualização excluída');
      setDeleteDialog(null);
      loadUpdates();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (update: UpcomingUpdate) => {
    try {
      const { error } = await supabase
        .from('upcoming_updates')
        .update({ is_active: !update.is_active })
        .eq('id', update.id);
      
      if (error) throw error;
      loadUpdates();
      toast.success(update.is_active ? 'Atualização desativada' : 'Atualização ativada');
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const getStatusColor = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-600';
  };

  const activeUpdates = updates.filter(u => u.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-apolar-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-apolar-blue flex items-center gap-2">
            <Rocket className="h-6 w-6" />
            Próximas Atualizações
          </h2>
          <p className="text-muted-foreground mt-1">
            {activeUpdates} de {updates.length} atualizações ativas
          </p>
        </div>
        <Button onClick={() => openDialog()} className="gap-2 bg-apolar-blue hover:bg-apolar-blue/90">
          <Plus className="h-4 w-4" />
          Nova Atualização
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STATUS_OPTIONS.map(status => {
          const count = updates.filter(u => u.status === status.value).length;
          return (
            <Card key={status.value} className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{status.label}</p>
                  <Badge className={status.color}>{count}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Updates List */}
      {updates.length === 0 ? (
        <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/10">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Rocket className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              Nenhuma atualização cadastrada
            </h3>
            <p className="text-gray-500 mb-4">
              Adicione atualizações para exibir na página de FAQ
            </p>
            <Button onClick={() => openDialog()} className="gap-2 bg-apolar-blue hover:bg-apolar-blue/90">
              <Plus className="h-4 w-4" />
              Criar Atualização
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {updates.map((update, index) => (
            <Card 
              key={update.id} 
              className={cn(
                "bg-white/60 backdrop-blur-sm border-apolar-blue/10 transition-opacity",
                !update.is_active && "opacity-60"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-2 w-2 rounded-full bg-apolar-gold flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800 truncate">{update.title}</p>
                        {!update.is_active && (
                          <Badge variant="secondary" className="text-xs flex-shrink-0">Inativa</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{update.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={cn("text-xs", getStatusColor(update.status))}>
                      {update.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(update)}
                      className="h-8 w-8"
                      title={update.is_active ? 'Desativar' : 'Ativar'}
                    >
                      {update.is_active ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDialog(update)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteDialog({ id: update.id, title: update.title })}
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Update Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUpdate ? 'Editar Atualização' : 'Nova Atualização'}
            </DialogTitle>
            <DialogDescription>
              {editingUpdate ? 'Edite os dados da atualização' : 'Preencha os dados da nova atualização'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Integração com WhatsApp"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Atendimento direto pelo WhatsApp com a AIA"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs", option.color)}>{option.label}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Ativa</Label>
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveUpdate} disabled={saving} className="gap-2 bg-apolar-blue hover:bg-apolar-blue/90">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingUpdate ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a atualização "{deleteDialog?.title}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={saving}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
