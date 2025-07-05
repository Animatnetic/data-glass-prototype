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

// Helper function to extract specific data types from text
const extractSpecificData = (text: string, dataType: string): any[] => {
  const results = [];
  
  switch (dataType.toLowerCase()) {
    case 'email':
    case 'emails':
    case 'email addresses':
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      const emails = text.match(emailRegex) || [];
      emails.forEach((email, index) => {
        // Get context around the email
        const emailIndex = text.indexOf(email);
        const contextStart = Math.max(0, emailIndex - 50);
        const contextEnd = Math.min(text.length, emailIndex + email.length + 50);
        const context = text.substring(contextStart, contextEnd).trim();
        
        results.push({
          email: email,
          context: context,
          _index: index,
          _type: 'email'
        });
      });
      break;
      
    case 'phone':
    case 'phones':
    case 'phone numbers':
      const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
      const phones = text.match(phoneRegex) || [];
      phones.forEach((phone, index) => {
        const phoneIndex = text.indexOf(phone);
        const contextStart = Math.max(0, phoneIndex - 50);
        const contextEnd = Math.min(text.length, phoneIndex + phone.length + 50);
        const context = text.substring(contextStart, contextEnd).trim();
        
        results.push({
          phone: phone.trim(),
          context: context,
          _index: index,
          _type: 'phone'
        });
      });
      break;
      
    case 'price':
    case 'prices':
    case 'cost':
    case 'costs':
      const priceRegex = /\$[\d,]+\.?\d*|\$\d+|[\d,]+\.?\d*\s*(dollars?|USD|usd)/g;
      const prices = text.match(priceRegex) || [];
      prices.forEach((price, index) => {
        const priceIndex = text.indexOf(price);
        const contextStart = Math.max(0, priceIndex - 50);
        const contextEnd = Math.min(text.length, priceIndex + price.length + 50);
        const context = text.substring(contextStart, contextEnd).trim();
        
        results.push({
          price: price.trim(),
          context: context,
          _index: index,
          _type: 'price'
        });
      });
      break;
      
    case 'url':
    case 'urls':
    case 'links':
    case 'link':
      const urlRegex = /https?:\/\/[^\s)]+/g;
      const urls = text.match(urlRegex) || [];
      urls.forEach((url, index) => {
        const urlIndex = text.indexOf(url);
        const contextStart = Math.max(0, urlIndex - 50);
        const contextEnd = Math.min(text.length, urlIndex + url.length + 50);
        const context = text.substring(contextStart, contextEnd).trim();
        
        results.push({
          url: url.trim(),
          context: context,
          _index: index,
          _type: 'url'
        });
      });
      break;
      
    default:
      // For other data types, return empty array
      break;
  }
  
  return results;
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
      keyPrefix: firecrawlApiKey?.substring(0, 10) + "..." || "NOT_FOUND"
    });

    if (!firecrawlApiKey) {
      console.error("Firecrawl API key not found in environment");
      return new Response(
        JSON.stringify({ 
          error: "Firecrawl API key not configured. Please add FIRECRAWL_API_KEY to your environment variables."
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
    console.log("User query:", userQuery);

    // Process each URL
    for (const url of urls) {
      console.log(`\n--- Processing URL: ${url} ---`);
      
      try {
        // Prepare Firecrawl request according to v1 API specification
        const firecrawlPayload: any = {
          url: url,
          formats: firecrawlConfig.formats || ["markdown"],
          onlyMainContent: firecrawlConfig.onlyMainContent !== false,
          waitFor: 3000, // Wait 3 seconds for dynamic content
        };

        // Add extract configuration if using extract format
        if (firecrawlConfig.formats && firecrawlConfig.formats.includes("extract")) {
          if (firecrawlConfig.extract && firecrawlConfig.extract.schema) {
            firecrawlPayload.extract = firecrawlConfig.extract;
            console.log("Using extract configuration:", JSON.stringify(firecrawlPayload.extract, null, 2));
          } else {
            console.error("Extract format specified but no extract.schema provided");
            // Fallback to markdown if extract is malformed
            firecrawlPayload.formats = ["markdown"];
            delete firecrawlPayload.extract;
          }
        }

        // Add optional configuration for non-extract formats
        if (!firecrawlPayload.formats.includes("extract")) {
          if (firecrawlConfig.includeTags && firecrawlConfig.includeTags.length > 0) {
            firecrawlPayload.includeTags = firecrawlConfig.includeTags;
            console.log("Including tags:", firecrawlConfig.includeTags);
          }
          
          if (firecrawlConfig.excludeTags && firecrawlConfig.excludeTags.length > 0) {
            firecrawlPayload.excludeTags = firecrawlConfig.excludeTags;
            console.log("Excluding tags:", firecrawlConfig.excludeTags);
          }
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
        console.log("Firecrawl response data keys:", Object.keys(firecrawlData.data || {}));
        console.log("Firecrawl success:", firecrawlData.success);
        
        // Process the response based on format used
        let extractedData = null;
        let processedData = [];
        
        // Check if we have extraction schema results (extract format)
        if (firecrawlData.data?.extract) {
          console.log("Found extracted data:", JSON.stringify(firecrawlData.data.extract, null, 2));
          extractedData = firecrawlData.data.extract;
          
          // Process extracted data
          if (Array.isArray(extractedData)) {
            processedData = extractedData.map((item, index) => ({
              ...item,
              _index: index,
              _source: 'extracted',
              _url: url
            }));
            totalItemsExtracted += extractedData.length;
          } else if (typeof extractedData === 'object' && extractedData !== null) {
            // Flatten object properties that are arrays
            Object.entries(extractedData).forEach(([key, value]) => {
              if (Array.isArray(value)) {
                const items = value.map((item, index) => ({
                  ...item,
                  _index: index,
                  _source: key,
                  _url: url,
                  _category: key
                }));
                processedData.push(...items);
                totalItemsExtracted += value.length;
              } else if (value && typeof value === 'object') {
                processedData.push({ 
                  ...value, 
                  _source: key,
                  _url: url,
                  _category: key
                });
                totalItemsExtracted += 1;
              } else if (value !== null && value !== undefined) {
                processedData.push({ 
                  [key]: value, 
                  _source: 'extracted',
                  _url: url,
                  _category: key
                });
                totalItemsExtracted += 1;
              }
            });
          } else {
            processedData = [{ 
              content: extractedData, 
              _source: 'extracted',
              _url: url
            }];
            totalItemsExtracted += 1;
          }
        } 
        // Fallback to markdown/html content processing with specific data extraction
        else if (firecrawlData.data?.markdown || firecrawlData.data?.html) {
          console.log("No extracted data, processing raw content with specific data extraction");
          const content = firecrawlData.data.markdown || firecrawlData.data.html;
          
          // Try specific data extraction based on user query
          const specificData = extractSpecificData(content, userQuery);
          
          if (specificData.length > 0) {
            console.log(`Found ${specificData.length} specific data items for query: ${userQuery}`);
            processedData = specificData.map(item => ({
              ...item,
              _url: url,
              _source: 'specific_extraction'
            }));
            totalItemsExtracted += specificData.length;
          } else {
            // Enhanced general content processing for markdown
            if (firecrawlData.data.markdown) {
              const lines = content.split('\n').filter(line => line.trim());
              const extractedItems = [];
              
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Extract headings
                if (line.startsWith('#')) {
                  const level = (line.match(/^#+/) || [''])[0].length;
                  const title = line.replace(/^#+\s*/, '');
                  if (title.length > 0) {
                    extractedItems.push({
                      type: 'heading',
                      title: title,
                      level: level,
                      url: url,
                      _index: extractedItems.length,
                      _source: 'markdown_parsing'
                    });
                  }
                }
                // Extract markdown links
                else if (line.includes('[') && line.includes('](')) {
                  const linkMatches = line.match(/\[([^\]]*)\]\(([^)]+)\)/g);
                  if (linkMatches) {
                    linkMatches.forEach(match => {
                      const linkMatch = match.match(/\[([^\]]*)\]\(([^)]+)\)/);
                      if (linkMatch) {
                        extractedItems.push({
                          type: 'link',
                          title: linkMatch[1] || 'Link',
                          url: linkMatch[2],
                          source_url: url,
                          _index: extractedItems.length,
                          _source: 'markdown_parsing'
                        });
                      }
                    });
                  }
                }
                // Extract plain URLs
                else if (line.includes('http')) {
                  const plainUrls = line.match(/https?:\/\/[^\s)]+/g);
                  if (plainUrls) {
                    plainUrls.forEach(plainUrl => {
                      extractedItems.push({
                        type: 'url',
                        url: plainUrl.trim(),
                        context: line,
                        source_url: url,
                        _index: extractedItems.length,
                        _source: 'markdown_parsing'
                      });
                    });
                  }
                }
                // Extract meaningful text content
                else if (line.length > 20 && !line.startsWith('*') && !line.startsWith('-')) {
                  extractedItems.push({
                    type: 'text',
                    content: line,
                    source_url: url,
                    _index: extractedItems.length,
                    _source: 'markdown_parsing'
                  });
                }
              }
              
              processedData = extractedItems;
              totalItemsExtracted += extractedItems.length;
            } else {
              // Fallback for HTML content
              processedData = [{
                type: 'raw_content',
                content: content.substring(0, 1000), // Limit content length
                url: url,
                title: firecrawlData.data.metadata?.title,
                description: firecrawlData.data.metadata?.description,
                _index: 0,
                _source: 'html_fallback'
              }];
              totalItemsExtracted += 1;
            }
          }
        } else {
          console.log("No usable data found in Firecrawl response");
          processedData = [];
        }

        console.log("Processed data sample:", JSON.stringify(processedData.slice(0, 3), null, 2));
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
              itemCount: processedData.length,
              format: firecrawlPayload.formats[0],
              extractionMethod: processedData.length > 0 ? processedData[0]._source : 'none'
            },
            raw: {
              markdown: firecrawlData.data?.markdown?.substring(0, 2000), // Limit raw data size
              html: firecrawlData.data?.html?.substring(0, 2000)
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
    console.log("Results summary:", results.map(r => ({
      url: r.url,
      success: r.success,
      itemCount: r.success ? r.data?.extract?.length || 0 : 0,
      extractionMethod: r.success ? r.data?.metadata?.extractionMethod : 'failed',
      error: r.error
    })));
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