-- Inserir categorias do FAQ
INSERT INTO public.faq_categories (id, name, icon, display_order, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Acesso e Autenticação', '🔐', 1, true),
  ('22222222-2222-2222-2222-222222222222', 'Sistemas', '💻', 2, true),
  ('33333333-3333-3333-3333-333333333333', 'Procedimentos', '📋', 3, true),
  ('44444444-4444-4444-4444-444444444444', 'Marketing', '📢', 4, true),
  ('55555555-5555-5555-5555-555555555555', 'Vendas', '💰', 5, true),
  ('66666666-6666-6666-6666-666666666666', 'Configurações', '🔧', 6, true)
ON CONFLICT (id) DO NOTHING;

-- Inserir perguntas - Acesso e Autenticação
INSERT INTO public.faq_questions (category_id, question, answer, display_order, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Como faço para trocar minha senha?', 'Acesse o sistema e clique em "Esqueci minha senha" na tela de login. Você receberá um e-mail com instruções para criar uma nova senha. Caso não receba, verifique sua pasta de spam.', 1, true),
  ('11111111-1111-1111-1111-111111111111', 'Não recebi o e-mail de ativação. O que fazer?', 'Verifique sua pasta de spam ou lixo eletrônico. Se não encontrar, solicite um novo e-mail de ativação através do suporte técnico ou aguarde 15 minutos e tente novamente.', 2, true),
  ('11111111-1111-1111-1111-111111111111', 'Esqueci meu usuário. Como recuperar?', 'Seu usuário geralmente é seu e-mail corporativo. Entre em contato com o RH ou suporte técnico para confirmar qual e-mail está cadastrado no sistema.', 3, true),
  ('11111111-1111-1111-1111-111111111111', 'Minha conta foi bloqueada. O que fazer?', 'Contas são bloqueadas após 5 tentativas incorretas de senha. Aguarde 30 minutos para tentar novamente ou entre em contato com o suporte para desbloqueio imediato.', 4, true);

-- Inserir perguntas - Sistemas
INSERT INTO public.faq_questions (category_id, question, answer, display_order, is_active) VALUES
  ('22222222-2222-2222-2222-222222222222', 'O que é o Apolar Sales?', 'O Apolar Sales é o sistema de gestão de vendas da Apolar. Nele você pode cadastrar imóveis, gerenciar clientes, acompanhar propostas e visualizar relatórios de desempenho.', 1, true),
  ('22222222-2222-2222-2222-222222222222', 'Qual a diferença entre Apolar Net e Apolar Sales?', 'O Apolar Net é o portal de intranet com informações corporativas, comunicados e documentos. O Apolar Sales é focado em operações comerciais como vendas e locações.', 2, true),
  ('22222222-2222-2222-2222-222222222222', 'Como acessar a Área do Cliente?', 'A Área do Cliente está disponível em cliente.apolar.com.br. Use suas credenciais de corretor para acessar e visualizar os imóveis e contratos dos seus clientes.', 3, true),
  ('22222222-2222-2222-2222-222222222222', 'O sistema está lento. O que fazer?', 'Limpe o cache do navegador, verifique sua conexão de internet e tente usar o Chrome ou Edge atualizados. Se persistir, reporte ao suporte técnico informando horário e tela afetada.', 4, true);

-- Inserir perguntas - Procedimentos
INSERT INTO public.faq_questions (category_id, question, answer, display_order, is_active) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Como abrir um ticket de suporte?', 'Acesse o portal de suporte em suporte.apolar.com.br, clique em "Novo Chamado", selecione a categoria do problema e descreva detalhadamente a situação.', 1, true),
  ('33333333-3333-3333-3333-333333333333', 'Qual o prazo de resposta do suporte?', 'Chamados críticos são respondidos em até 2 horas. Chamados de média prioridade em até 8 horas. Solicitações gerais em até 24 horas úteis.', 2, true),
  ('33333333-3333-3333-3333-333333333333', 'Como solicitar treinamento?', 'Envie um e-mail para treinamento@apolar.com.br informando o tema desejado e quantidade de participantes. A equipe entrará em contato para agendar.', 3, true),
  ('33333333-3333-3333-3333-333333333333', 'Como reportar um bug?', 'Abra um ticket de suporte com prints da tela, descrição do erro, navegador utilizado e passos para reproduzir o problema. Quanto mais detalhes, mais rápida será a correção.', 4, true);

-- Inserir perguntas - Marketing
INSERT INTO public.faq_questions (category_id, question, answer, display_order, is_active) VALUES
  ('44444444-4444-4444-4444-444444444444', 'Como solicitar material de marketing?', 'Acesse o Portal de Marketing em marketing.apolar.com.br e faça a solicitação online. Materiais padrão são entregues em 3 dias úteis, personalizados em até 7 dias.', 1, true),
  ('44444444-4444-4444-4444-444444444444', 'Como atualizar fotos de imóveis?', 'No Apolar Sales, acesse o cadastro do imóvel e clique em "Fotos". Faça upload das novas imagens em alta resolução (mínimo 1920x1080).', 2, true),
  ('44444444-4444-4444-4444-444444444444', 'Quais são os canais oficiais de divulgação?', 'Os imóveis são divulgados automaticamente no site Apolar, portais parceiros (ZAP, Viva Real, OLX) e redes sociais oficiais conforme plano de mídia.', 3, true);

-- Inserir perguntas - Vendas
INSERT INTO public.faq_questions (category_id, question, answer, display_order, is_active) VALUES
  ('55555555-5555-5555-5555-555555555555', 'Como cadastrar um novo imóvel?', 'No Apolar Sales, clique em "Novo Imóvel", preencha todos os campos obrigatórios, adicione fotos e documentação. O imóvel ficará disponível após aprovação do gerente.', 1, true),
  ('55555555-5555-5555-5555-555555555555', 'Como registrar uma proposta?', 'Na ficha do imóvel, clique em "Nova Proposta", preencha os dados do cliente e condições oferecidas. A proposta será enviada automaticamente para análise.', 2, true),
  ('55555555-5555-5555-5555-555555555555', 'Como acompanhar o funil de vendas?', 'No dashboard do Apolar Sales, acesse "Meu Funil" para visualizar todas as suas negociações por etapa: prospecção, visita, proposta, análise e fechamento.', 3, true);

-- Inserir perguntas - Configurações
INSERT INTO public.faq_questions (category_id, question, answer, display_order, is_active) VALUES
  ('66666666-6666-6666-6666-666666666666', 'Como alterar meus dados de perfil?', 'Clique no seu nome no canto superior direito e selecione "Meu Perfil". Você pode atualizar foto, telefone e preferências de contato.', 1, true),
  ('66666666-6666-6666-6666-666666666666', 'Como configurar notificações?', 'Em "Configurações > Notificações", escolha quais alertas deseja receber por e-mail, push ou SMS. Recomendamos manter ativas as notificações de propostas.', 2, true),
  ('66666666-6666-6666-6666-666666666666', 'Como alterar o idioma do sistema?', 'Atualmente o sistema está disponível apenas em português. Versões em espanhol e inglês estão em desenvolvimento.', 3, true);