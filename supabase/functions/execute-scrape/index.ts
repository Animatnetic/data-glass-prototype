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
  debug?: any;
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
    console.log("=== EXECUTE SCRAPE DEBUG START ===");
    console.log("Received request:", JSON.stringify(requestBody, null, 2));

    const { urls, firecrawlConfig, extractionSchema, userQuery }: ExecuteScrapeRequest = requestBody;

    if (!urls || urls.length === 0) {
      console.error("No URLs provided");
      return new Response(
        JSON.stringify({ 
          error: "No URLs provided",
          debug: { urls: urls?.length || 0 }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    console.log("Firecrawl API key check:", {
      hasKey: !!firecrawlApiKey,
      keyPrefix: firecrawlApiKey?.substring(0, 10) + "..." || "NOT_FOUND",
      envVars: Object.keys(Deno.env.toObject())
    });

    if (!firecrawlApiKey) {
      console.error("Firecrawl API key not found in environment");
      return new Response(
        JSON.stringify({ 
          error: "Firecrawl API key not configured. Please add FIRECRAWL_API_KEY to your environment variables.",
          debug: { 
            availableEnvVars: Object.keys(Deno.env.toObject()),
            hasFirecrawlKey: !!firecrawlApiKey
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results: ScrapeResult[] = [];
    let totalItemsExtracted = 0;

    console.log("Processing URLs:", urls);
    console.log("Firecrawl config:", JSON.stringify(firecrawlConfig, null, 2));
    console.log("Extraction schema:", JSON.stringify(extractionSchema, null, 2));

    // Process each URL
    for (const url of urls) {
      console.log(`\n--- Processing URL: ${url} ---`);
      
      try {
        // Prepare Firecrawl request with enhanced configuration
        const firecrawlPayload: any = {
          url: url,
          formats: firecrawlConfig.formats || ["markdown", "html"],
          onlyMainContent: firecrawlConfig.onlyMainContent !== false,
          waitFor: 3000, // Wait 3 seconds for dynamic content
        };

        // Add optional configuration
        if (firecrawlConfig.includeTags && firecrawlConfig.includeTags.length > 0) {
          firecrawlPayload.includeTags = firecrawlConfig.includeTags;
          console.log("Including tags:", firecrawlConfig.includeTags);
        }
        
        if (firecrawlConfig.excludeTags && firecrawlConfig.excludeTags.length > 0) {
          firecrawlPayload.excludeTags = firecrawlConfig.excludeTags;
          console.log("Excluding tags:", firecrawlConfig.excludeTags);
        }

        // Add extraction schema if provided
        if (extractionSchema && Object.keys(extractionSchema).length > 0) {
          firecrawlPayload.extract = {
            schema: extractionSchema
          };
          console.log("Using extraction schema:", JSON.stringify(extractionSchema, null, 2));
        }

        console.log("Final Firecrawl payload:", JSON.stringify(firecrawlPayload, null, 2));

        // Make request to Firecrawl
        console.log("Making request to Firecrawl API...");
        const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(firecrawlPayload),
        });

        console.log("Firecrawl response status:", firecrawlResponse.status);
        console.log("Firecrawl response headers:", Object.fromEntries(firecrawlResponse.headers.entries()));

        if (!firecrawlResponse.ok) {
          const errorText = await firecrawlResponse.text();
          console.error("Firecrawl API error:", {
            status: firecrawlResponse.status,
            statusText: firecrawlResponse.statusText,
            error: errorText
          });
          
          results.push({
            url: url,
            data: null,
            success: false,
            error: `Firecrawl API error (${firecrawlResponse.status}): ${errorText}`
          });
          continue;
        }

        const firecrawlData = await firecrawlResponse.json();
        console.log("Firecrawl response data:", JSON.stringify(firecrawlData, null, 2));
        
        // Process the response
        let extractedData = null;
        let processedData = [];
        
        // Check if we have extraction schema results
        if (firecrawlData.data?.extract) {
          console.log("Found extracted data:", JSON.stringify(firecrawlData.data.extract, null, 2));
          extractedData = firecrawlData.data.extract;
          
          // Process extracted data
          if (Array.isArray(extractedData)) {
            processedData = extractedData;
            totalItemsExtracted += extractedData.length;
          } else if (typeof extractedData === 'object') {
            // Flatten object properties that are arrays
            Object.entries(extractedData).forEach(([key, value]) => {
              if (Array.isArray(value)) {
                processedData.push(...value.map(item => ({ ...item, _source: key })));
                totalItemsExtracted += value.length;
              } else if (value && typeof value === 'object') {
                processedData.push({ ...value, _source: key });
                totalItemsExtracted += 1;
              } else {
                processedData.push({ [key]: value, _source: 'extracted' });
                totalItemsExtracted += 1;
              }
            });
          } else {
            processedData = [{ content: extractedData, _source: 'extracted' }];
            totalItemsExtracted += 1;
          }
        } 
        // Fallback to markdown/html content if no extraction
        else if (firecrawlData.data?.markdown || firecrawlData.data?.html) {
          console.log("No extracted data, using raw content");
          const content = firecrawlData.data.markdown || firecrawlData.data.html;
          
          // Try to extract meaningful data from markdown/html
          if (firecrawlData.data.markdown) {
            // Simple markdown parsing for common elements
            const lines = content.split('\n').filter(line => line.trim());
            const extractedItems = [];
            
            for (const line of lines) {
              if (line.startsWith('#')) {
                extractedItems.push({
                  type: 'heading',
                  content: line.replace(/^#+\s*/, ''),
                  level: (line.match(/^#+/) || [''])[0].length,
                  url: url
                });
              } else if (line.includes('http')) {
                const urlMatch = line.match(/https?:\/\/[^\s)]+/g);
                if (urlMatch) {
                  extractedItems.push({
                    type: 'link',
                    content: line,
                    urls: urlMatch,
                    source_url: url
                  });
                }
              } else if (line.trim().length > 20) {
                extractedItems.push({
                  type: 'text',
                  content: line.trim(),
                  source_url: url
                });
              }
            }
            
            processedData = extractedItems;
            totalItemsExtracted += extractedItems.length;
          } else {
            // Fallback for HTML content
            processedData = [{
              content: content,
              url: url,
              title: firecrawlData.data.metadata?.title,
              description: firecrawlData.data.metadata?.description,
              type: 'raw_content'
            }];
            totalItemsExtracted += 1;
          }
        } else {
          console.log("No usable data found in response");
          processedData = [];
        }

        console.log("Processed data:", JSON.stringify(processedData, null, 2));
        console.log("Items extracted from this URL:", processedData.length);

        results.push({
          url: url,
          data: {
            extract: processedData,
            metadata: {
              title: firecrawlData.data?.metadata?.title,
              description: firecrawlData.data?.metadata?.description,
              sourceURL: url,
              scrapedAt: new Date().toISOString(),
              userQuery: userQuery,
              itemCount: processedData.length
            },
            raw: {
              markdown: firecrawlData.data?.markdown,
              html: firecrawlData.data?.html
            }
          },
          success: true
        });

      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        
        results.push({
          url: url,
          data: null,
          success: false,
          error: `Scraping error: ${error.message}`
        });
      }
    }

    const successfulScrapes = results.filter(r => r.success).length;
    const failedScrapes = results.filter(r => !r.success).length;

    console.log("=== SCRAPING SUMMARY ===");
    console.log("Total URLs processed:", urls.length);
    console.log("Successful scrapes:", successfulScrapes);
    console.log("Failed scrapes:", failedScrapes);
    console.log("Total items extracted:", totalItemsExtracted);
    console.log("Results:", JSON.stringify(results, null, 2));
    console.log("=== EXECUTE SCRAPE DEBUG END ===");

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
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        debug: { 
          message: error.message,
          stack: error.stack
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});