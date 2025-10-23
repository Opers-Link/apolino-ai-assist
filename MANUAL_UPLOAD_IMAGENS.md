# 📸 Manual de Upload de Imagens dos Manuais

## 🎯 Objetivo

Este documento explica como fazer upload das imagens dos manuais para o bucket do Supabase Storage, permitindo que o chatbot exiba imagens ao responder dúvidas dos usuários.

## 📋 Pré-requisitos

- Ter acesso de **Administrador** no Supabase
- Ter as imagens dos manuais extraídas dos PDFs

## 🔧 Passo a Passo

### 1. Acessar o Supabase Storage

1. Acesse: [https://supabase.com/dashboard/project/nodhzumnsioftsftsbsn/storage/buckets](https://supabase.com/dashboard/project/nodhzumnsioftsftsbsn/storage/buckets)
2. Faça login com suas credenciais
3. Localize o bucket `manuals`

### 2. Fazer Upload das Imagens

As imagens devem ser nomeadas exatamente como indicado abaixo para funcionar corretamente:

#### 📘 Apolar Sales (CRM)
- `apolar-sales-login.png` → Tela de login
- `apolar-sales-tipos-acesso.png` → Tabela de tipos de acesso
- `apolar-sales-dashboard.png` → Dashboard principal
- `apolar-sales-menu-lateral.png` → Menu lateral do sistema
- `apolar-sales-leads.png` → Listagem de leads
- `apolar-sales-criar-lead.png` → Botão de criar novo lead
- `apolar-sales-lead-form.png` → Formulário de cadastro de lead
- `apolar-sales-lead-detalhes.png` → Tela de detalhes do lead

#### 📗 Tutorial Chaves e Reserva
- `tutorial-chaves-capa.png` → Capa do tutorial
- `tutorial-chaves-entrega.png` → Processo de entrega de chaves

#### 📙 Tutorial Lançamentos
- `tutorial-lancamentos-capa.png` → Capa do tutorial
- `tutorial-lancamentos-processo.png` → Fluxo de cadastro de lançamentos

#### 📕 Tutorial Reserva e Proposta
- `tutorial-reserva-capa.png` → Capa do tutorial
- `tutorial-reserva-fluxo.png` → Fluxograma do processo

### 3. Validar URLs

Após o upload, as imagens estarão disponíveis nas seguintes URLs:

```
https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/NOME_DA_IMAGEM.png
```

Exemplo:
```
https://nodhzumnsioftsftsbsn.supabase.co/storage/v1/object/public/manuals/apolar-sales-login.png
```

### 4. Testar no Chat

Após o upload, teste fazendo perguntas ao chatbot como:

- "Como faço login no Apolar Sales?"
- "Quais são os tipos de acesso do sistema?"
- "Como criar um novo lead?"
- "Qual o processo de entrega de chaves?"

O chatbot deve responder com as imagens relevantes.

## 📝 Formato das Imagens

**Recomendações:**
- Formato: PNG ou JPG
- Tamanho máximo: 2MB por imagem
- Resolução recomendada: 1200px de largura
- Comprimir imagens antes do upload para melhorar performance

## 🔍 Como o Sistema Funciona

1. Quando o usuário faz uma pergunta, o chatbot analisa o contexto
2. Se for relevante, inclui marcadores `[IMAGE:url]` na resposta
3. O frontend detecta esses marcadores e renderiza as imagens inline
4. As imagens podem ser clicadas para abrir em nova aba (zoom)

## ⚠️ Troubleshooting

**Imagem não aparece:**
- Verifique se o nome está correto
- Confirme se o bucket `manuals` está público
- Teste a URL diretamente no navegador

**Imagem demora para carregar:**
- Comprima a imagem (reduza o tamanho do arquivo)
- Verifique conexão com internet

**Chatbot não mostra imagem:**
- Certifique-se de que a pergunta é relevante para aquela imagem
- O sistema decide automaticamente quando mostrar imagens

## 📞 Suporte

Em caso de dúvidas, entre em contato com o time de desenvolvimento.
