import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função segura para converter ArrayBuffer para Base64 (funciona com arquivos grandes)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks para evitar stack overflow
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath, fileId } = await req.json();

    if (!filePath || !fileId) {
      throw new Error('filePath e fileId são obrigatórios');
    }

    console.log('Extracting text from PDF:', filePath);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('manuals')
      .download(filePath);

    if (downloadError) {
      console.error('Error downloading PDF:', downloadError);
      throw new Error(`Erro ao baixar PDF: ${downloadError.message}`);
    }

    // Check file size (limit to 15MB for safety)
    const arrayBuffer = await fileData.arrayBuffer();
    const fileSizeMB = arrayBuffer.byteLength / (1024 * 1024);
    
    console.log(`PDF size: ${fileSizeMB.toFixed(2)} MB`);
    
    if (fileSizeMB > 15) {
      throw new Error(`Arquivo muito grande (${fileSizeMB.toFixed(1)} MB). Limite: 15MB`);
    }

    // Convert blob to base64 using safe chunked method
    console.log('Converting PDF to base64...');
    const base64 = arrayBufferToBase64(arrayBuffer);
    console.log(`Base64 length: ${base64.length} characters`);

    // Use Lovable AI (Gemini) to extract text from PDF
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Sending PDF to Gemini for text extraction...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um extrator de texto de documentos PDF. Sua tarefa é extrair TODO o texto do documento PDF fornecido, preservando a estrutura original o máximo possível (títulos, subtítulos, listas, tabelas, etc).

Regras:
- Extraia TODO o conteúdo de texto legível do documento
- Preserve a hierarquia de títulos usando markdown (# para título principal, ## para subtítulos, etc)
- Preserve listas e numerações
- Para tabelas, converta para formato markdown
- Remova headers/footers repetitivos de páginas
- Mantenha a ordem do conteúdo como aparece no documento
- Se houver imagens com texto (OCR), extraia esse texto também
- Retorne APENAS o texto extraído, sem comentários adicionais`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia todo o texto deste documento PDF:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns minutos.');
      }
      if (response.status === 402) {
        throw new Error('Créditos insuficientes para extração de PDF.');
      }
      
      throw new Error(`Erro na API Gemini: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content;

    console.log('Text extracted successfully, length:', extractedText.length);

    // Save extracted text to database
    const { error: updateError } = await supabase
      .from('knowledge_module_files')
      .update({ extracted_text: extractedText })
      .eq('id', fileId);

    if (updateError) {
      console.error('Error saving extracted text:', updateError);
      throw new Error(`Erro ao salvar texto: ${updateError.message}`);
    }

    console.log('Extracted text saved to database');

    return new Response(
      JSON.stringify({ 
        success: true, 
        textLength: extractedText.length,
        preview: extractedText.substring(0, 500) + '...'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-pdf-text:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
