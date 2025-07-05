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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const requestBody = await req.json();
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

    const results: ScrapeResult[] = [];
    let totalItemsExtracted = 0;

    // Process each URL
    for (const url of urls) {
      try {
        console.log(`Processing URL: ${url}`);
        
        // Prepare Firecrawl request
        const firecrawlPayload: any = {
          url: url,
          formats: firecrawlConfig.formats || ["markdown"],
          onlyMainContent: firecrawlConfig.onlyMainContent !== false,
          waitFor: 3000,
        };

        // Add extract configuration if using extract format
        if (firecrawlConfig.formats && firecrawlConfig.formats.includes("extract")) {
          if (firecrawlConfig.extract && firecrawlConfig.extract.schema) {
            firecrawlPayload.extract = firecrawlConfig.extract;
          } else {
            // Fallback to markdown if extract is malformed
            firecrawlPayload.formats = ["markdown"];
          }
        }

        console.log("Firecrawl payload:", JSON.stringify(firecrawlPayload, null, 2));

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
          console.error("Firecrawl API error:", errorText);
          
          results.push({
            url: url,
            data: null,
            success: false,
            error: `Firecrawl API error: ${errorText}`
          });
          
          // Continue to next URL instead of breaking
        } else {
          const firecrawlData = await firecrawlResponse.json();
          console.log("Firecrawl response success:", firecrawlData.success);
          
          let processedData = [];
          
          // Process extracted data
          if (firecrawlData.data?.extract) {
            const extractedData = firecrawlData.data.extract;
            if (Array.isArray(extractedData)) {
              processedData = extractedData.map((item, index) => ({
                ...item,
                _index: index,
                _url: url
              }));
            } else if (typeof extractedData === 'object') {
              Object.entries(extractedData).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                  const items = value.map((item, index) => ({
                    ...item,
                    _index: index,
                    _category: key,
                    _url: url
                  }));
                  processedData.push(...items);
                }
              });
            }
          } 
          // Process markdown content
          else if (firecrawlData.data?.markdown) {
            const content = firecrawlData.data.markdown;
            const lines = content.split('\n').filter(line => line.trim() && line.length > 10);
            
            processedData = lines.slice(0, 20).map((line, index) => ({
              content: line.trim(),
              type: 'text',
              url: url,
              index: index + 1
            }));
          }

          totalItemsExtracted += processedData.length;

          results.push({
            url: url,
            data: {
              extract: processedData,
              metadata: {
                title: firecrawlData.data?.metadata?.title,
                itemCount: processedData.length,
                userQuery: userQuery
              }
            },
            success: true
          });
        }

      } catch (error) {
        console.error(`Error processing ${url}:`, error);
        results.push({
          url: url,
          data: null,
          success: false,
          error: error.message
        });
      }
    }

    const successfulScrapes = results.filter(r => r.success).length;
    const failedScrapes = results.filter(r => !r.success).length;

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