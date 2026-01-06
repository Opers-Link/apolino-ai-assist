import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Conversation {
  id: string;
  session_id: string;
  human_requested_at: string;
  sla_alert_sent: boolean;
  assigned_to: string | null;
}

// Validate API key or user authentication
async function validateAccess(req: Request, supabase: any): Promise<{ authorized: boolean; method: string; error?: string }> {
  // Check for internal API key first (for cron jobs, automated calls)
  const apiKey = req.headers.get('X-API-Key');
  const expectedApiKey = Deno.env.get('INTERNAL_API_KEY');
  
  if (apiKey && expectedApiKey && apiKey === expectedApiKey) {
    return { authorized: true, method: 'api_key' };
  }

  // Check for JWT authentication
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return { authorized: false, method: 'none', error: 'Missing authorization - provide X-API-Key or Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return { authorized: false, method: 'jwt', error: 'Invalid or expired token' };
    }

    // Check if user has admin, gerente, or agente role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'gerente', 'agente'])
      .limit(1);

    if (roleError || !roleData || roleData.length === 0) {
      return { authorized: false, method: 'jwt', error: 'Insufficient permissions - staff role required' };
    }

    return { authorized: true, method: 'jwt' };
  } catch (error) {
    console.error('Auth validation error:', error);
    return { authorized: false, method: 'jwt', error: 'Authentication validation failed' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate access
    const accessResult = await validateAccess(req, supabase);
    if (!accessResult.authorized) {
      console.warn('Unauthorized SLA check attempt:', accessResult.error);
      return new Response(
        JSON.stringify({ error: accessResult.error }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`SLA check initiated via ${accessResult.method}`);

    const SLA_LIMIT_MINUTES = 30;
    const WARNING_TIME_MINUTES = 15;

    console.log('Checking SLA for conversations...');

    // Buscar conversas que precisam de ajuda e ainda não foram atendidas
    const { data: conversations, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('status', 'needs_help')
      .is('assigned_to', null);

    if (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }

    console.log(`Found ${conversations?.length || 0} conversations needing help`);

    let alertsWarning = 0;
    let alertsCritical = 0;

    for (const conv of (conversations || [])) {
      if (!conv.human_requested_at) continue;

      const requestedAt = new Date(conv.human_requested_at);
      const now = new Date();
      const minutesWaiting = Math.floor((now.getTime() - requestedAt.getTime()) / 60000);

      console.log(`Conversation ${conv.session_id}: waiting ${minutesWaiting} minutes`);

      // SLA estourado (30 min)
      if (minutesWaiting >= SLA_LIMIT_MINUTES && !conv.sla_alert_sent) {
        console.log(`🚨 CRITICAL: Conversation ${conv.session_id} exceeded SLA (${minutesWaiting} minutes)`);
        
        // Marcar alerta como enviado
        await supabase
          .from('chat_conversations')
          .update({ sla_alert_sent: true })
          .eq('id', conv.id);
        
        alertsCritical++;
        
        // Aqui você pode implementar envio de email/notificação
        // await sendSLAAlert(conv, 'critical');
      }
      // Aviso preventivo (15 min)
      else if (minutesWaiting >= WARNING_TIME_MINUTES && minutesWaiting < SLA_LIMIT_MINUTES) {
        console.log(`⚠️ WARNING: Conversation ${conv.session_id} approaching SLA (${minutesWaiting} minutes)`);
        alertsWarning++;
        
        // Aqui você pode implementar envio de email/notificação
        // await sendSLAAlert(conv, 'warning');
      }
    }

    const result = {
      checked: conversations?.length || 0,
      alertsWarning,
      alertsCritical,
      timestamp: new Date().toISOString()
    };

    console.log('SLA check completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in check-sla function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Função auxiliar para enviar alertas (a ser implementada)
// async function sendSLAAlert(conversation: Conversation, level: 'warning' | 'critical') {
//   // Implementar envio de email usando Resend ou outro serviço
//   // Buscar gerentes e admins
//   // Enviar notificação
// }
