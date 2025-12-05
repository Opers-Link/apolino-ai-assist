-- Adicionar coluna para texto extraído dos PDFs
ALTER TABLE public.knowledge_module_files 
ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.knowledge_module_files.extracted_text IS 'Texto extraído automaticamente do PDF para uso pela IA';