import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const AI_MODEL = 'google/gemini-3-flash-preview';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const NOT_FOUND = ['nao encontrei', 'nao tenho acesso', 'nao possuo', 'nao tenho informac', 'nao consta', 'nao ha informac', 'nao consigo responder', 'nao tenho essa informac', 'fora do meu escopo', 'abra um ticket', 'abrir um ticket', 'recomendo entrar em contato'];
const UNHAPPY = ['nao e isso', 'errado', 'incorret', 'nao funcion', 'nao ajudou', 'nao entendi', 'nao resolveu', 'esta errad', 'mentira', 'nao faz sentido', 'ainda nao', 'continua', 'de novo', 'pessim', 'ruim', 'inutil', 'nao serve', 'atendente', 'humano', 'falar com alguem'];

async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ error: 'LOVABLE_API_KEY não configurada' }, 500);

    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401);
    const { data: claims, error: cErr } = await supabase.auth.getClaims(auth.replace('Bearer ', ''));
    if (cErr || !claims?.claims?.sub) return json({ error: 'Token inválido' }, 401);
    const userId = claims.claims.sub as string;
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    const rs = new Set((roles || []).map((r: any) => r.role));
    if (!rs.has('admin') && !rs.has('gerente')) return json({ error: 'Sem permissão' }, 403);

    const body = await req.json().catch(() => ({}));
    const period_start = typeof body.period_start === 'string' ? body.period_start : null;
    const period_end = typeof body.period_end === 'string' ? body.period_end : null;
    if (!period_start || !period_end || isNaN(Date.parse(period_start)) || isNaN(Date.parse(period_end))) {
      return json({ error: 'period_start e period_end são obrigatórios (ISO)' }, 400);
    }

    const convs = await fetchAll<any>((f, t) => supabase.from('chat_conversations')
      .select('id, status, human_requested_at, total_messages, external_user_id, started_at')
      .gte('started_at', period_start).lte('started_at', period_end).gt('total_messages', 0)
      .order('started_at', { ascending: false }).range(f, t));
    if (convs.length === 0) return json({ error: 'Nenhuma conversa com mensagens no período' }, 404);

    const ids = convs.map((c) => c.id);
    const msgs: any[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      msgs.push(...await fetchAll<any>((f, t) => supabase.from('chat_messages')
        .select('conversation_id, content, is_user, message_order').in('conversation_id', chunk)
        .order('message_order').range(f, t)));
    }
    const byConv = new Map<string, any[]>();
    for (const m of msgs) {
      if (!byConv.has(m.conversation_id)) byConv.set(m.conversation_id, []);
      byConv.get(m.conversation_id)!.push(m);
    }

    const { data: suggestions } = await supabase.from('user_refinement_suggestions')
      .select('suggestion, context, conversation_id').gte('created_at', period_start).lte('created_at', period_end).limit(100);
    const { data: modules } = await supabase.from('knowledge_modules').select('name, description');

    // Pre-filter by signals
    type Flagged = { id: string; signals: string[]; transcript: string };
    const flagged: Flagged[] = [];
    const counts = { not_found: 0, unhappy: 0, escalated: 0, suggestions: suggestions?.length || 0 };
    for (const c of convs) {
      const ms = byConv.get(c.id) || [];
      const signals: string[] = [];
      if (ms.some((m) => !m.is_user && NOT_FOUND.some((k) => norm(m.content).includes(k)))) { signals.push('sem_resposta'); counts.not_found++; }
      if (ms.some((m) => m.is_user && UNHAPPY.some((k) => norm(m.content).includes(k)))) { signals.push('insatisfeito'); counts.unhappy++; }
      if (c.human_requested_at || c.status === 'needs_help') { signals.push('escalado'); counts.escalated++; }
      if (signals.length) {
        const transcript = ms.slice(0, 12).map((m) => `${m.is_user ? 'U' : 'IA'}: ${m.content.slice(0, 300)}`).join('\n');
        flagged.push({ id: c.id, signals, transcript });
      }
    }

    if (flagged.length === 0 && counts.suggestions === 0) {
      const report = { summary: 'Nenhuma lacuna identificada no período.', counts, topics: [] };
      const { data: saved } = await supabase.from('knowledge_gap_reports').insert({
        period_start, period_end, report_data: report, conversation_count: convs.length, flagged_count: 0, generated_by: userId,
      }).select().single();
      return json({ success: true, report: saved });
    }

    const sample = flagged.slice(0, 80);
    const context = sample.map((f) => `[conv:${f.id}] sinais=${f.signals.join(',')}\n${f.transcript}`).join('\n---\n');
    const sugText = (suggestions || []).slice(0, 50).map((s: any) => `- ${s.suggestion}${s.conversation_id ? ` [conv:${s.conversation_id}]` : ''}`).join('\n');
    const modText = (modules || []).map((m: any) => `- ${m.name}${m.description ? `: ${m.description}` : ''}`).join('\n');

    const system = `Você é analista de conteúdo da Apolar Imóveis. Identifique LACUNAS DE CONHECIMENTO do assistente AIA: assuntos em que a IA não encontrou resposta nos manuais, respondeu de forma incorreta/insatisfatória, ou precisou escalar para humano.
Agrupe por ASSUNTO específico (ex.: "Cancelamento de reserva no Apolar Net"), não genérico.
Manuais existentes:\n${modText || '(nenhum)'}
Responda APENAS JSON válido:
{"summary":"2-3 frases","topics":[{"topic":"...","gap_type":"sem_resposta|insatisfeito|escalado|sugestao","occurrences":number,"severity":"high|medium|low","example_question":"pergunta real do usuário","related_manual":"nome do manual existente ou null","recommendation":"o que incluir/corrigir no material","conversation_ids":["uuid"]}]}
Ordene por occurrences desc. Máximo 15 tópicos. Use apenas conversation_ids fornecidos.`;
    const user = `Conversas sinalizadas (${flagged.length} de ${convs.length}; amostra de ${sample.length}):\n${context}\n\nSugestões de refinamento enviadas por usuários:\n${sugText || '(nenhuma)'}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_MODEL, stream: true, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!aiRes.ok || !aiRes.body) {
      const t = await aiRes.text();
      console.error('AI error', aiRes.status, t);
      if (aiRes.status === 429) return json({ error: 'Limite de requisições atingido. Tente novamente em alguns minutos.' }, 429);
      if (aiRes.status === 402) return json({ error: 'Créditos de IA insuficientes no workspace.' }, 402);
      return json({ error: `Erro na IA (${aiRes.status})` }, aiRes.status === 403 ? 403 : 502);
    }

    // Accumulate SSE stream
    const reader = aiRes.body.getReader();
    const dec = new TextDecoder();
    let buf = '', content = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const d = l.slice(5).trim();
        if (d === '[DONE]') continue;
        try { content += JSON.parse(d).choices?.[0]?.delta?.content || ''; } catch { /* partial */ }
      }
    }

    let parsed: any;
    try {
      const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
      parsed = JSON.parse(clean.slice(s, e + 1));
    } catch {
      console.error('Parse fail', content.slice(0, 500));
      return json({ error: 'A IA retornou um formato inválido. Tente novamente.' }, 502);
    }
    const validIds = new Set(convs.map((c) => c.id));
    const topics = (Array.isArray(parsed.topics) ? parsed.topics : []).map((t: any) => ({
      ...t, conversation_ids: (t.conversation_ids || []).filter((id: string) => validIds.has(id)).slice(0, 10),
    }));
    const report = { summary: parsed.summary || '', counts, topics };

    const { data: saved, error: sErr } = await supabase.from('knowledge_gap_reports').insert({
      period_start, period_end, report_data: report, conversation_count: convs.length, flagged_count: flagged.length, generated_by: userId,
    }).select().single();
    if (sErr) throw sErr;
    return json({ success: true, report: saved });
  } catch (e) {
    console.error('analyze-knowledge-gaps error', e);
    return json({ error: e instanceof Error ? e.message : 'Erro desconhecido' }, 500);
  }
});
