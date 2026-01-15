import { useState, useMemo, useEffect } from 'react';
import { Search, HelpCircle, ArrowLeft, MessageCircle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import aiaLogo from '@/assets/aia-logo.png';
import { supabase } from '@/integrations/supabase/client';

interface FAQQuestion {
  id: string;
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  name: string;
  icon: string;
  questions: FAQQuestion[];
}

const FAQ = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<FAQCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFAQData();
  }, []);

  const loadFAQData = async () => {
    try {
      setLoading(true);
      
      // Load active categories
      const { data: categoriesData, error: catError } = await supabase
        .from('faq_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (catError) throw catError;
      
      // Load active questions
      const { data: questionsData, error: qError } = await supabase
        .from('faq_questions')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (qError) throw qError;
      
      // Combine data
      const categoriesWithQuestions = (categoriesData || []).map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        questions: (questionsData || [])
          .filter(q => q.category_id === cat.id)
          .map(q => ({
            id: q.id,
            question: q.question,
            answer: q.answer
          }))
      })).filter(cat => cat.questions.length > 0); // Only show categories with questions
      
      setCategories(categoriesWithQuestions);
    } catch (error) {
      console.error('Erro ao carregar FAQ:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;

    const term = searchTerm.toLowerCase();
    
    return categories
      .map(category => ({
        ...category,
        questions: category.questions.filter(
          item =>
            item.question.toLowerCase().includes(term) ||
            item.answer.toLowerCase().includes(term)
        )
      }))
      .filter(category => category.questions.length > 0);
  }, [searchTerm, categories]);

  const totalQuestions = categories.reduce((acc, cat) => acc + cat.questions.length, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-apolar-blue/5 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-apolar-blue" />
      </div>
    );
  }

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
            {totalQuestions} perguntas em {categories.length} categorias
          </p>
        </div>
      </section>

      {/* Categories */}
      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {categories.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              Nenhuma pergunta disponível
            </h3>
            <p className="text-gray-500 mb-4">
              O FAQ ainda está sendo configurado. Tente novamente mais tarde.
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        ) : searchTerm && filteredCategories.length === 0 ? (
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
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className="p-6 bg-white rounded-xl border border-gray-200 hover:border-apolar-blue/30 hover:shadow-lg transition-all text-left group"
                  >
                    <span className="text-3xl mb-3 block">{category.icon}</span>
                    <h3 className="font-semibold text-gray-800 mb-1 group-hover:text-apolar-blue transition-colors">
                      {category.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-apolar-blue font-medium mt-2">
                      <span>{category.questions.length} perguntas</span>
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
                  {(searchTerm ? filteredCategories : categories.filter(c => c.id === selectedCategory)).map((category) => (
                    <div key={category.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{category.icon}</span>
                          <div>
                            <h2 className="font-semibold text-gray-800">{category.name}</h2>
                            <p className="text-sm text-gray-500">{category.questions.length} perguntas</p>
                          </div>
                        </div>
                      </div>
                      
                      <Accordion type="single" collapsible className="px-6">
                        {category.questions.map((item, index) => (
                          <AccordionItem 
                            key={item.id} 
                            value={item.id}
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