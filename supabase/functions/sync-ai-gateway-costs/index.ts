import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const syncItemSchema = z.object({
  run_id: z.string().min(1),
  log_id: z.string().optional(),
  cost_credits: z.number().min(0),
  cost_brl: z.number().min(0).optional(),
});

const requestSchema = z.object({
  items: z.array(syncItemSchema).min(1).max(1000),
  credit_value_brl: z.number().min(0).optional(),
});

// Verifica se o usuário é admin ou gerente
async function isAdminOrGerente(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'gerente'])
    .maybeSingle();

  if (error) {
    console.error('Error checking role:', error);
    return false;
  }
  return !!data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validar JWT do chamador
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!await isAdminOrGerente(supabase, user.id)) {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem sincronizar custos' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: validation.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { items, credit_value_brl } = validation.data;

    // Valor padrão de 1 crédito em R$ (pode ser sobrescrito)
    const creditValueBrl = credit_value_brl ?? 1.0;

    let updated = 0;
    let notFound = 0;

    for (const item of items) {
      const costBrl = item.cost_brl ?? (item.cost_credits * creditValueBrl);

      const { data: matchingRows, error: findError } = await supabase
        .from('ai_usage_logs')
        .select('id')
        .eq('gateway_run_id', item.run_id)
        .is('cost_credits', null)
        .limit(1);

      if (findError) {
        console.error('Error finding row for run_id:', item.run_id, findError);
        continue;
      }

      if (!matchingRows || matchingRows.length === 0) {
        notFound++;
        continue;
      }

      const { error: updateError } = await supabase
        .from('ai_usage_logs')
        .update({
          gateway_log_id: item.log_id ?? null,
          cost_credits: item.cost_credits,
          cost_brl: costBrl,
          cost_source: 'gateway',
        })
        .eq('id', matchingRows[0].id);

      if (updateError) {
        console.error('Error updating cost for run_id:', item.run_id, updateError);
      } else {
        updated++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated, notFound, total: items.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-ai-gateway-costs:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
