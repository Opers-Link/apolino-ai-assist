import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Criar cliente com service role para operações admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, display_name, phone, mobile_phone, role } = await req.json();

    // Validar email
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar role
    const validRoles = ['admin', 'gerente', 'agente', 'user'];
    if (role && !validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Tipo de acesso inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Criando convite para usuário: ${email}`);

    // Criar usuário via invite (envia email para definir senha)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        display_name: display_name || email.split('@')[0],
      },
      redirectTo: `${req.headers.get('origin') || supabaseUrl}/auth`,
    });

    if (inviteError) {
      console.error('Erro ao enviar convite:', inviteError);
      
      // Verificar se é erro de email duplicado
      if (inviteError.message.includes('already been registered') || inviteError.message.includes('already exists')) {
        return new Response(
          JSON.stringify({ error: 'Este email já está cadastrado no sistema' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = inviteData.user.id;
    console.log(`Usuário criado com ID: ${userId}`);

    // Aguardar um pouco para o trigger criar o perfil
    await new Promise(resolve => setTimeout(resolve, 500));

    // Atualizar perfil com dados adicionais
    if (phone || mobile_phone || display_name) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          display_name: display_name || email.split('@')[0],
          phone: phone || null,
          mobile_phone: mobile_phone || null,
        })
        .eq('user_id', userId);

      if (profileError) {
        console.error('Erro ao atualizar perfil:', profileError);
        // Não retornar erro, pois o usuário já foi criado
      }
    }

    // Atualizar role se diferente do padrão
    if (role && role !== 'user') {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role: role })
        .eq('user_id', userId);

      if (roleError) {
        console.error('Erro ao atualizar role:', roleError);
        // Não retornar erro, pois o usuário já foi criado
      }
    }

    console.log(`Usuário ${email} criado com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Convite enviado com sucesso. O usuário receberá um email para definir sua senha.',
        user_id: userId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função invite-user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
