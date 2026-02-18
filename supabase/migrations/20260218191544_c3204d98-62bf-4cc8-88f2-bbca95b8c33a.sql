
-- Tabela de taxas bancárias para simulações de financiamento
CREATE TABLE public.bank_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  modality TEXT NOT NULL DEFAULT 'SBPE',
  min_rate NUMERIC NOT NULL DEFAULT 0,
  max_rate NUMERIC NOT NULL DEFAULT 0,
  max_ltv NUMERIC NOT NULL DEFAULT 0.8,
  max_term_months INTEGER NOT NULL DEFAULT 420,
  max_income_ratio NUMERIC NOT NULL DEFAULT 0.3,
  min_property_value NUMERIC DEFAULT 0,
  max_property_value NUMERIC DEFAULT NULL,
  insurance_rate NUMERIC NOT NULL DEFAULT 0.0003,
  admin_fee NUMERIC NOT NULL DEFAULT 25,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- RLS: leitura pública, escrita admin
ALTER TABLE public.bank_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active bank rates"
ON public.bank_rates FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage bank rates"
ON public.bank_rates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_bank_rates_updated_at
BEFORE UPDATE ON public.bank_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Dados iniciais - Caixa Econômica
INSERT INTO public.bank_rates (bank_name, bank_code, modality, min_rate, max_rate, max_ltv, max_term_months, max_income_ratio, min_property_value, max_property_value, insurance_rate, admin_fee, notes)
VALUES
('Caixa Econômica', 'caixa', 'SBPE', 9.39, 10.99, 0.80, 420, 0.30, 0, NULL, 0.0003, 25, 'Taxa referencial + spread. Imóveis novos podem ter LTV até 90%.'),
('Caixa Econômica', 'caixa', 'MCMV', 4.00, 8.16, 0.80, 420, 0.30, 0, 350000, 0.0002, 0, 'Minha Casa Minha Vida. Taxas variam por faixa de renda.'),
('Caixa Econômica', 'caixa', 'Pro-Cotista', 7.66, 8.16, 0.85, 360, 0.30, 0, NULL, 0.0003, 25, 'Exclusivo para trabalhadores com FGTS há 3+ anos.');

-- Banco do Brasil
INSERT INTO public.bank_rates (bank_name, bank_code, modality, min_rate, max_rate, max_ltv, max_term_months, max_income_ratio, min_property_value, insurance_rate, admin_fee, notes)
VALUES
('Banco do Brasil', 'bb', 'SBPE', 10.49, 11.49, 0.80, 420, 0.30, 0, 0.0003, 25, 'Taxa pós-fixada TR + spread.');

-- Itaú
INSERT INTO public.bank_rates (bank_name, bank_code, modality, min_rate, max_rate, max_ltv, max_term_months, max_income_ratio, min_property_value, insurance_rate, admin_fee, notes)
VALUES
('Itaú', 'itau', 'SBPE', 10.49, 11.88, 0.82, 360, 0.30, 0, 0.0003, 25, 'Taxa fixa anual. Correntistas podem ter desconto.');

-- Bradesco
INSERT INTO public.bank_rates (bank_name, bank_code, modality, min_rate, max_rate, max_ltv, max_term_months, max_income_ratio, min_property_value, insurance_rate, admin_fee, notes)
VALUES
('Bradesco', 'bradesco', 'SBPE', 10.49, 11.99, 0.80, 360, 0.30, 0, 0.0003, 25, 'Taxa pré-fixada. Relacionamento pode reduzir taxa.');

-- Santander
INSERT INTO public.bank_rates (bank_name, bank_code, modality, min_rate, max_rate, max_ltv, max_term_months, max_income_ratio, min_property_value, insurance_rate, admin_fee, notes)
VALUES
('Santander', 'santander', 'SBPE', 10.99, 12.49, 0.80, 420, 0.30, 0, 0.0003, 25, 'Taxa pré-fixada. Oferece opção de parcela fixa ou decrescente.');
