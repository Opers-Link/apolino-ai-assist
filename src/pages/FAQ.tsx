import { useState, useEffect } from 'react';
import { HelpCircle, ArrowLeft, MessageCircle, Loader2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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

interface UpcomingUpdate {
  id: string;
  title: string;
  description: string;
  status: string;
}

const FAQ = () => {
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<FAQCategory[]>([]);
  const [updates, setUpdates] = useState<UpcomingUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFAQData();
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from('upcoming_updates')
        .select('id, title, description, status')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      setUpdates(data || []);
    } catch (error) {
      console.error('Erro ao carregar atualizações:', error);
    }
  };

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

      {/* Hero */}
      <section className="bg-gradient-to-r from-apolar-blue to-apolar-blue/90 text-white py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur p-3">
              <HelpCircle className="h-full w-full text-apolar-gold" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-white">
            Dúvidas Frequentes
          </h1>
          <p className="text-white/80 text-lg mb-8">
            Encontre respostas rápidas para as principais questões sobre os sistemas Apolar
          </p>
          
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
        ) : (
          <>
            {/* Category Grid */}
            {!selectedCategory && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className="p-6 bg-white rounded-xl border border-gray-200 hover:border-apolar-blue/30 hover:shadow-lg transition-all text-left group"
                  >
                    <span className="text-3xl mb-3 block">{category.icon}</span>
                    <h3 className="text-[30px] font-semibold text-gray-800 mb-1 group-hover:text-apolar-blue transition-colors line-clamp-2">
                      {category.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-apolar-blue font-medium mt-2">
                      <span>{category.questions.length} perguntas</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Category */}
            {selectedCategory && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="gap-2 text-gray-600 hover:text-apolar-blue mb-6"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar às categorias
                </Button>

                <div className="space-y-6">
                  {categories.filter(c => c.id === selectedCategory).map((category) => (
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

        {/* Próximas Atualizações */}
        <div className="mt-12 bg-gradient-to-br from-apolar-gold/10 via-amber-50 to-orange-50 rounded-2xl p-8 border border-apolar-gold/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-apolar-gold to-apolar-gold-alt flex items-center justify-center">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Próximas Atualizações</h3>
              <p className="text-sm text-gray-500">Em desenvolvimento</p>
            </div>
          </div>
          
          <div className="grid gap-3">
            {updates.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Nenhuma atualização disponível no momento.
              </p>
            ) : (
              updates.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-apolar-gold/10 hover:border-apolar-gold/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-apolar-gold animate-pulse" />
                    <div>
                      <p className="font-medium text-gray-800">{item.title}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                    item.status === "Em breve" 
                      ? "bg-green-100 text-green-700" 
                      : item.status === "Em desenvolvimento"
                      ? "bg-blue-100 text-blue-700"
                      : item.status === "Em análise"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 bg-gradient-to-r from-apolar-blue/5 to-apolar-gold/5 rounded-2xl p-8 text-center border border-apolar-blue/10">
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