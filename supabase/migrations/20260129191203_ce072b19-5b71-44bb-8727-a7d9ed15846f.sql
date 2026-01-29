-- Adicionar campos para rastrear origem das perguntas do FAQ
ALTER TABLE faq_questions
ADD COLUMN source_module_id UUID REFERENCES knowledge_modules(id) ON DELETE SET NULL,
ADD COLUMN auto_generated BOOLEAN DEFAULT false;