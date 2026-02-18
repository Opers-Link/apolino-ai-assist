import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Check, X, Edit2, Save, Loader2, TrendingUp, TrendingDown, Building2, Clock } from 'lucide-react';

interface BankRate {
  id: string;
  bank_code: string;
  bank_name: string;
  min_rate: number;
  max_rate: number;
  max_ltv: number;
  max_term_months: number;
  admin_fee: number;
  insurance_rate: number;
  modality: string;
  is_active: boolean;
  updated_at: string;
  notes: string | null;
}

interface ScrapedResult {
  bank_code: string;
  bank_name: string;
  current: BankRate | null;
  scraped: {
    min_rate: number;
    max_rate: number;
    max_term_months: number;
    max_ltv: number;
    modality: string;
    notes: string;
  };
  differences: string[];
  has_changes: boolean;
}

interface ScrapeResponse {
  success: boolean;
  results: ScrapedResult[];
  errors: { bank: string; error: string }[];
  summary: {
    total_banks: number;
    processed: number;
    with_changes: number;
    errors: number;
  };
}

export function BankRatesManager() {
  const [rates, setRates] = useState<BankRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapeResults, setScrapeResults] = useState<ScrapeResponse | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BankRate>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_rates')
        .select('*')
        .order('bank_name');

      if (error) throw error;
      setRates(data || []);
    } catch (error) {
      console.error('Erro ao carregar taxas:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar as taxas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async () => {
    setScraping(true);
    setScrapeResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('update-bank-rates', {
        body: {},
      });

      if (error) throw error;

      if (data?.success) {
        setScrapeResults(data);
        toast({
          title: 'Busca concluída',
          description: `${data.summary.processed} bancos processados, ${data.summary.with_changes} com alterações`,
        });
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro no scraping:', error);
      toast({ title: 'Erro', description: 'Falha ao buscar atualizações de taxas', variant: 'destructive' });
    } finally {
      setScraping(false);
    }
  };

  const handleApproveUpdate = async (result: ScrapedResult) => {
    try {
      if (!result.current) {
        toast({ title: 'Erro', description: 'Banco não encontrado no banco de dados', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('bank_rates')
        .update({
          min_rate: result.scraped.min_rate || result.current.min_rate,
          max_rate: result.scraped.max_rate || result.current.max_rate,
          max_ltv: result.scraped.max_ltv || result.current.max_ltv,
          max_term_months: result.scraped.max_term_months || result.current.max_term_months,
          notes: result.scraped.notes || result.current.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', result.current.id);

      if (error) throw error;

      toast({ title: 'Atualizado', description: `Taxas do ${result.bank_name} atualizadas com sucesso` });

      // Remove from results
      setScrapeResults(prev => prev ? {
        ...prev,
        results: prev.results.filter(r => r.bank_code !== result.bank_code),
      } : null);

      loadRates();
    } catch (error) {
      console.error('Erro ao aprovar atualização:', error);
      toast({ title: 'Erro', description: 'Falha ao atualizar taxa', variant: 'destructive' });
    }
  };

  const startEdit = (rate: BankRate) => {
    setEditingId(rate.id);
    setEditForm({
      min_rate: rate.min_rate,
      max_rate: rate.max_rate,
      max_ltv: rate.max_ltv,
      max_term_months: rate.max_term_months,
      admin_fee: rate.admin_fee,
      insurance_rate: rate.insurance_rate,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const { error } = await supabase
        .from('bank_rates')
        .update({
          ...editForm,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (error) throw error;

      toast({ title: 'Salvo', description: 'Taxa atualizada manualmente' });
      setEditingId(null);
      loadRates();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({ title: 'Erro', description: 'Falha ao salvar', variant: 'destructive' });
    }
  };

  const formatRate = (rate: number) => `${(rate * 100).toFixed(2)}%`;
  const formatDate = (date: string) => new Date(date).toLocaleString('pt-BR');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-apolar-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-apolar-blue">Taxas Bancárias</h2>
          <p className="text-muted-foreground">Gerencie as taxas de financiamento imobiliário por banco</p>
        </div>
        <Button
          onClick={handleScrape}
          disabled={scraping}
          className="bg-apolar-blue hover:bg-apolar-blue-dark text-white"
        >
          {scraping ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Buscar Atualizações
            </>
          )}
        </Button>
      </div>

      {/* Scrape Results */}
      {scrapeResults && scrapeResults.results.filter(r => r.has_changes).length > 0 && (
        <Card className="border-apolar-gold/50 bg-apolar-gold/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-apolar-gold" />
              Atualizações Encontradas
            </CardTitle>
            <CardDescription>
              Revise e aprove as diferenças encontradas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scrapeResults.results.filter(r => r.has_changes).map((result) => (
              <Card key={result.bank_code} className="border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-apolar-blue" />
                      <h4 className="font-semibold">{result.bank_name}</h4>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        setScrapeResults(prev => prev ? {
                          ...prev,
                          results: prev.results.filter(r => r.bank_code !== result.bank_code),
                        } : null);
                      }}>
                        <X className="h-4 w-4 mr-1" /> Rejeitar
                      </Button>
                      <Button size="sm" onClick={() => handleApproveUpdate(result)} className="bg-green-600 hover:bg-green-700 text-white">
                        <Check className="h-4 w-4 mr-1" /> Aprovar
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {result.differences.map((diff, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <TrendingDown className="h-3 w-3 text-orange-500" />
                        <span>{diff}</span>
                      </div>
                    ))}
                  </div>
                  {result.scraped.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      {result.scraped.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Scrape Errors */}
      {scrapeResults && scrapeResults.errors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <h4 className="font-semibold text-destructive mb-2">Erros no scraping</h4>
            {scrapeResults.errors.map((err, i) => (
              <p key={i} className="text-sm text-muted-foreground">{err.bank}: {err.error}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Current Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rates.map((rate) => (
          <Card key={rate.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-apolar-blue" />
                  <CardTitle className="text-base">{rate.bank_name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={rate.is_active ? "default" : "secondary"}>
                    {rate.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {editingId === rate.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={saveEdit}>
                        <Save className="h-4 w-4 text-green-600" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(rate)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Atualizado: {formatDate(rate.updated_at)}
              </div>
            </CardHeader>
            <CardContent>
              {editingId === rate.id ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Taxa Mín. (decimal)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={editForm.min_rate || ''}
                      onChange={(e) => setEditForm({ ...editForm, min_rate: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Taxa Máx. (decimal)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={editForm.max_rate || ''}
                      onChange={(e) => setEditForm({ ...editForm, max_rate: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">LTV Máx. (decimal)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.max_ltv || ''}
                      onChange={(e) => setEditForm({ ...editForm, max_ltv: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Prazo Máx. (meses)</Label>
                    <Input
                      type="number"
                      value={editForm.max_term_months || ''}
                      onChange={(e) => setEditForm({ ...editForm, max_term_months: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Taxa Admin (R$)</Label>
                    <Input
                      type="number"
                      value={editForm.admin_fee || ''}
                      onChange={(e) => setEditForm({ ...editForm, admin_fee: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Seguro (decimal)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={editForm.insurance_rate || ''}
                      onChange={(e) => setEditForm({ ...editForm, insurance_rate: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Taxa mín:</span>
                    <span className="ml-1 font-semibold text-apolar-blue">{formatRate(rate.min_rate)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Taxa máx:</span>
                    <span className="ml-1 font-semibold text-apolar-blue">{formatRate(rate.max_rate)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">LTV máx:</span>
                    <span className="ml-1 font-medium">{(rate.max_ltv * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prazo:</span>
                    <span className="ml-1 font-medium">{rate.max_term_months} meses</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Modalidade:</span>
                    <span className="ml-1">{rate.modality}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Taxa admin:</span>
                    <span className="ml-1">R$ {rate.admin_fee}</span>
                  </div>
                  {rate.notes && (
                    <div className="col-span-2 mt-1">
                      <span className="text-xs text-muted-foreground italic">{rate.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {rates.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma taxa cadastrada. Use o botão "Buscar Atualizações" para buscar taxas dos bancos.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
