
# Plano: Permitir Respostas de Conhecimento Geral

## Problema Identificado
O prompt mestre atual instrui a AIA a responder **exclusivamente** com base nos PDFs dos módulos de conhecimento. Quando um usuário faz uma pergunta genérica sobre o mercado imobiliário (ex: "O que significa negociação de imóvel?"), a IA não responde adequadamente porque:

1. A instrução diz: "baseadas exclusivamente nos PDF anexados"
2. Se não achar nos PDFs: "Não tenho acesso a essa informação no momento"
3. A IA não usa seu conhecimento geral sobre imóveis

## Solução Proposta
Ajustar o prompt mestre para criar uma **hierarquia de fontes de conhecimento**:

1. **Prioridade 1**: Documentação oficial (PDFs dos módulos) - para processos, sistemas, procedimentos internos
2. **Prioridade 2**: Conhecimento geral sobre mercado imobiliário - para conceitos, terminologia, práticas do setor
3. **Prioridade 3**: Orientação para abrir ticket - quando for algo específico da Apolar não documentado

## Alterações Necessárias

### Editar o Prompt Mestre (via Painel Admin > Configurações > Prompt da AIA)

Adicionar uma nova seção após "COMO RESPONDER" que diz:

```
# HIERARQUIA DE FONTES DE CONHECIMENTO

1. **Perguntas sobre sistemas e processos internos da Apolar** 
   → Consultar APENAS os módulos de conhecimento (PDFs)
   → Seguir as regras de módulo correto

2. **Perguntas sobre conceitos gerais do mercado imobiliário**
   → Você PODE usar seu conhecimento geral para explicar:
     - Terminologia imobiliária (ex: "o que é ITBI", "o que significa escritura")
     - Conceitos básicos de negociação, compra, venda, locação
     - Legislação geral (Lei do Inquilinato, etc.)
     - Práticas comuns do mercado
   → Nesses casos, após responder, pergunte se o usuário quer saber como isso funciona especificamente na Apolar

3. **Perguntas não relacionadas a imóveis ou sistemas**
   → Orientar gentilmente que você é especializada em assuntos imobiliários e sistemas da Apolar
```

Também ajustar a seção de LIMITAÇÕES:

**De:**
> "Você deve fornecer respostas claras, confiáveis, baseadas exclusivamente nos PDF anexados aos módulos de conhecimento."

**Para:**
> "Para dúvidas sobre processos internos e sistemas da Apolar, baseie-se exclusivamente nos PDFs anexados. Para conceitos gerais do mercado imobiliário, você pode usar seu conhecimento para contextualizar, sempre oferecendo detalhes específicos da Apolar quando relevante."

## Impacto Esperado

| Tipo de Pergunta | Antes | Depois |
|-----------------|-------|--------|
| "O que é negociação de imóvel?" | "Não tenho acesso..." | Explica o conceito geral + pergunta se quer saber como funciona na Apolar |
| "Como faço uma reserva no NET?" | Consulta o módulo NET | (Sem mudança) - Consulta o módulo NET |
| "O que é ITBI?" | "Não tenho acesso..." | Explica o imposto e sua função |
| "Qual o fluxo de locação na Apolar?" | Consulta módulo Locação | (Sem mudança) - Consulta módulo Locação |

---

## Seção Técnica

### Onde fazer a alteração
A alteração deve ser feita no **conteúdo do prompt mestre** que está armazenado na tabela `system_prompts` do banco de dados. 

Você pode editar isso através do painel admin em: **Configurações > Prompt da AIA**

### Código que carrega o prompt
O arquivo `supabase/functions/chat-with-ai/index.ts` já busca dinamicamente o prompt do banco na função `getSystemPrompt()`. Não é necessário alterar código, apenas o conteúdo do prompt.

### Alternativa: Atualização via SQL
Caso prefira, posso gerar um SQL UPDATE para modificar o prompt diretamente no banco, mas recomendo usar o editor visual para manter o histórico de versões.
