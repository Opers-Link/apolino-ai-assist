import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetricsData {
  totalConversations: number;
  totalMessages: number;
  activeConversations: number;
  aiRequests: number;
  avgAiRequestsPerConversation: number;
}

interface RequestPayload {
  insight_id: string;
  recipients: string[];
  insight_type?: 'manual' | 'conversation';
  metrics?: MetricsData;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const resend = new Resend(resendApiKey);

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente com token do usuário para verificar permissões
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verificar se usuário tem permissão (admin ou gerente)
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cliente admin para verificar roles
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = roles?.map(r => r.role) || [];
    if (!userRoles.includes("admin") && !userRoles.includes("gerente")) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para enviar e-mails" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter payload
    const { insight_id, recipients, insight_type = 'manual', metrics }: RequestPayload = await req.json();

    if (!insight_id || !recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "insight_id e recipients são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar e-mails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of recipients) {
      if (!emailRegex.test(email.trim())) {
        return new Response(
          JSON.stringify({ error: `E-mail inválido: ${email}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Escapar HTML para evitar injeção
    const escapeHtml = (s: unknown): string => {
      if (s === null || s === undefined) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    const safeNumber = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const safeMetrics: MetricsData | undefined = metrics ? {
      totalConversations: safeNumber((metrics as any).totalConversations),
      totalMessages: safeNumber((metrics as any).totalMessages),
      activeConversations: safeNumber((metrics as any).activeConversations),
      aiRequests: safeNumber((metrics as any).aiRequests),
      avgAiRequestsPerConversation: safeNumber((metrics as any).avgAiRequestsPerConversation),
    } : undefined;

    // Buscar insight da tabela correta
    const tableName = insight_type === 'conversation' ? 'conversation_insights' : 'manual_insights';
    const { data: insight, error: insightError } = await supabaseAdmin
      .from(tableName)
      .select("*")
      .eq("id", insight_id)
      .single();

    if (insightError || !insight) {
      return new Response(
        JSON.stringify({ error: "Insight não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const insightsData = insight.insights_data as {
      summary: string;
      top_topics: Array<{ topic: string; count: number; percentage: number }>;
      recurring_issues: Array<{ issue: string; frequency: number; severity: string }>;
      operational_gaps: Array<{ gap: string; recommendation: string }>;
      sentiment_analysis: { positive: number; neutral: number; negative: number };
      trends: Array<{ trend: string; direction: string; change: string }>;
    };

    // Gerar período formatado
    const periodText = insight.period_start && insight.period_end
      ? `${new Date(insight.period_start).toLocaleDateString('pt-BR')} a ${new Date(insight.period_end).toLocaleDateString('pt-BR')}`
      : 'Período não especificado';

    // Título e descrição - compatível com ambos os tipos (escapados)
    const insightTitle = escapeHtml(insight.title || `Insights de Conversas - ${periodText}`);
    const insightDescription = escapeHtml(insight.description || 'Relatório de Insights gerado automaticamente');
    const generatedAt = insight.generated_at || new Date().toISOString();

    // Gerar HTML do e-mail
    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px; }
    .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #003366 0%, #004d99 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 10px 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 30px; }
    .section { margin-bottom: 25px; }
    .section-title { color: #003366; font-size: 16px; font-weight: 600; margin-bottom: 12px; border-bottom: 2px solid #e5a00d; padding-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .summary-box { background: linear-gradient(135deg, #f0f7ff 0%, #fff8e6 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #003366; }
    .summary-box p { margin: 0; line-height: 1.6; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #003366; color: white; padding: 10px; text-align: left; font-size: 13px; }
    td { padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
    tr:hover { background: #f9f9f9; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-high { background: #fee2e2; color: #dc2626; }
    .badge-medium { background: #fef3c7; color: #d97706; }
    .badge-low { background: #dcfce7; color: #16a34a; }
    .gap-item { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #e5a00d; }
    .gap-item strong { color: #003366; }
    .gap-item .recommendation { color: #666; font-size: 13px; margin-top: 8px; }
    .sentiment-bar { display: flex; height: 24px; border-radius: 12px; overflow: hidden; margin-top: 10px; }
    .sentiment-positive { background: #22c55e; }
    .sentiment-neutral { background: #94a3b8; }
    .sentiment-negative { background: #ef4444; }
    .sentiment-legend { display: flex; gap: 20px; margin-top: 15px; font-size: 13px; }
    .sentiment-legend span { display: flex; align-items: center; gap: 6px; }
    .sentiment-legend .dot { width: 12px; height: 12px; border-radius: 50%; }
    .trend-item { display: flex; align-items: center; gap: 10px; padding: 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 8px; }
    .trend-up { color: #16a34a; }
    .trend-down { color: #dc2626; }
    .trend-stable { color: #6b7280; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 0; color: #666; font-size: 12px; }
    .footer img { max-height: 40px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ${insightTitle}</h1>
      <p>${insightDescription} | ${periodText}</p>
    </div>
    
    <div class="content">
      <!-- Métricas do Período -->
      ${safeMetrics ? `
      <div class="section">
        <div class="section-title">📈 Métricas do Período</div>
        <table>
          <tr>
            <th>Métrica</th>
            <th>Valor</th>
          </tr>
          <tr>
            <td>Total de Conversas</td>
            <td><strong>${safeMetrics.totalConversations}</strong></td>
          </tr>
          <tr>
            <td>Total de Mensagens</td>
            <td><strong>${safeMetrics.totalMessages}</strong></td>
          </tr>
          <tr>
            <td>Conversas Ativas</td>
            <td><strong>${safeMetrics.activeConversations}</strong></td>
          </tr>
          <tr>
            <td>Requisições de IA</td>
            <td><strong>${safeMetrics.aiRequests}</strong></td>
          </tr>
          <tr>
            <td>Requisições por Conversa</td>
            <td><strong>${safeMetrics.avgAiRequestsPerConversation}</strong></td>
          </tr>
        </table>
      </div>
      ` : ''}

      <!-- Resumo Executivo -->
      <div class="section">
        <div class="section-title">📋 Resumo Executivo</div>
        <div class="summary-box">
          <p>${escapeHtml(insightsData.summary)}</p>
        </div>
      </div>

      <!-- Principais Tópicos -->
      ${insightsData.top_topics && insightsData.top_topics.length > 0 ? `
      <div class="section">
        <div class="section-title">📌 Principais Tópicos</div>
        <table>
          <tr>
            <th>Tópico</th>
            <th>Menções</th>
            <th>%</th>
          </tr>
          ${insightsData.top_topics.map(topic => `
          <tr>
            <td>${escapeHtml(topic.topic)}</td>
            <td>${safeNumber(topic.count)}</td>
            <td><strong>${safeNumber(topic.percentage)}%</strong></td>
          </tr>
          `).join('')}
        </table>
      </div>
      ` : ''}

      <!-- Problemas Recorrentes -->
      ${insightsData.recurring_issues && insightsData.recurring_issues.length > 0 ? `
      <div class="section">
        <div class="section-title">⚠️ Problemas Recorrentes</div>
        <table>
          <tr>
            <th>Problema</th>
            <th>Frequência</th>
            <th>Severidade</th>
          </tr>
          ${insightsData.recurring_issues.map(issue => {
            const sev = ['high','medium','low'].includes(String(issue.severity)) ? String(issue.severity) : 'low';
            return `
          <tr>
            <td>${escapeHtml(issue.issue)}</td>
            <td>${safeNumber(issue.frequency)}x</td>
            <td><span class="badge badge-${sev}">${sev === 'high' ? 'Alta' : sev === 'medium' ? 'Média' : 'Baixa'}</span></td>
          </tr>`;
          }).join('')}
        </table>
      </div>
      ` : ''}

      <!-- Oportunidades de Melhoria -->
      ${insightsData.operational_gaps && insightsData.operational_gaps.length > 0 ? `
      <div class="section">
        <div class="section-title">🎯 Oportunidades de Melhoria</div>
        ${insightsData.operational_gaps.map(gap => `
        <div class="gap-item">
          <strong>${escapeHtml(gap.gap)}</strong>
          <div class="recommendation">💡 ${escapeHtml(gap.recommendation)}</div>
        </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- Análise de Sentimento -->
      ${insightsData.sentiment_analysis ? `
      <div class="section">
        <div class="section-title">😊 Análise de Sentimento</div>
        <div class="sentiment-bar">
          <div class="sentiment-positive" style="width: ${safeNumber(insightsData.sentiment_analysis.positive)}%"></div>
          <div class="sentiment-neutral" style="width: ${safeNumber(insightsData.sentiment_analysis.neutral)}%"></div>
          <div class="sentiment-negative" style="width: ${safeNumber(insightsData.sentiment_analysis.negative)}%"></div>
        </div>
        <div class="sentiment-legend">
          <span><span class="dot" style="background: #22c55e"></span> Positivo: ${safeNumber(insightsData.sentiment_analysis.positive)}%</span>
          <span><span class="dot" style="background: #94a3b8"></span> Neutro: ${safeNumber(insightsData.sentiment_analysis.neutral)}%</span>
          <span><span class="dot" style="background: #ef4444"></span> Negativo: ${safeNumber(insightsData.sentiment_analysis.negative)}%</span>
        </div>
      </div>
      ` : ''}

      <!-- Tendências -->
      ${insightsData.trends && insightsData.trends.length > 0 ? `
      <div class="section">
        <div class="section-title">📈 Tendências Identificadas</div>
        ${insightsData.trends.map(trend => {
          const dir = ['up','down','stable'].includes(String(trend.direction)) ? String(trend.direction) : 'stable';
          return `
        <div class="trend-item">
          <span class="trend-${dir}">${dir === 'up' ? '↗' : dir === 'down' ? '↘' : '→'}</span>
          <div>
            <strong>${escapeHtml(trend.trend)}</strong>
            <div style="color: #666; font-size: 12px;">${escapeHtml(trend.change)}</div>
          </div>
        </div>`;
        }).join('')}
      </div>
      ` : ''}
    </div>

    </div>

    <div class="footer">
      <p><strong>Apolar Imóveis</strong> | Relatório gerado em ${new Date(generatedAt).toLocaleString('pt-BR')}</p>
      <p>Este e-mail foi enviado automaticamente pelo sistema Apolino AI.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Enviar e-mail - usando domínio de teste do Resend até verificar apolar.com.br
    const emailResponse = await resend.emails.send({
      from: "Apolar Insights <onboarding@resend.dev>",
      to: recipients.map(e => e.trim()),
      subject: `📊 ${String(insight.title || `Insights de Conversas - ${periodText}`).slice(0, 200)}`,
      html: emailHtml,
    });

    console.log("E-mail enviado:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `E-mail enviado para ${recipients.length} destinatário(s)`,
        email_id: emailResponse.data?.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro ao enviar e-mail:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
