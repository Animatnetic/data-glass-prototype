const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ExecuteScrapeRequest {
  urls: string[];
  firecrawlConfig: any;
  extractionSchema: any;
  userQuery: string;
}

interface ScrapeResult {
  url: string;
  data: any;
  success: boolean;
  error?: string;
}

interface ExecuteScrapeResponse {
  results: ScrapeResult[];
  summary: {
    total_urls: number;
    successful_scrapes: number;
    failed_scrapes: number;
    total_items_extracted: number;
  };
  error?: string;
}

// Helper function to process a single URL with timeout and retry
const processSingleUrl = async (
  url: string, 
  urlIndex: number, 
  totalUrls: number,
  firecrawlConfig: any, 
  firecrawlApiKey: string
): Promise<ScrapeResult> => {
  const maxRetries = 2;
  const timeoutMs = 15000; // 15 second timeout per request
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${urlIndex + 1}/${totalUrls}] Attempt ${attempt + 1}: ${url}`);
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });
      
      // Prepare optimized Firecrawl request
      const firecrawlPayload: any = {
        url: url,
        formats: firecrawlConfig.formats || ["markdown"],
        onlyMainContent: firecrawlConfig.onlyMainContent !== false,
        waitFor: 1000, // Reduced wait time
        timeout: 10000, // 10 second Firecrawl timeout
      };

      // Add extract configuration if needed
      if (firecrawlConfig.formats && firecrawlConfig.formats.includes("extract")) {
        if (firecrawlConfig.extract && firecrawlConfig.extract.schema) {
          firecrawlPayload.extract = firecrawlConfig.extract;
        } else {
          firecrawlPayload.formats = ["markdown"];
        }
      }

      // Make request with timeout
      const firecrawlPromise = fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(firecrawlPayload),
      });

      const firecrawlResponse = await Promise.race([firecrawlPromise, timeoutPromise]);

      if (!firecrawlResponse.ok) {
        const errorText = await firecrawlResponse.text();
        throw new Error(`Firecrawl API error (${firecrawlResponse.status}): ${errorText}`);
      }

      const firecrawlData = await firecrawlResponse.json();
      
      // Fast data processing
      let processedData = [];
      let extractionMethod = "unknown";
      
      if (firecrawlData.data?.extract) {
        extractionMethod = "firecrawl_extract";
        const extractedData = firecrawlData.data.extract;
        
        if (Array.isArray(extractedData)) {
          processedData = extractedData.map((item, index) => ({
            ...item,
            _index: index,
            _url: url,
            _source: 'firecrawl_extract'
          }));
        } else if (typeof extractedData === 'object' && extractedData !== null) {
          Object.entries(extractedData).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              const items = value.map((item, index) => ({
                ...item,
                _index: index,
                _category: key,
                _url: url,
                _source: 'firecrawl_extract'
              }));
              processedData.push(...items);
            } else if (value && typeof value === 'object') {
              processedData.push({
                ...value,
                _category: key,
                _url: url,
                _source: 'firecrawl_extract'
              });
            } else if (value !== null && value !== undefined) {
              processedData.push({
                [key]: value,
                _category: key,
                _url: url,
                _source: 'firecrawl_extract'
              });
            }
          });
        }
      } else if (firecrawlData.data?.markdown) {
        extractionMethod = "markdown_parsing";
        const markdown = firecrawlData.data.markdown;
        const lines = markdown.split('\n').filter(line => line.trim());
        
        // Process only first 30 lines for speed
        for (let j = 0; j < Math.min(lines.length, 30); j++) {
          const line = lines[j].trim();
          
          if (line.startsWith('#')) {
            const level = (line.match(/^#+/) || [''])[0].length;
            const title = line.replace(/^#+\s*/, '');
            if (title.length > 0) {
              processedData.push({
                type: 'heading',
                title: title,
                level: level,
                content: title,
                _index: processedData.length,
                _url: url,
                _source: 'markdown_parsing'
              });
            }
          } else if (line.length > 10 && !line.startsWith('*') && !line.startsWith('-')) {
            processedData.push({
              type: 'text',
              content: line,
              _index: processedData.length,
              _url: url,
              _source: 'markdown_parsing'
            });
          }
        }
      } else if (firecrawlData.data?.html) {
        extractionMethod = "html_fallback";
        processedData = [{
          type: 'raw_content',
          content: firecrawlData.data.html.substring(0, 500), // Reduced content size
          title: firecrawlData.data.metadata?.title || 'Untitled',
          _index: 0,
          _url: url,
          _source: 'html_fallback'
        }];
      }

      console.log(`[${urlIndex + 1}/${totalUrls}] SUCCESS: ${processedData.length} items from ${url}`);

      return {
        url: url,
        data: {
          extract: processedData,
          metadata: {
            title: firecrawlData.data?.metadata?.title,
            description: firecrawlData.data?.metadata?.description,
            sourceURL: url,
            scrapedAt: new Date().toISOString(),
            itemCount: processedData.length,
            extractionMethod: extractionMethod,
            format: firecrawlPayload.formats[0]
          },
          raw: {
            markdown: firecrawlData.data?.markdown?.substring(0, 1000),
            html: firecrawlData.data?.html?.substring(0, 1000)
          }
        },
        success: true
      };

    } catch (error) {
      console.error(`[${urlIndex + 1}/${totalUrls}] Attempt ${attempt + 1} failed for ${url}:`, error.message);
      
      // If this was the last attempt, return error
      if (attempt === maxRetries) {
        return {
          url: url,
          data: null,
          success: false,
          error: `Failed after ${maxRetries + 1} attempts: ${error.message}`
        };
      }
      
      // Wait briefly before retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // This should never be reached, but TypeScript requires it
  return {
    url: url,
    data: null,
    success: false,
    error: "Unexpected error in retry loop"
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const requestBody = await req.json();
    console.log("=== EXECUTE SCRAPE START ===");

    const { urls, firecrawlConfig, extractionSchema, userQuery }: ExecuteScrapeRequest = requestBody;

    if (!urls || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: "No URLs provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ error: "Firecrawl API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Processing ${urls.length} URLs concurrently...`);
    const startTime = Date.now();

    // Process all URLs concurrently with optimized settings
    const urlProcessingPromises = urls.map((url, index) => 
      processSingleUrl(url, index, urls.length, firecrawlConfig, firecrawlApiKey)
    );

    // Wait for all URLs to complete (with individual timeouts)
    const results = await Promise.all(urlProcessingPromises);
    
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    console.log(`=== PROCESSING COMPLETED IN ${processingTime.toFixed(2)}s ===`);

    // Calculate summary
    const successfulScrapes = results.filter(r => r.success).length;
    const failedScrapes = results.filter(r => !r.success).length;
    
    let totalItemsExtracted = 0;
    results.forEach(result => {
      if (result.success && result.data?.extract) {
        totalItemsExtracted += result.data.extract.length;
      }
    });

    console.log(`Results: ${successfulScrapes} success, ${failedScrapes} failed, ${totalItemsExtracted} items`);

    const response: ExecuteScrapeResponse = {
      results: results,
      summary: {
        total_urls: urls.length,
        successful_scrapes: successfulScrapes,
        failed_scrapes: failedScrapes,
        total_items_extracted: totalItemsExtracted
      }
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in execute-scrape function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});