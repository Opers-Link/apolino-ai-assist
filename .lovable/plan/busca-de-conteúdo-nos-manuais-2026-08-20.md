# Busca de conteúdo nos manuais

Objetivo: na tela de Manuais (Base de Conhecimento), permitir buscar um assunto e descobrir em qual manual/arquivo aquela informação está.

## Como vai funcionar

- Um campo de busca no topo da tela de Manuais, com botão "Buscar nos manuais".
- Ao buscar, o sistema percorre o texto extraído de todos os arquivos de todos os módulos (PDF, CSV, XLSX já processados).
- Resultado em lista, agrupado por manual:
  - Nome do módulo (manual) e do arquivo.
  - Quantidade de ocorrências encontradas.
  - Até 3 trechos de contexto (~200 caracteres) com o termo destacado em amarelo.
  - Botão para abrir/expandir o módulo correspondente na lista abaixo.
- Busca sem diferenciar maiúsculas/minúsculas e sem acentos (ex.: "reserva" encontra "Reserva").
- Se um arquivo ainda não tiver texto extraído, ele é sinalizado como "não pesquisável" para você reprocessar.
- Botão para limpar a busca e voltar à visão normal.

## Detalhes técnicos

- Arquivo alterado: `src/components/admin/KnowledgeModulesManager.tsx` (somente frontend).
- Os módulos e arquivos já são carregados com o campo `extracted_text`; a busca roda em memória sobre esses dados, sem nova consulta ao banco e sem mudanças no banco.
- Normalização com `String.normalize('NFD')` para ignorar acentos; extração de trechos por índice de ocorrência.
- Nenhuma alteração em edge functions, RLS ou no comportamento do chat.
