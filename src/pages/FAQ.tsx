import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, HelpCircle, ArrowLeft, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import aiaLogo from '@/assets/aia-logo.png';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
  items: FAQItem[];
}

const faqData: FAQCategory[] = [
  {
    id: 'sistemas',
    title: 'Sistemas e Acessos',
    icon: '💻',
    description: 'Dúvidas sobre login, senhas e acesso aos sistemas',
    items: [
      {
        question: 'Como faço para resetar minha senha do sistema?',
        answer: 'Para resetar sua senha, acesse a tela de login do sistema desejado e clique em "Esqueci minha senha". Um e-mail será enviado com as instruções para criar uma nova senha. Caso não receba o e-mail, verifique a pasta de spam ou entre em contato com o suporte.'
      },
      {
        question: 'Não consigo acessar o CRM Apolar Sales. O que fazer?',
        answer: 'Verifique se suas credenciais estão corretas. Caso o problema persista, pode ser uma questão de permissão de acesso. Entre em contato com seu gerente ou abra um ticket no Movidesk informando seu nome, e-mail e o sistema que está tentando acessar.'
      },
      {
        question: 'Como solicitar acesso a um novo sistema?',
        answer: 'A solicitação de acesso deve ser feita pelo seu gerente direto através do Movidesk. O gestor deve abrir um ticket especificando qual sistema, qual usuário e o nível de permissão necessário.'
      },
      {
        question: 'O sistema está muito lento. Como resolver?',
        answer: 'Primeiro, verifique sua conexão de internet. Tente limpar o cache do navegador (Ctrl+Shift+Delete) e reiniciar o navegador. Se o problema persistir em múltiplas máquinas, pode ser uma instabilidade no servidor - neste caso, abra um ticket informando o horário e sistema afetado.'
      }
    ]
  },
  {
    id: 'vendas',
    title: 'Processos de Vendas',
    icon: '🏠',
    description: 'Procedimentos para cadastro e gestão de imóveis',
    items: [
      {
        question: 'Como cadastrar um novo imóvel no sistema?',
        answer: 'Acesse o módulo de imóveis no CRM Apolar Sales, clique em "Novo Imóvel" e preencha todas as informações obrigatórias: endereço completo, características, valor e dados do proprietário. Não esqueça de adicionar fotos de qualidade para melhor apresentação.'
      },
      {
        question: 'Qual o prazo para atualização de status de proposta?',
        answer: 'O status da proposta deve ser atualizado em até 24 horas após qualquer alteração. Isso inclui: aceite, contraproposta, recusa ou desistência. Manter os status atualizados é essencial para relatórios gerenciais.'
      },
      {
        question: 'Como gerar o contrato de venda?',
        answer: 'Após a aprovação da proposta, acesse a aba "Contratos" dentro da ficha do negócio. Clique em "Gerar Contrato" e selecione o modelo adequado. O sistema irá preencher automaticamente os dados. Revise todas as informações antes de imprimir ou enviar.'
      }
    ]
  },
  {
    id: 'locacao',
    title: 'Locação e NET Locação',
    icon: '📋',
    description: 'Dúvidas sobre processos de aluguel',
    items: [
      {
        question: 'Como emitir segunda via de boleto para o inquilino?',
        answer: 'No NET Locação, acesse a ficha do contrato, vá em "Financeiro" e localize o boleto desejado. Clique em "2ª Via" para gerar um novo boleto com data atualizada. O boleto pode ser enviado por e-mail ou impresso.'
      },
      {
        question: 'Como registrar uma manutenção solicitada pelo inquilino?',
        answer: 'Acesse a ficha do imóvel no NET Locação, clique na aba "Manutenções" e em seguida "Nova Solicitação". Preencha a descrição do problema, urgência e anexe fotos se necessário. A solicitação será direcionada para aprovação do proprietário.'
      },
      {
        question: 'Qual o procedimento para rescisão de contrato?',
        answer: 'O inquilino deve comunicar a intenção com 30 dias de antecedência. No sistema, acesse o contrato e clique em "Iniciar Rescisão". Preencha a data prevista de saída e motivo. O sistema calculará automaticamente multas e valores pendentes.'
      },
      {
        question: 'Como realizar a vistoria de entrada/saída?',
        answer: 'Use o aplicativo de vistoria ou o formulário padrão. Fotografe todos os cômodos e itens, anotando o estado de conservação. No sistema, anexe o laudo na aba "Vistorias" do contrato. É obrigatório ter assinatura do inquilino.'
      }
    ]
  },
  {
    id: 'marketing',
    title: 'Marketing e Divulgação',
    icon: '📢',
    description: 'Materiais, campanhas e divulgação de imóveis',
    items: [
      {
        question: 'Como solicitar material de marketing personalizado?',
        answer: 'Acesse o portal de marketing no CRM ou envie um e-mail para marketing@apolar.com.br. Informe o tipo de material (banner, flyer, post), dados do imóvel e prazo desejado. O prazo médio de produção é de 3 dias úteis.'
      },
      {
        question: 'Onde encontro os templates padrão da Apolar?',
        answer: 'Os templates oficiais estão disponíveis no Google Drive compartilhado do marketing. Acesse através do link no portal do colaborador ou solicite acesso ao seu gerente. É proibido usar templates não oficiais em comunicações da marca.'
      },
      {
        question: 'Como destacar meu imóvel nos portais?',
        answer: 'A partir do CRM, você pode solicitar destaque em portais. Acesse o imóvel, clique em "Destaque" e selecione os portais desejados. O destaque tem custo adicional que será verificado com a franquia. O prazo para ativação é de 24 a 48 horas.'
      }
    ]
  },
  {
    id: 'financeiro',
    title: 'Financeiro e Comissões',
    icon: '💰',
    description: 'Pagamentos, comissões e questões financeiras',
    items: [
      {
        question: 'Quando recebo minha comissão de venda?',
        answer: 'A comissão é paga após a assinatura do contrato e compensação do sinal. O prazo padrão é de até 10 dias úteis após a documentação completa. Acompanhe o status no módulo "Minhas Comissões" do CRM.'
      },
      {
        question: 'Como consultar meu extrato de comissões?',
        answer: 'No CRM Apolar Sales, acesse o menu "Financeiro" > "Minhas Comissões". Você verá o histórico completo com valores pagos, pendentes e previsões. Pode filtrar por período e exportar em Excel.'
      },
      {
        question: 'O que fazer se houver divergência no valor da comissão?',
        answer: 'Primeiro, verifique o contrato e a tabela de comissão vigente. Se confirmar divergência, abra um ticket no Movidesk anexando: número do negócio, valor esperado, valor recebido e justificativa. O financeiro responderá em até 5 dias úteis.'
      }
    ]
  },
  {
    id: 'suporte',
    title: 'Suporte e Atendimento',
    icon: '🎧',
    description: 'Como obter ajuda e suporte técnico',
    items: [
      {
        question: 'Como abrir um ticket de suporte?',
        answer: 'Acesse o Movidesk (apolar.movidesk.com), faça login com suas credenciais e clique em "Novo Ticket". Descreva o problema detalhadamente, inclua prints se possível e selecione a categoria correta. Quanto mais informações, mais rápido será o atendimento.'
      },
      {
        question: 'Qual o tempo de resposta do suporte?',
        answer: 'O SLA padrão é: Urgente (sistema parado) - 2 horas; Alta prioridade - 4 horas; Média - 8 horas; Baixa - 24 horas. Estes prazos são para primeira resposta. A resolução pode variar conforme complexidade.'
      },
      {
        question: 'Posso ligar para o suporte?',
        answer: 'O atendimento prioritário é via Movidesk para melhor rastreamento. Em casos críticos (sistema totalmente indisponível afetando operação), você pode acionar o suporte por telefone. O número está disponível no portal do colaborador.'
      }
    ]
  }
];

