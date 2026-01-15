-- Criar tabela de categorias do FAQ
CREATE TABLE public.faq_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'HelpCircle',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Criar tabela de perguntas do FAQ
CREATE TABLE public.faq_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.faq_categories(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_questions ENABLE ROW LEVEL SECURITY;

-- Políticas para categorias - leitura pública
CREATE POLICY "Anyone can view active faq categories"
ON public.faq_categories
FOR SELECT
USING (is_active = true);

-- Políticas para categorias - admin pode tudo
CREATE POLICY "Admins can manage faq categories"
ON public.faq_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para perguntas - leitura pública
CREATE POLICY "Anyone can view active faq questions"
ON public.faq_questions
FOR SELECT
USING (is_active = true);

-- Políticas para perguntas - admin pode tudo
CREATE POLICY "Admins can manage faq questions"
ON public.faq_questions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_faq_categories_updated_at
BEFORE UPDATE ON public.faq_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_faq_questions_updated_at
BEFORE UPDATE ON public.faq_questions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_faq_questions_category_id ON public.faq_questions(category_id);
CREATE INDEX idx_faq_categories_display_order ON public.faq_categories(display_order);
CREATE INDEX idx_faq_questions_display_order ON public.faq_questions(display_order);