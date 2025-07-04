import { createClient } from 'npm:@supabase/supabase-js@2';
import { DOMParser } from 'npm:deno-dom@0.1.43/deno-dom-wasm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface ScrapeRequest {
  url: string;
  query: string;
}

interface ScrapeData {
  [key: string]: string | number;
}

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Enhanced selector inference logic
function inferSelectors(query: string, htmlContent: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  if (!doc) return [];
  
  const lowerQuery = query.toLowerCase();
  const selectors: string[] = [];
  
  // Common patterns based on query keywords
  const patterns = [
    { keywords: ['title', 'headline', 'header'], selectors: ['h1', 'h2', 'h3', '.title', '.headline', '.header'] },
    { keywords: ['price', 'cost', 'amount'], selectors: ['.price', '.cost', '.amount', '[data-price]'] },
    { keywords: ['description', 'content', 'text'], selectors: ['p', '.description', '.content', '.text'] },
    { keywords: ['link', 'url', 'href'], selectors: ['a[href]'] },
    { keywords: ['image', 'img', 'photo'], selectors: ['img[src]'] },
    { keywords: ['email', 'contact'], selectors: ['a[href^="mailto:"]', '.email', '.contact'] },
    { keywords: ['phone', 'tel'], selectors: ['a[href^="tel:"]', '.phone', '.tel'] },
    { keywords: ['date', 'time'], selectors: ['time', '.date', '.time', '[datetime]'] },
    { keywords: ['name', 'author'], selectors: ['.name', '.author', '.by'] },
    { keywords: ['table', 'row', 'data'], selectors: ['table tr', 'tbody tr'] },
  ];
  
  // Find matching patterns
  patterns.forEach(pattern => {
    if (pattern.keywords.some(keyword => lowerQuery.includes(keyword))) {
      selectors.push(...pattern.selectors);
    }
  });
  
  // If no specific patterns match, try generic content selectors
  if (selectors.length === 0) {
    selectors.push('p', 'div', 'span', 'h1', 'h2', 'h3', 'li');
  }
  
  // Filter selectors that actually exist in the document
  return selectors.filter(selector => {
    try {
      return doc.querySelector(selector) !== null;
    } catch {
      return false;
    }
  });
}

function extractData(htmlContent: string, selectors: string[]): ScrapeData[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  if (!doc) return [];
  
  const results: ScrapeData[] = [];
  
  selectors.forEach(selector => {
    try {
      const elements = doc.querySelectorAll(selector);
      elements.forEach((element, index) => {
        const data: ScrapeData = {
          selector: selector,
          index: index,
          text: element.textContent?.trim() || '',
        };
        
        // Add additional attributes based on element type
        if (element.tagName === 'A') {
          data.href = element.getAttribute('href') || '';
        }
        if (element.tagName === 'IMG') {
          data.src = element.getAttribute('src') || '';
          data.alt = element.getAttribute('alt') || '';
        }
        if (element.getAttribute('datetime')) {
          data.datetime = element.getAttribute('datetime') || '';
        }
        
        if (data.text || data.href || data.src) {
          results.push(data);
        }
      });
    } catch (error) {
      console.warn(`Error with selector ${selector}:`, error);
    }
  });
  
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }
  
  try {
    const { url, query }: ScrapeRequest = await req.json();
    
    if (!url || !query) {
      return new Response(
        JSON.stringify({ error: 'URL and query are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create initial record
    const { data: scrapeRecord, error: insertError } = await supabase
      .from('scrapes')
      .insert({
        target_url: url,
        user_query: query,
        status: 'processing'
      })
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Failed to create scrape record: ${insertError.message}`);
    }
    
    // Fetch the target URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DataGlass/1.0 (Web Scraper)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    const htmlContent = await response.text();
    
    // Infer selectors based on the query
    const selectors = inferSelectors(query, htmlContent);
    
    if (selectors.length === 0) {
      throw new Error('No relevant selectors found for the given query');
    }
    
    // Extract data
    const extractedData = extractData(htmlContent, selectors);
    
    if (extractedData.length === 0) {
      throw new Error('No data extracted from the page');
    }
    
    // Create preview (first 5 items)
    const previewData = extractedData.slice(0, 5);
    
    // Update the record with results
    const { error: updateError } = await supabase
      .from('scrapes')
      .update({
        results: extractedData,
        preview_data: previewData,
        status: 'completed'
      })
      .eq('id', scrapeRecord.id);
    
    if (updateError) {
      throw new Error(`Failed to update scrape record: ${updateError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        id: scrapeRecord.id,
        preview: previewData,
        total_items: extractedData.length,
        selectors_used: selectors,
        status: 'completed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Scrape error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An error occurred while scraping',
        status: 'error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});