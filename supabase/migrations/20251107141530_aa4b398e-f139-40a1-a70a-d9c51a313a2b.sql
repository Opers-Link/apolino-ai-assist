-- Adicionar novos valores ao enum app_role (deve ser feito em transação separada)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'gerente') THEN
    ALTER TYPE app_role ADD VALUE 'gerente';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'agente') THEN
    ALTER TYPE app_role ADD VALUE 'agente';
  END IF;
END $$;