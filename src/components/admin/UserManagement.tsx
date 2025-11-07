import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserCircle, Mail, Phone, Edit, Search } from 'lucide-react';

interface User {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone?: string;
  mobile_phone?: string;
  user_roles: Array<{ role: string }>;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editForm, setEditForm] = useState({
    display_name: '',
    phone: '',
    mobile_phone: '',
  });
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

  const filteredUsers = users.filter(user => 
    user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-6 w-6 text-primary" />
            Gerenciamento de Usuários
          </CardTitle>
          <CardDescription>
            Lista de todos os usuários e seus perfis de acesso
          </CardDescription>
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
                {filteredUsers.map((user) => (
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

          {/* Estatísticas */}
          <div className="mt-4 flex gap-4">
            <Badge variant="outline" className="text-sm">
              Total: {users.length} usuários
            </Badge>
            <Badge variant="outline" className={getRoleBadgeColor('admin')}>
              Admins: {users.filter(u => u.user_roles[0]?.role === 'admin').length}
            </Badge>
            <Badge variant="outline" className={getRoleBadgeColor('gerente')}>
              Gerentes: {users.filter(u => u.user_roles[0]?.role === 'gerente').length}
            </Badge>
            <Badge variant="outline" className={getRoleBadgeColor('agente')}>
              Agentes: {users.filter(u => u.user_roles[0]?.role === 'agente').length}
            </Badge>
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
    </div>
  );
}
