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
    const { urls, firecrawlConfig, extractionSchema, userQuery }: ExecuteScrapeRequest = await req.json();

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

    const results: ScrapeResult[] = [];
    let totalItemsExtracted = 0;

    // Process each URL
    for (const url of urls) {
      try {
        // Prepare Firecrawl request
        const firecrawlPayload: any = {
          url: url,
          formats: firecrawlConfig.formats || ["markdown"],
          onlyMainContent: firecrawlConfig.onlyMainContent !== false,
        };

        // Add optional configuration
        if (firecrawlConfig.includeTags) {
          firecrawlPayload.includeTags = firecrawlConfig.includeTags;
        }
        if (firecrawlConfig.excludeTags) {
          firecrawlPayload.excludeTags = firecrawlConfig.excludeTags;
        }
        if (firecrawlConfig.waitFor) {
          firecrawlPayload.waitFor = firecrawlConfig.waitFor;
        }

        // Add extraction schema if provided
        if (extractionSchema && Object.keys(extractionSchema).length > 0) {
          firecrawlPayload.extract = {
            schema: extractionSchema
          };
        }

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
          results.push({
            url: url,
            data: null,
            success: false,
            error: `Firecrawl API error: ${errorText}`
          });
          continue;
        }

        const firecrawlData = await firecrawlResponse.json();
        
        // Process the response
        let extractedData = firecrawlData.data;
        
        // If we have extraction schema results, use those
        if (firecrawlData.data?.extract) {
          extractedData = firecrawlData.data.extract;
        }
        
        // Count items for summary
        if (extractedData) {
          if (Array.isArray(extractedData)) {
            totalItemsExtracted += extractedData.length;
          } else if (typeof extractedData === 'object') {
            // Count properties or nested arrays
            Object.values(extractedData).forEach(value => {
              if (Array.isArray(value)) {
                totalItemsExtracted += value.length;
              } else {
                totalItemsExtracted += 1;
              }
            });
          } else {
            totalItemsExtracted += 1;
          }
        }

        results.push({
          url: url,
          data: {
            ...firecrawlData.data,
            metadata: {
              title: firecrawlData.data?.metadata?.title,
              description: firecrawlData.data?.metadata?.description,
              sourceURL: url,
              scrapedAt: new Date().toISOString(),
              userQuery: userQuery
            }
          },
          success: true
        });

      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
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
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});