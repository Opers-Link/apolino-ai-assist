-- Create table for knowledge modules
CREATE TABLE public.knowledge_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  variable_name TEXT NOT NULL UNIQUE,
  version TEXT DEFAULT '1.0',
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create table for module PDF files
CREATE TABLE public.knowledge_module_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.knowledge_modules(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- Create table for global version tracking
CREATE TABLE public.knowledge_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.knowledge_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_module_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_modules
CREATE POLICY "Admins can view modules"
ON public.knowledge_modules FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert modules"
ON public.knowledge_modules FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update modules"
ON public.knowledge_modules FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete modules"
ON public.knowledge_modules FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for knowledge_module_files
CREATE POLICY "Admins can view module files"
ON public.knowledge_module_files FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert module files"
ON public.knowledge_module_files FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update module files"
ON public.knowledge_module_files FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete module files"
ON public.knowledge_module_files FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for knowledge_config
CREATE POLICY "Admins can view config"
ON public.knowledge_config FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert config"
ON public.knowledge_config FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update config"
ON public.knowledge_config FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_knowledge_modules_updated_at
BEFORE UPDATE ON public.knowledge_modules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial modules
INSERT INTO public.knowledge_modules (name, variable_name, version, display_order) VALUES
('CRM Sales', 'MODULO_CRM_SALES', '1.0', 1),
('Net Locação', 'MODULO_NET_LOCACAO', '1.0', 2),
('Área do Cliente', 'MODULO_AREA_DO_CLIENTE', '1.0', 3),
('Net Vendas', 'MODULO_NET_VENDAS', '1.0', 4),
('Transversal', 'MODULO_TRANSVERSAL', '1.0', 5);

-- Insert initial config values
INSERT INTO public.knowledge_config (key, value) VALUES
('VERSAO_MODULOS', '1.0'),
('INDICE_DE_MODULOS', 'Índice de Módulos:
1. CRM Sales ({{MODULO_CRM_SALES}}) - v1.0
2. Net Locação ({{MODULO_NET_LOCACAO}}) - v1.0
3. Área do Cliente ({{MODULO_AREA_DO_CLIENTE}}) - v1.0
4. Net Vendas ({{MODULO_NET_VENDAS}}) - v1.0
5. Transversal ({{MODULO_TRANSVERSAL}}) - v1.0');

-- Storage policies for manuals bucket (already exists)
CREATE POLICY "Admins can upload to manuals"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'manuals' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update manuals"
ON storage.objects FOR UPDATE
USING (bucket_id = 'manuals' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete manuals"
ON storage.objects FOR DELETE
USING (bucket_id = 'manuals' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view manuals"
ON storage.objects FOR SELECT
USING (bucket_id = 'manuals');