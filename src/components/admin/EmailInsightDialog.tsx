import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2, Send } from 'lucide-react';

interface EmailInsightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insightId: string;
  insightTitle: string;
  insightType?: 'manual' | 'conversation';
}

export function EmailInsightDialog({
  open,
  onOpenChange,
  insightId,
  insightTitle,
  insightType = 'manual',
}: EmailInsightDialogProps) {
  const [recipients, setRecipients] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!recipients.trim()) {
      toast({
        title: 'E-mail obrigatório',
        description: 'Informe pelo menos um e-mail destinatário',
        variant: 'destructive',
      });
      return;
    }

    const emailList = recipients
      .split(/[,;\s]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (emailList.length === 0) {
      toast({
        title: 'E-mail inválido',
        description: 'Nenhum e-mail válido foi encontrado',
        variant: 'destructive',
      });
      return;
    }

    // Validação básica de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emailList.filter(e => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      toast({
        title: 'E-mail(s) inválido(s)',
        description: `Formato inválido: ${invalidEmails.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-insights-email', {
        body: {
          insight_id: insightId,
          recipients: emailList,
          insight_type: insightType,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'E-mail enviado!',
        description: data.message || `Insight enviado para ${emailList.length} destinatário(s)`,
      });

      setRecipients('');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao enviar e-mail:', error);
      toast({
        title: 'Erro ao enviar e-mail',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-apolar-blue" />
            Enviar Insight por E-mail
          </DialogTitle>
          <DialogDescription>
            Envie o relatório "<strong>{insightTitle}</strong>" para um ou mais destinatários.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="recipients">Destinatário(s)</Label>
            <Input
              id="recipients"
              type="text"
              placeholder="email@exemplo.com, outro@exemplo.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              disabled={sending}
            />
            <p className="text-xs text-muted-foreground">
              Separe múltiplos e-mails por vírgula, ponto-e-vírgula ou espaço.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !recipients.trim()}
            className="bg-apolar-blue hover:bg-apolar-blue-dark"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
