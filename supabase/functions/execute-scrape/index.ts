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

// Helper function to process a single URL
const processSingleUrl = async (
  url: string, 
  urlIndex: number, 
  totalUrls: number,
  firecrawlConfig: any, 
  firecrawlApiKey: string
): Promise<ScrapeResult> => {
  console.log(`[${urlIndex + 1}/${totalUrls}] Starting processing: ${url}`);
  
  try {
    // Prepare Firecrawl request
    const firecrawlPayload: any = {
      url: url,
      formats: firecrawlConfig.formats || ["markdown"],
      onlyMainContent: firecrawlConfig.onlyMainContent !== false,
      waitFor: 3000,
    };

    // Add extract configuration if needed
    if (firecrawlConfig.formats && firecrawlConfig.formats.includes("extract")) {
      if (firecrawlConfig.extract && firecrawlConfig.extract.schema) {
        firecrawlPayload.extract = firecrawlConfig.extract;
        console.log(`[${urlIndex + 1}/${totalUrls}] Using extract configuration for ${url}`);
      } else {
        console.log(`[${urlIndex + 1}/${totalUrls}] Extract format specified but no schema, falling back to markdown for ${url}`);
        firecrawlPayload.formats = ["markdown"];
      }
    }

    console.log(`[${urlIndex + 1}/${totalUrls}] Making Firecrawl request for ${url}...`);
    
    // Make request to Firecrawl
    const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(firecrawlPayload),
    });

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      console.error(`[${urlIndex + 1}/${totalUrls}] Firecrawl API error for ${url}:`, errorText);
      
      return {
        url: url,
        data: null,
        success: false,
        error: `Firecrawl API error (${firecrawlResponse.status}): ${errorText}`
      };
    }

    const firecrawlData = await firecrawlResponse.json();
    console.log(`[${urlIndex + 1}/${totalUrls}] Firecrawl response received for ${url}`);
    
    let processedData = [];
    let extractionMethod = "unknown";
    
    // Process the response data
    if (firecrawlData.data?.extract) {
      console.log(`[${urlIndex + 1}/${totalUrls}] Processing extracted data for ${url}`);
      extractionMethod = "firecrawl_extract";
      
      // Handle extracted data
      const extractedData = firecrawlData.data.extract;
      if (Array.isArray(extractedData)) {
        processedData = extractedData.map((item, index) => ({
          ...item,
          _index: index,
          _url: url,
          _source: 'firecrawl_extract'
        }));
      } else if (typeof extractedData === 'object' && extractedData !== null) {
        // Handle object with arrays
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
      console.log(`[${urlIndex + 1}/${totalUrls}] Processing markdown content for ${url}`);
      extractionMethod = "markdown_parsing";
      
      // Process markdown content
      const markdown = firecrawlData.data.markdown;
      const lines = markdown.split('\n').filter(line => line.trim());
      
      for (let j = 0; j < Math.min(lines.length, 50); j++) {
        const line = lines[j].trim();
        
        // Extract headings
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
        }
        // Extract meaningful content
        else if (line.length > 10 && !line.startsWith('*') && !line.startsWith('-')) {
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
      console.log(`[${urlIndex + 1}/${totalUrls}] Processing HTML content for ${url}`);
      extractionMethod = "html_fallback";
      
      // Fallback for HTML content
      processedData = [{
        type: 'raw_content',
        content: firecrawlData.data.html.substring(0, 1000),
        title: firecrawlData.data.metadata?.title || 'Untitled',
        _index: 0,
        _url: url,
        _source: 'html_fallback'
      }];
    }

    console.log(`[${urlIndex + 1}/${totalUrls}] Processed ${processedData.length} items from ${url} using ${extractionMethod}`);

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
          markdown: firecrawlData.data?.markdown?.substring(0, 2000),
          html: firecrawlData.data?.html?.substring(0, 2000)
        }
      },
      success: true
    };

  } catch (error) {
    console.error(`[${urlIndex + 1}/${totalUrls}] Error processing ${url}:`, error);
    return {
      url: url,
      data: null,
      success: false,
      error: `Processing error: ${error.message}`
    };
  }
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
    console.log("Received request:", JSON.stringify(requestBody, null, 2));

    const { urls, firecrawlConfig, extractionSchema, userQuery }: ExecuteScrapeRequest = requestBody;

    if (!urls || urls.length === 0) {
      console.error("No URLs provided");
      return new Response(
        JSON.stringify({ 
          error: "No URLs provided"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    
    if (!firecrawlApiKey) {
      console.error("Firecrawl API key not found");
      return new Response(
        JSON.stringify({ 
          error: "Firecrawl API key not configured"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Starting concurrent processing of ${urls.length} URLs...`);
    console.log("URLs to process:", urls);
    console.log("Firecrawl config:", JSON.stringify(firecrawlConfig, null, 2));
    
    const startTime = Date.now();

    // Process all URLs concurrently using Promise.all
    const urlProcessingPromises = urls.map((url, index) => 
      processSingleUrl(url, index, urls.length, firecrawlConfig, firecrawlApiKey)
    );

    console.log("Waiting for all URL processing to complete...");
    
    // Wait for all URLs to be processed
    const results = await Promise.all(urlProcessingPromises);
    
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    console.log(`=== CONCURRENT PROCESSING COMPLETED ===`);
    console.log(`Total processing time: ${processingTime.toFixed(2)} seconds`);
    console.log(`Average time per URL: ${(processingTime / urls.length).toFixed(2)} seconds`);

    // Calculate summary statistics
    const successfulScrapes = results.filter(r => r.success).length;
    const failedScrapes = results.filter(r => !r.success).length;
    
    let totalItemsExtracted = 0;
    results.forEach(result => {
      if (result.success && result.data?.extract) {
        totalItemsExtracted += result.data.extract.length;
      }
    });

    console.log("=== FINAL SUMMARY ===");
    console.log(`Total URLs: ${urls.length}`);
    console.log(`Successful scrapes: ${successfulScrapes}`);
    console.log(`Failed scrapes: ${failedScrapes}`);
    console.log(`Total items extracted: ${totalItemsExtracted}`);
    console.log(`Processing time: ${processingTime.toFixed(2)}s`);
    
    // Log individual results
    results.forEach((result, index) => {
      const status = result.success ? 'SUCCESS' : 'FAILED';
      const itemCount = result.success ? result.data?.extract?.length || 0 : 0;
      const method = result.success ? result.data?.metadata?.extractionMethod || 'unknown' : 'failed';
      console.log(`[${index + 1}] ${status}: ${result.url} - ${itemCount} items (${method})`);
      if (!result.success) {
        console.log(`    Error: ${result.error}`);
      }
    });

    const response: ExecuteScrapeResponse = {
      results: results,
      summary: {
        total_urls: urls.length,
        successful_scrapes: successfulScrapes,
        failed_scrapes: failedScrapes,
        total_items_extracted: totalItemsExtracted
      }
    };

    console.log("=== EXECUTE SCRAPE END ===");

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
        message: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});