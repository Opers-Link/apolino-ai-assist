import { useState, useCallback } from 'react';
import { Upload, File, X, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: 'csv' | 'pdf' | 'txt';
  preview?: string;
}

interface FileUploadZoneProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
}

const getFileIcon = (type: string) => {
  switch (type) {
    case 'csv':
      return FileSpreadsheet;
    case 'pdf':
      return FileText;
    default:
      return File;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileType = (file: File): 'csv' | 'pdf' | 'txt' | null => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'csv') return 'csv';
  if (extension === 'pdf') return 'pdf';
  if (extension === 'txt') return 'txt';
  return null;
};

export function FileUploadZone({
  files,
  onFilesChange,
  maxFiles = 10,
  maxSizeMB = 20,
  disabled = false,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const processFiles = useCallback(async (fileList: FileList) => {
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(fileList)) {
      if (files.length + newFiles.length >= maxFiles) break;

      const fileType = getFileType(file);
      if (!fileType) continue;

      if (file.size > maxSizeMB * 1024 * 1024) continue;

      let preview = '';
      if (fileType === 'csv' || fileType === 'txt') {
        try {
          const text = await file.text();
          const lines = text.split('\n').slice(0, 5);
          preview = lines.join('\n');
          if (text.split('\n').length > 5) {
            preview += '\n...';
          }
        } catch {
          preview = 'Não foi possível carregar preview';
        }
      }

      newFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        type: fileType,
        preview,
      });
    }

    if (newFiles.length > 0) {
      onFilesChange([...files, ...newFiles]);
    }
  }, [files, maxFiles, maxSizeMB, onFilesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!disabled && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [disabled, processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  }, [processFiles]);

  const removeFile = useCallback((id: string) => {
    onFilesChange(files.filter(f => f.id !== id));
  }, [files, onFilesChange]);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 text-center",
          isDragOver
            ? "border-apolar-blue bg-apolar-blue/5 scale-[1.01]"
            : "border-apolar-light-gray hover:border-apolar-blue/50 hover:bg-apolar-blue/5",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          type="file"
          accept=".csv,.pdf,.txt"
          multiple
          onChange={handleFileInput}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-apolar-blue/10 flex items-center justify-center">
            <Upload className="h-8 w-8 text-apolar-blue" />
          </div>
          
          <div>
            <p className="text-lg font-medium text-apolar-blue">
              Arraste arquivos aqui ou clique para selecionar
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Formatos aceitos: CSV, PDF, TXT • Máx. {maxFiles} arquivos • {maxSizeMB}MB cada
            </p>
          </div>

          <div className="flex gap-2 mt-2">
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
              CSV
            </span>
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
              PDF
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
              TXT
            </span>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-apolar-blue">
            {files.length} arquivo(s) selecionado(s)
          </p>
          
          <div className="grid gap-2">
            {files.map((file) => {
              const Icon = getFileIcon(file.type);
              return (
                <div
                  key={file.id}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-apolar-light-gray hover:shadow-sm transition-shadow"
                >
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    file.type === 'csv' && "bg-green-100",
                    file.type === 'pdf' && "bg-red-100",
                    file.type === 'txt' && "bg-blue-100"
                  )}>
                    <Icon className={cn(
                      "h-5 w-5",
                      file.type === 'csv' && "text-green-600",
                      file.type === 'pdf' && "text-red-600",
                      file.type === 'txt' && "text-blue-600"
                    )} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-apolar-blue truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} • {file.type.toUpperCase()}
                    </p>
                    
                    {file.preview && (
                      <pre className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground overflow-x-auto max-h-20 font-mono">
                        {file.preview}
                      </pre>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(file.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
