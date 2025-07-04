import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Simple PDF generation function (creates a basic PDF structure)
function generatePDF(data: any[], query: string, url: string): Uint8Array {
  // This is a simplified PDF generation - in production, you'd use a proper PDF library
  const pdfHeader = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj

4 0 obj
<<
/Length 500
>>
stream
BT
/F1 12 Tf
72 720 Td
(DataGlass Report) Tj
0 -20 Td
(Query: ${query}) Tj
0 -20 Td
(URL: ${url}) Tj
0 -20 Td
(Generated: ${new Date().toISOString()}) Tj
0 -40 Td
(Total Items: ${data.length}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000306 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
856
%%EOF`;

  return new TextEncoder().encode(pdfHeader);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }
  
  try {
    const { scrape_id } = await req.json();
    
    if (!scrape_id) {
      return new Response(
        JSON.stringify({ error: 'Scrape ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the scrape data
    const { data: scrapeData, error: fetchError } = await supabase
      .from('scrapes')
      .select('*')
      .eq('id', scrape_id)
      .single();
    
    if (fetchError || !scrapeData) {
      throw new Error('Scrape not found');
    }
    
    // Generate PDF
    const pdfData = generatePDF(scrapeData.results, scrapeData.user_query, scrapeData.target_url);
    
    // Upload to storage
    const fileName = `report_${scrape_id}_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('generated_files')
      .upload(fileName, pdfData, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      });
    
    if (uploadError) {
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }
    
    // Get signed URL for download
    const { data: { signedUrl }, error: signError } = await supabase.storage
      .from('generated_files')
      .createSignedUrl(fileName, 3600); // 1 hour expiry
    
    if (signError || !signedUrl) {
      throw new Error('Failed to generate download URL');
    }
    
    return new Response(
      JSON.stringify({
        download_url: signedUrl,
        filename: fileName,
        size: pdfData.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('PDF generation error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An error occurred while generating PDF' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});