const FAQ = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return faqData;

    const term = searchTerm.toLowerCase();
    
    return faqData
      .map(category => ({
        ...category,
        items: category.items.filter(
          item =>
            item.question.toLowerCase().includes(term) ||
            item.answer.toLowerCase().includes(term)
        )
      }))
      .filter(category => category.items.length > 0);
  }, [searchTerm]);

  const totalQuestions = faqData.reduce((acc, cat) => acc + cat.items.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-apolar-blue/5">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="gap-2 text-gray-600 hover:text-apolar-blue"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-apolar-gold via-apolar-gold-alt to-apolar-gold-light p-1.5 shadow-md">
              <img src={aiaLogo} alt="AIA" className="h-full w-full object-contain brightness-0 opacity-70" />
            </div>
            <span className="font-semibold text-gray-800">Central de Ajuda</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-r from-apolar-blue to-apolar-blue/90 text-white py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur p-3">
              <HelpCircle className="h-full w-full text-apolar-gold" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Dúvidas Frequentes
          </h1>
          <p className="text-white/80 text-lg mb-8">
            Encontre respostas rápidas para as principais questões sobre os sistemas Apolar
          </p>
          
          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por palavra-chave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-white text-gray-800 border-0 shadow-lg focus-visible:ring-2 focus-visible:ring-apolar-gold"
            />
          </div>
          
          <p className="text-sm text-white/60 mt-4">
            {totalQuestions} perguntas em {faqData.length} categorias
          </p>
        </div>
      </section>

      {/* Categories */}
      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {searchTerm && filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              Nenhum resultado encontrado
            </h3>
            <p className="text-gray-500 mb-4">
              Não encontramos perguntas para "{searchTerm}"
            </p>
            <Button 
              variant="outline" 
              onClick={() => setSearchTerm('')}
              className="gap-2"
            >
              Limpar busca
            </Button>
          </div>
        ) : (
          <>
            {/* Category Grid */}
            {!searchTerm && !selectedCategory && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {faqData.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className="p-6 bg-white rounded-xl border border-gray-200 hover:border-apolar-blue/30 hover:shadow-lg transition-all text-left group"
                  >
                    <span className="text-3xl mb-3 block">{category.icon}</span>
                    <h3 className="font-semibold text-gray-800 mb-1 group-hover:text-apolar-blue transition-colors">
                      {category.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">
                      {category.description}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-apolar-blue font-medium">
                      <span>{category.items.length} perguntas</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Category or Search Results */}
            {(selectedCategory || searchTerm) && (
              <div>
                {selectedCategory && !searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    className="gap-2 text-gray-600 hover:text-apolar-blue mb-6"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar às categorias
                  </Button>
                )}

                <div className="space-y-6">
                  {(searchTerm ? filteredCategories : faqData.filter(c => c.id === selectedCategory)).map((category) => (
                    <div key={category.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{category.icon}</span>
                          <div>
                            <h2 className="font-semibold text-gray-800">{category.title}</h2>
                            <p className="text-sm text-gray-500">{category.items.length} perguntas</p>
                          </div>
                        </div>
                      </div>
                      
                      <Accordion type="single" collapsible className="px-6">
                        {category.items.map((item, index) => (
                          <AccordionItem 
                            key={index} 
                            value={`${category.id}-${index}`}
                            className="border-b border-gray-100 last:border-0"
                          >
                            <AccordionTrigger className="py-4 text-left hover:no-underline group">
                              <span className="text-sm font-medium text-gray-800 group-hover:text-apolar-blue transition-colors pr-4">
                                {item.question}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4">
                              <p className="text-sm text-gray-600 leading-relaxed">
                                {item.answer}
                              </p>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* CTA */}
        <div className="mt-12 bg-gradient-to-r from-apolar-blue/5 to-apolar-gold/5 rounded-2xl p-8 text-center border border-apolar-blue/10">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Não encontrou o que procurava?
          </h3>
          <p className="text-gray-600 mb-6">
            Nossa assistente virtual AIA pode ajudar com dúvidas mais específicas
          </p>
          <Button 
            onClick={() => window.history.back()}
            className="gap-2 bg-apolar-blue hover:bg-apolar-blue/90"
          >
            <MessageCircle className="h-4 w-4" />
            Falar com a AIA
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Apolar Imóveis. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};

export default FAQ;
