import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserCircle, Mail, Phone, Edit, Search, UserPlus, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Users } from 'lucide-react';

interface User {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone?: string;
  mobile_phone?: string;
  user_roles: Array<{ role: string }>;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'gerente' | 'agente' | 'user'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [editForm, setEditForm] = useState({
    display_name: '',
    phone: '',
    mobile_phone: '',
  });
  const [createForm, setCreateForm] = useState({
    email: '',
    display_name: '',
    phone: '',
    mobile_phone: '',
    role: 'user' as 'admin' | 'gerente' | 'agente' | 'user',
  });
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('display_name');

      if (error) throw error;
      
      // Buscar roles separadamente para cada usuário
      const usersWithRoles = await Promise.all(
        (data || []).map(async (profile) => {
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.user_id);
          
          return {
            ...profile,
            user_roles: rolesData || []
          };
        })
      );
      
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os usuários',
        variant: 'destructive',
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'gerente' | 'agente' | 'user') => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Tipo de acesso atualizado com sucesso',
      });

      loadUsers();
    } catch (error) {
      console.error('Erro ao atualizar role:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o tipo de acesso',
        variant: 'destructive',
      });
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      display_name: user.display_name || '',
      phone: user.phone || '',
      mobile_phone: user.mobile_phone || '',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: editForm.display_name,
          phone: editForm.phone,
          mobile_phone: editForm.mobile_phone,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Usuário atualizado com sucesso',
      });

      setIsEditModalOpen(false);
      loadUsers();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o usuário',
        variant: 'destructive',
      });
    }
  };

  const handleCreateUser = async () => {
    // Validar email
    if (!createForm.email || !createForm.email.includes('@')) {
      toast({
        title: 'Erro',
        description: 'Por favor, insira um email válido',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: createForm.email,
          display_name: createForm.display_name || createForm.email.split('@')[0],
          phone: createForm.phone || null,
          mobile_phone: createForm.mobile_phone || null,
          role: createForm.role,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: 'Erro',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Sucesso',
        description: 'Convite enviado! O usuário receberá um email para definir sua senha.',
      });

      // Limpar formulário e fechar modal
      setCreateForm({
        email: '',
        display_name: '',
        phone: '',
        mobile_phone: '',
        role: 'user',
      });
      setIsCreateModalOpen(false);
      
      // Recarregar lista de usuários
      loadUsers();
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o usuário. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'gerente':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'agente':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'gerente':
        return 'Gerente';
      case 'agente':
        return 'Agente';
      default:
        return 'Usuário';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = 
      roleFilter === 'all' || 
      user.user_roles[0]?.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  // Paginação
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset para página 1 quando filtrar ou mudar itens por página
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, roleFilter]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-6 w-6 text-primary" />
                Gerenciamento de Usuários
              </CardTitle>
              <CardDescription>
                Lista de todos os usuários e seus perfis de acesso
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Criar Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Busca */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Filtros por Tipo de Acesso */}
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              variant={roleFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter('all')}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              Todos: {users.length}
            </Button>
            <Button
              variant={roleFilter === 'admin' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter('admin')}
              className={roleFilter !== 'admin' ? 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100' : 'bg-red-600 hover:bg-red-700'}
            >
              Admin: {users.filter(u => u.user_roles[0]?.role === 'admin').length}
            </Button>
            <Button
              variant={roleFilter === 'gerente' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter('gerente')}
              className={roleFilter !== 'gerente' ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100' : 'bg-blue-600 hover:bg-blue-700'}
            >
              Gerente: {users.filter(u => u.user_roles[0]?.role === 'gerente').length}
            </Button>
            <Button
              variant={roleFilter === 'agente' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter('agente')}
              className={roleFilter !== 'agente' ? 'bg-green-50 text-green-800 border-green-300 hover:bg-green-100' : 'bg-green-600 hover:bg-green-700'}
            >
              Agente: {users.filter(u => u.user_roles[0]?.role === 'agente').length}
            </Button>
            <Button
              variant={roleFilter === 'user' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter('user')}
              className={roleFilter !== 'user' ? 'bg-gray-50 text-gray-800 border-gray-300 hover:bg-gray-100' : 'bg-gray-600 hover:bg-gray-700'}
            >
              Usuário: {users.filter(u => u.user_roles[0]?.role === 'user' || !u.user_roles[0]?.role).length}
            </Button>
          </div>

          {/* Tabela */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Tipo de Acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.display_name || 'Sem nome'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.phone || user.mobile_phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {user.phone || user.mobile_phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Não informado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.user_roles[0]?.role || 'user'}
                        onValueChange={(value: 'admin' | 'gerente' | 'agente' | 'user') => updateUserRole(user.user_id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="gerente">Gerente</SelectItem>
                          <SelectItem value="agente">Agente</SelectItem>
                          <SelectItem value="user">Usuário</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Mostrando</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => setItemsPerPage(Number(value))}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option.toString()}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>de {filteredUsers.length} usuários</span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1 mx-2">
                <span className="text-sm">Página</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages || 1}
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (!isNaN(page)) goToPage(page);
                  }}
                  className="w-14 h-8 text-center"
                />
                <span className="text-sm">de {totalPages || 1}</span>
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage >= totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Modal de Edição */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="display_name">Nome</Label>
              <Input
                id="display_name"
                value={editForm.display_name}
                onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="(00) 0000-0000"
              />
            </div>
            <div>
              <Label htmlFor="mobile_phone">Celular</Label>
              <Input
                id="mobile_phone"
                value={editForm.mobile_phone}
                onChange={(e) => setEditForm({ ...editForm, mobile_phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveUser}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Criação */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create_email">Email *</Label>
              <Input
                id="create_email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="usuario@email.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O usuário receberá um email para definir sua senha
              </p>
            </div>
            <div>
              <Label htmlFor="create_display_name">Nome</Label>
              <Input
                id="create_display_name"
                value={createForm.display_name}
                onChange={(e) => setCreateForm({ ...createForm, display_name: e.target.value })}
                placeholder="Nome do usuário"
              />
            </div>
            <div>
              <Label htmlFor="create_phone">Telefone</Label>
              <Input
                id="create_phone"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="(00) 0000-0000"
              />
            </div>
            <div>
              <Label htmlFor="create_mobile_phone">Celular</Label>
              <Input
                id="create_mobile_phone"
                value={createForm.mobile_phone}
                onChange={(e) => setCreateForm({ ...createForm, mobile_phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label htmlFor="create_role">Tipo de Acesso</Label>
              <Select
                value={createForm.role}
                onValueChange={(value: 'admin' | 'gerente' | 'agente' | 'user') => 
                  setCreateForm({ ...createForm, role: value })
                }
              >
                <SelectTrigger id="create_role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="agente">Agente</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Usuário'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
