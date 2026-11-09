# Lacunas de Conhecimento (o que a IA não está esclarecendo)

Nova seção no Dashboard, abaixo do painel de custo, chamada **"Lacunas de Conhecimento"**, respeitando o filtro de datas.

## O que ela identifica
A IA analisa as conversas do período e classifica cada caso em:
1. **Sem resposta nos manuais** – a IA disse que não encontrou a informação ou não tem acesso.
2. **Usuário insatisfeito / apontou erro** – usuário corrigiu, discordou, repetiu a pergunta ou reclamou.
3. **Escalado para humano / ticket** – conversa que precisou de atendente.
4. **Sugestões de refinamento** enviadas pelo botão "Refinar resposta".

## Como aparece
- Cards de resumo: total de cada tipo no período.
- Ranking de **assuntos** com mais lacunas (ex.: "Reserva de imóvel – 14 casos"), com:
  - tipo de lacuna, exemplo de pergunta do usuário, manual relacionado (se houver) e **recomendação do material a complementar**.
  - botão para abrir as conversas de exemplo.
- Botão **"Analisar lacunas"** que gera/atualiza a análise; o último resultado fica salvo (histórico).
- Exportar em CSV para o time de conteúdo.

## Detalhes técnicos
- Nova edge function `analyze-knowledge-gaps` (admin/gerente): busca conversas + mensagens do período, pré-filtra por sinais (frases de "não encontrei", status needs_help, palavras de insatisfação, sugestões), envia ao Gemini (Lovable AI Gateway) e retorna JSON estruturado agrupado por assunto, cruzando com nomes dos módulos de conhecimento.
- Nova tabela `knowledge_gap_reports` (período, dados JSON, contagens) com RLS para admin/gerente.
- Novo componente `KnowledgeGapsPanel.tsx` inserido no dashboard em `Admin.tsx`.
- Não altera o comportamento do chat.
