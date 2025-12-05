import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Save, 
  Plus, 
  GripVertical, 
  FileUp,
  AlertCircle,
  CheckCircle,
  BookOpen,
  Layers,
  Settings2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface KnowledgeModule {
  id: string;
  name: string;
  variable_name: string;
  version: string;
  description?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  files?: ModuleFile[];
}

interface ModuleFile {
  id: string;
  module_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  uploaded_at: string;
  extracted_text?: string | null;
}

interface KnowledgeConfig {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

// Sanitiza nomes de arquivos para upload no Supabase Storage
const sanitizeFileName = (fileName: string): string => {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, '_')            // Espaços → underscores
    .replace(/[^a-zA-Z0-9_.-]/g, '') // Remove caracteres especiais
    .replace(/_+/g, '_')             // Remove underscores duplicados
    .replace(/^_+|_+$/g, '');        // Remove underscores início/fim
};

export const KnowledgeModulesManager: React.FC = () => {
  const [modules, setModules] = useState<KnowledgeModule[]>([]);
  const [config, setConfig] = useState<Record<string, KnowledgeConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [newModuleDialogOpen, setNewModuleDialogOpen] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleVariable, setNewModuleVariable] = useState('');
  const [globalVersion, setGlobalVersion] = useState('1.0');
  const [moduleIndex, setModuleIndex] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('knowledge_modules')
        .select('*')
        .order('display_order', { ascending: true });

      if (modulesError) throw modulesError;

      // Load files for each module
      const modulesWithFiles: KnowledgeModule[] = [];
      for (const module of modulesData || []) {
        const { data: filesData } = await supabase
          .from('knowledge_module_files')
          .select('id, module_id, file_name, file_path, file_size, uploaded_at, extracted_text')
          .eq('module_id', module.id)
          .order('uploaded_at', { ascending: false });
        
        modulesWithFiles.push({
          ...module,
          files: filesData || []
        });
      }

      setModules(modulesWithFiles);

      // Load config
      const { data: configData, error: configError } = await supabase
        .from('knowledge_config')
        .select('*');

      if (configError) throw configError;

      const configMap: Record<string, KnowledgeConfig> = {};
      (configData || []).forEach(item => {
        configMap[item.key] = item;
      });
      setConfig(configMap);
      setGlobalVersion(configMap['VERSAO_MODULOS']?.value || '1.0');
      setModuleIndex(configMap['INDICE_DE_MODULOS']?.value || '');

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os módulos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateModuleVersion = async (moduleId: string, newVersion: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_modules')
        .update({ version: newVersion, updated_at: new Date().toISOString() })
        .eq('id', moduleId);

      if (error) throw error;

      setModules(prev => prev.map(m => 
        m.id === moduleId ? { ...m, version: newVersion } : m
      ));

      toast({
        title: 'Versão atualizada',
        description: 'A versão do módulo foi atualizada com sucesso',
      });
    } catch (error) {
      console.error('Erro ao atualizar versão:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a versão',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = async (moduleId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(moduleId);

    try {
      const module = modules.find(m => m.id === moduleId);
      if (!module) return;

      for (const file of Array.from(files)) {
        if (file.type !== 'application/pdf') {
          toast({
            title: 'Arquivo inválido',
            description: 'Apenas arquivos PDF são permitidos',
            variant: 'destructive',
          });
          continue;
        }

        const sanitizedName = sanitizeFileName(file.name);
        const fileName = `${module.variable_name}/${Date.now()}_${sanitizedName}`;
        
        // Upload to storage using resumable upload for large files
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('manuals')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            duplex: 'half',
          });

        if (uploadError) {
          console.error('Upload error details:', uploadError);
          throw new Error(`Erro no upload: ${uploadError.message}`);
        }

        // Save file reference in database with sanitized name
        const { error: dbError } = await supabase
          .from('knowledge_module_files')
          .insert({
            module_id: moduleId,
            file_name: sanitizedName,
            file_path: uploadData.path,
            file_size: file.size,
          });

        if (dbError) throw dbError;

        // Get the file ID we just inserted
        const { data: insertedFile } = await supabase
          .from('knowledge_module_files')
          .select('id')
          .eq('file_path', uploadData.path)
          .single();

        // Trigger PDF text extraction in background
        if (insertedFile?.id) {
          console.log('Triggering PDF text extraction for file:', insertedFile.id);
          supabase.functions.invoke('extract-pdf-text', {
            body: { filePath: uploadData.path, fileId: insertedFile.id }
          }).then((result) => {
            if (result.error) {
              console.error('Error extracting PDF text:', result.error);
              toast({
                title: 'Aviso',
                description: 'O texto do PDF será extraído em segundo plano',
              });
            } else {
              console.log('PDF text extraction completed:', result.data);
              toast({
                title: 'Texto extraído',
                description: 'O conteúdo do PDF foi processado pela IA',
              });
              loadData(); // Reload to show extraction status
            }
          });
        }
      }

      toast({
        title: 'Upload concluído',
        description: 'Os arquivos foram enviados. Aguarde a extração do texto...',
      });

      loadData();
    } catch (error: any) {
      console.error('Erro no upload:', error);
      const errorMessage = error?.message || error?.error_description || 'Não foi possível enviar o arquivo';
      toast({
        title: 'Erro no upload',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setUploading(null);
    }
  };

  const deleteFile = async (fileId: string, filePath: string) => {
    try {
      // Delete from storage
      await supabase.storage.from('manuals').remove([filePath]);

      // Delete from database
      const { error } = await supabase
        .from('knowledge_module_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      toast({
        title: 'Arquivo removido',
        description: 'O arquivo foi removido com sucesso',
      });

      loadData();
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o arquivo',
        variant: 'destructive',
      });
    }
  };

  const createModule = async () => {
    if (!newModuleName.trim() || !newModuleVariable.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o nome e a variável do módulo',
        variant: 'destructive',
      });
      return;
    }

    try {
      const variableName = newModuleVariable.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      
      const { error } = await supabase
        .from('knowledge_modules')
        .insert({
          name: newModuleName,
          variable_name: variableName,
          version: '1.0',
          display_order: modules.length + 1,
        });

      if (error) throw error;

      toast({
        title: 'Módulo criado',
        description: `O módulo "${newModuleName}" foi criado com sucesso`,
      });

      setNewModuleName('');
      setNewModuleVariable('');
      setNewModuleDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Erro ao criar módulo:', error);
      toast({
        title: 'Erro',
        description: error.message?.includes('unique') 
          ? 'Já existe um módulo com essa variável' 
          : 'Não foi possível criar o módulo',
        variant: 'destructive',
      });
    }
  };

  const deleteModule = async (moduleId: string) => {
    try {
      const module = modules.find(m => m.id === moduleId);
      if (!module) return;

      // Delete all files from storage
      if (module.files && module.files.length > 0) {
        const filePaths = module.files.map(f => f.file_path);
        await supabase.storage.from('manuals').remove(filePaths);
      }

      // Delete module (cascade will delete files)
      const { error } = await supabase
        .from('knowledge_modules')
        .delete()
        .eq('id', moduleId);

      if (error) throw error;

      toast({
        title: 'Módulo removido',
        description: 'O módulo e seus arquivos foram removidos',
      });

      loadData();
    } catch (error) {
      console.error('Erro ao deletar módulo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o módulo',
        variant: 'destructive',
      });
    }
  };

  const saveGlobalConfig = async () => {
    setSaving(true);
    try {
      // Update global version
      if (config['VERSAO_MODULOS']) {
        await supabase
          .from('knowledge_config')
          .update({ value: globalVersion, updated_at: new Date().toISOString() })
          .eq('key', 'VERSAO_MODULOS');
      } else {
        await supabase
          .from('knowledge_config')
          .insert({ key: 'VERSAO_MODULOS', value: globalVersion });
      }

      // Update module index
      if (config['INDICE_DE_MODULOS']) {
        await supabase
          .from('knowledge_config')
          .update({ value: moduleIndex, updated_at: new Date().toISOString() })
          .eq('key', 'INDICE_DE_MODULOS');
      } else {
        await supabase
          .from('knowledge_config')
          .insert({ key: 'INDICE_DE_MODULOS', value: moduleIndex });
      }

      toast({
        title: 'Configurações salvas',
        description: 'As configurações globais foram salvas com sucesso',
      });

      loadData();
    } catch (error) {
      console.error('Erro ao salvar config:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const generateModuleIndex = () => {
    const indexText = modules.map((m, i) => 
      `${i + 1}. ${m.name} ({{${m.variable_name}}}) - v${m.version}${m.files && m.files.length > 0 ? ' ✓' : ' (sem PDF)'}`
    ).join('\n');
    
    setModuleIndex(`Índice de Módulos:\n${indexText}`);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apolar-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com botão de novo módulo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-apolar-blue/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-apolar-blue" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-apolar-blue">Gerenciamento de Documentação</h3>
            <p className="text-sm text-muted-foreground">Base de conhecimento da IA</p>
          </div>
        </div>
        
        <Dialog open={newModuleDialogOpen} onOpenChange={setNewModuleDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-apolar-gold hover:bg-apolar-gold-alt text-apolar-blue">
              <Plus className="h-4 w-4 mr-2" />
              Novo Módulo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Módulo</DialogTitle>
              <DialogDescription>
                Adicione um novo módulo de conhecimento para a IA
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Módulo</Label>
                <Input
                  value={newModuleName}
                  onChange={(e) => setNewModuleName(e.target.value)}
                  placeholder="Ex: CRM Avançado"
                />
              </div>
              <div className="space-y-2">
                <Label>Variável (será convertida para maiúsculas)</Label>
                <Input
                  value={newModuleVariable}
                  onChange={(e) => setNewModuleVariable(e.target.value)}
                  placeholder="Ex: MODULO_CRM_AVANCADO"
                />
                <p className="text-xs text-muted-foreground">
                  Use letras e underscores. Será usada como: {`{{${newModuleVariable.toUpperCase().replace(/[^A-Z0-9_]/g, '_') || 'NOME_VARIAVEL'}}}`}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewModuleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={createModule} className="bg-apolar-gold hover:bg-apolar-gold-alt text-apolar-blue">
                Criar Módulo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Versão Geral */}
      <Card className="bg-white/60 backdrop-blur-sm border-apolar-gold/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-apolar-gold-alt" />
            <CardTitle className="text-base">Versão Geral dos Manuais</CardTitle>
          </div>
          <CardDescription>Controle de versão do conjunto completo de manuais</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-sm">Variável: <code className="bg-slate-100 px-2 py-0.5 rounded">{`{{VERSAO_MODULOS}}`}</code></Label>
              <Input
                value={globalVersion}
                onChange={(e) => setGlobalVersion(e.target.value)}
                className="mt-2"
                placeholder="1.0"
              />
            </div>
            <Button 
              onClick={saveGlobalConfig} 
              disabled={saving}
              className="bg-apolar-blue hover:bg-apolar-blue-dark"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Índice de Módulos */}
      <Card className="bg-white/60 backdrop-blur-sm border-apolar-blue/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-apolar-blue" />
              <CardTitle className="text-base">Índice de Módulos</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={generateModuleIndex}
              className="text-apolar-blue border-apolar-blue/30 hover:bg-apolar-blue/5"
            >
              Gerar Automaticamente
            </Button>
          </div>
          <CardDescription>
            Lista consolidada de todos os módulos. Variável: <code className="bg-slate-100 px-2 py-0.5 rounded">{`{{INDICE_DE_MODULOS}}`}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={moduleIndex}
            onChange={(e) => setModuleIndex(e.target.value)}
            className="min-h-[150px] font-mono text-sm"
            placeholder="Índice de Módulos:&#10;1. Módulo X - v1.0&#10;2. Módulo Y - v1.0"
          />
          <Button 
            onClick={saveGlobalConfig} 
            disabled={saving}
            className="mt-3 bg-apolar-blue hover:bg-apolar-blue-dark"
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar Índice
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Lista de Módulos */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Módulos de Conhecimento ({modules.length})
        </h4>

        <div className="space-y-4">
            {modules.map((module, index) => (
              <Card 
                key={module.id} 
                className="bg-white/80 backdrop-blur-sm border-slate-200 hover:border-apolar-gold/30 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-slate-400">
                        <GripVertical className="h-4 w-4" />
                        <span className="text-sm font-medium">{index + 1}</span>
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {module.name}
                          {module.files && module.files.length > 0 ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {module.files.length} PDF(s)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Sem PDF
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Variável: <code className="bg-slate-100 px-2 py-0.5 rounded text-apolar-blue">{`{{${module.variable_name}}}`}</code>
                        </CardDescription>
                      </div>
                    </div>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover Módulo</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover o módulo "{module.name}"? 
                            Todos os PDFs associados também serão removidos. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteModule(module.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Versão do Módulo */}
                  <div className="flex items-center gap-3">
                    <Label className="text-sm min-w-[60px]">Versão:</Label>
                    <Input
                      value={module.version}
                      onChange={(e) => {
                        setModules(prev => prev.map(m => 
                          m.id === module.id ? { ...m, version: e.target.value } : m
                        ));
                      }}
                      className="w-24"
                      placeholder="1.0"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateModuleVersion(module.id, module.version)}
                    >
                      Salvar Versão
                    </Button>
                  </div>

                  {/* Upload de PDF */}
                  <div className="space-y-2">
                    <Label className="text-sm">PDFs Anexados:</Label>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-apolar-gold/50 transition-colors">
                      <input
                        type="file"
                        accept=".pdf"
                        multiple
                        id={`file-upload-${module.id}`}
                        className="hidden"
                        onChange={(e) => handleFileUpload(module.id, e.target.files)}
                      />
                      <label 
                        htmlFor={`file-upload-${module.id}`}
                        className="flex flex-col items-center justify-center cursor-pointer"
                      >
                        {uploading === module.id ? (
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apolar-gold"></div>
                        ) : (
                          <>
                            <FileUp className="h-8 w-8 text-slate-400 mb-2" />
                            <span className="text-sm text-slate-600">Clique para fazer upload de PDFs</span>
                            <span className="text-xs text-slate-400 mt-1">ou arraste e solte aqui</span>
                          </>
                        )}
                      </label>
                    </div>

                    {/* Lista de arquivos */}
                    {module.files && module.files.length > 0 && (
                      <div className="space-y-2 mt-3">
                        {module.files.map((file) => (
                          <div 
                            key={file.id}
                            className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-red-500" />
                              <span className="text-sm truncate max-w-[200px]">{file.file_name}</span>
                              <span className="text-xs text-slate-400">
                                {formatFileSize(file.file_size)}
                              </span>
                              {file.extracted_text ? (
                                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Texto extraído
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Aguardando extração
                                </Badge>
                              )}
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover Arquivo</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja remover o arquivo "{file.file_name}"?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => deleteFile(file.id, file.file_path)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
      </div>
    </div>
  );
};
