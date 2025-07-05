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

// Helper function to detect if user wants specific data types
const detectSpecificDataRequest = (userQuery: string): string | null => {
  const query = userQuery.toLowerCase();
  
  // Email patterns
  if (query.includes('email') || query.includes('e-mail') || query.includes('contact')) {
    return 'emails';
  }
  
  // Phone patterns
  if (query.includes('phone') || query.includes('telephone') || query.includes('mobile') || query.includes('cell')) {
    return 'phone_numbers';
  }
  
  // Address patterns
  if (query.includes('address') || query.includes('location') || query.includes('street')) {
    return 'addresses';
  }
  
  // Price patterns
  if (query.includes('price') || query.includes('cost') || query.includes('fee') || query.includes('$')) {
    return 'prices';
  }
  
  // Name patterns
  if (query.includes('name') || query.includes('person') || query.includes('people')) {
    return 'names';
  }
  
  // Date patterns
  if (query.includes('date') || query.includes('time') || query.includes('when')) {
    return 'dates';
  }
  
  // URL/Link patterns
  if (query.includes('link') || query.includes('url') || query.includes('website')) {
    return 'links';
  }
  
  return null; // No specific data type detected
};

// Function to use ChatGPT for specific data extraction
const extractSpecificDataWithChatGPT = async (content: string, userQuery: string, dataType: string, openaiApiKey: string): Promise<any[]> => {
  console.log(`\n=== CHATGPT SPECIFIC DATA EXTRACTION ===`);
  console.log(`Data type: ${dataType}`);
  console.log(`User query: ${userQuery}`);
  console.log(`Content length: ${content.length} characters`);

  const systemPrompt = `You are a precise data extraction specialist. Your job is to analyze webpage content and extract ONLY the specific type of data requested by the user.

CRITICAL INSTRUCTIONS:
1. Extract ONLY the specific data type requested - nothing else
2. Return results as a JSON array of objects
3. Each object should have relevant properties for the data type
4. If no data of the requested type is found, return an empty array
5. Be extremely precise - don't include similar but different data types
6. Include context or source information when helpful

DATA TYPE EXTRACTION RULES:

For EMAILS:
- Extract only valid email addresses
- Format: [{"email": "example@domain.com", "context": "surrounding text"}]

For PHONE NUMBERS:
- Extract phone numbers in any format
- Format: [{"phone": "+1-555-123-4567", "formatted": "555-123-4567", "context": "surrounding text"}]

For ADDRESSES:
- Extract physical addresses
- Format: [{"address": "123 Main St, City, State", "type": "street_address", "context": "surrounding text"}]

For PRICES:
- Extract monetary amounts and prices
- Format: [{"price": "$99.99", "currency": "USD", "item": "product name", "context": "surrounding text"}]

For NAMES:
- Extract person names
- Format: [{"name": "John Doe", "type": "person", "context": "surrounding text"}]

For DATES:
- Extract dates and times
- Format: [{"date": "2024-01-15", "original": "January 15, 2024", "context": "surrounding text"}]

For LINKS:
- Extract URLs and links
- Format: [{"url": "https://example.com", "title": "link text", "context": "surrounding text"}]

RESPONSE FORMAT: Return ONLY a valid JSON array, no explanations or markdown.`;

  const userPrompt = `WEBPAGE CONTENT:
${content}

USER REQUEST: "${userQuery}"
EXTRACT ONLY: ${dataType}

Analyze the content above and extract ONLY ${dataType} as requested. Return a JSON array of objects with the extracted data.`;

  try {
    console.log("Making ChatGPT request for specific data extraction...");
    
    const chatGPTResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      }),
    });

    if (!chatGPTResponse.ok) {
      const errorText = await chatGPTResponse.text();
      console.error("ChatGPT API error:", errorText);
      return [];
    }

    const chatGPTData = await chatGPTResponse.json();
    const assistantMessage = chatGPTData.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      console.error("No response from ChatGPT");
      return [];
    }

    console.log("ChatGPT raw response:", assistantMessage);

    // Parse the JSON response
    let extractedData;
    try {
      // Clean the response
      let cleanedResponse = assistantMessage.trim();
      
      // Remove markdown code blocks if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      extractedData = JSON.parse(cleanedResponse);
      
      if (!Array.isArray(extractedData)) {
        console.error("ChatGPT response is not an array:", extractedData);
        return [];
      }
      
      console.log(`Successfully extracted ${extractedData.length} ${dataType} items`);
      return extractedData;
      
    } catch (parseError) {
      console.error("Failed to parse ChatGPT response:", parseError);
      console.error("Raw response:", assistantMessage);
      return [];
    }
    
  } catch (error) {
    console.error("Error in ChatGPT specific data extraction:", error);
    return [];
  }
};

// Helper function to extract specific data types from text using regex (fallback)
const extractSpecificDataRegex = (text: string, dataType: string): any[] => {
  const results = [];
  
  switch (dataType) {
    case 'emails':
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      const emails = text.match(emailRegex) || [];
      emails.forEach((email, index) => {
        const emailIndex = text.indexOf(email);
        const contextStart = Math.max(0, emailIndex - 50);
        const contextEnd = Math.min(text.length, emailIndex + email.length + 50);
        const context = text.substring(contextStart, contextEnd).trim();
        
        results.push({
          email: email,
          context: context,
          _index: index,
          _type: 'email',
          _extraction_method: 'regex'
        });
      });
      break;
      
    case 'phone_numbers':
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
          _type: 'phone',
          _extraction_method: 'regex'
        });
      });
      break;
      
    case 'prices':
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
          _type: 'price',
          _extraction_method: 'regex'
        });
      });
      break;
      
    case 'links':
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
          _type: 'url',
          _extraction_method: 'regex'
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
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    
    console.log("API keys check:", {
      hasFirecrawl: !!firecrawlApiKey,
      hasOpenAI: !!openaiApiKey,
      firecrawlPrefix: firecrawlApiKey?.substring(0, 10) + "..." || "NOT_FOUND"
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

    if (!openaiApiKey) {
      console.error("OpenAI API key not found in environment");
      return new Response(
        JSON.stringify({ 
          error: "OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Detect if user wants specific data extraction
    const specificDataType = detectSpecificDataRequest(userQuery);
    console.log("Specific data type detected:", specificDataType);

    const results: ScrapeResult[] = [];
    let totalItemsExtracted = 0;

    console.log("Processing URLs:", urls);
    console.log("Firecrawl config:", JSON.stringify(firecrawlConfig, null, 2));
    console.log("Extraction schema:", JSON.stringify(extractionSchema, null, 2));
    console.log("User query:", userQuery);

    // Process all URLs concurrently using Promise.all
    console.log(`\n=== STARTING CONCURRENT PROCESSING OF ${urls.length} URLs ===`);
    const startTime = Date.now();
    
    const urlProcessingPromises = urls.map(async (url, urlIndex) => {
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
          return {
            url: url,
            data: null,
            success: false,
            error: `Firecrawl API error (${firecrawlResponse.status}): ${errorText}`
          };
        }

        const firecrawlData = await firecrawlResponse.json();
        console.log("Firecrawl response data keys:", Object.keys(firecrawlData.data || {}));
        console.log("Firecrawl success:", firecrawlData.success);
        
        // Get the raw content for processing
        let rawContent = "";
        if (firecrawlData.data?.markdown) {
          rawContent = firecrawlData.data.markdown;
        } else if (firecrawlData.data?.html) {
          rawContent = firecrawlData.data.html;
        } else if (firecrawlData.data?.extract) {
          // If we have extracted data, convert it to text for further processing
          rawContent = JSON.stringify(firecrawlData.data.extract, null, 2);
        }

        console.log("Raw content length:", rawContent.length);

        let processedData = [];
        let extractionMethod = "general";

        // Step 1: Check if we have structured extraction results
        if (firecrawlData.data?.extract) {
          console.log("Found extracted data from Firecrawl:", JSON.stringify(firecrawlData.data.extract, null, 2));
          
          // If user wants specific data and we have content, use ChatGPT for precision
          if (specificDataType && rawContent.length > 0) {
            console.log("Using ChatGPT for specific data extraction...");
            const chatGPTResults = await extractSpecificDataWithChatGPT(rawContent, userQuery, specificDataType, openaiApiKey);
            
            if (chatGPTResults.length > 0) {
              processedData = chatGPTResults.map((item, index) => ({
                ...item,
                _index: index,
                _source: 'chatgpt_specific',
                _url: url,
                _extraction_method: 'chatgpt'
              }));
              extractionMethod = "chatgpt_specific";
              totalItemsExtracted += chatGPTResults.length;
            } else {
              // Fallback to regex extraction
              console.log("ChatGPT returned no results, trying regex fallback...");
              const regexResults = extractSpecificDataRegex(rawContent, specificDataType);
              processedData = regexResults.map((item, index) => ({
                ...item,
                _url: url
              }));
              extractionMethod = "regex_fallback";
              totalItemsExtracted += regexResults.length;
            }
          } else {
            // Process Firecrawl extracted data normally
            const extractedData = firecrawlData.data.extract;
            if (Array.isArray(extractedData)) {
              processedData = extractedData.map((item, index) => ({
                ...item,
                _index: index,
                _source: 'firecrawl_extract',
                _url: url
              }));
              totalItemsExtracted += extractedData.length;
            } else if (typeof extractedData === 'object' && extractedData !== null) {
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
                    _source: 'firecrawl_extract',
                    _url: url,
                    _category: key
                  });
                  totalItemsExtracted += 1;
                }
              });
            }
            extractionMethod = "firecrawl_extract";
          }
        } 
        // Step 2: Process markdown/html content
        else if (rawContent.length > 0) {
          console.log("Processing raw content...");
          
          // If user wants specific data, use ChatGPT for precision
          if (specificDataType) {
            console.log("Using ChatGPT for specific data extraction from raw content...");
            const chatGPTResults = await extractSpecificDataWithChatGPT(rawContent, userQuery, specificDataType, openaiApiKey);
            
            if (chatGPTResults.length > 0) {
              processedData = chatGPTResults.map((item, index) => ({
                ...item,
                _index: index,
                _source: 'chatgpt_specific',
                _url: url,
                _extraction_method: 'chatgpt'
              }));
              extractionMethod = "chatgpt_specific";
              totalItemsExtracted += chatGPTResults.length;
            } else {
              // Fallback to regex extraction
              console.log("ChatGPT returned no results, trying regex fallback...");
              const regexResults = extractSpecificDataRegex(rawContent, specificDataType);
              processedData = regexResults.map((item, index) => ({
                ...item,
                _url: url
              }));
              extractionMethod = "regex_fallback";
              totalItemsExtracted += regexResults.length;
            }
          } else {
            // General content processing for markdown
            if (firecrawlData.data.markdown) {
              const lines = rawContent.split('\n').filter(line => line.trim());
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
              extractionMethod = "markdown_parsing";
            } else {
              // Fallback for HTML content
              processedData = [{
                type: 'raw_content',
                content: rawContent.substring(0, 1000), // Limit content length
                url: url,
                title: firecrawlData.data.metadata?.title,
                description: firecrawlData.data.metadata?.description,
                _index: 0,
                _source: 'html_fallback'
              }];
              totalItemsExtracted += 1;
              extractionMethod = "html_fallback";
            }
          }
        } else {
          console.log("No usable data found in Firecrawl response");
          processedData = [];
        }

        console.log("Processed data sample:", JSON.stringify(processedData.slice(0, 3), null, 2));
        console.log("Items extracted from this URL:", processedData.length);
        console.log("Extraction method used:", extractionMethod);

        return {
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
              extractionMethod: extractionMethod,
              specificDataType: specificDataType,
              usedChatGPT: extractionMethod.includes('chatgpt')
            },
            raw: {
              markdown: firecrawlData.data?.markdown?.substring(0, 2000), // Limit raw data size
              html: firecrawlData.data?.html?.substring(0, 2000)
            }
          },
          success: true
        };

      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        
        return {
          url: url,
          data: null,
          success: false,
          error: `Scraping error: ${error.message}`
        };
      }
    });

    // Wait for all URL processing to complete
    console.log("Waiting for all URLs to complete processing...");
    const urlResults = await Promise.all(urlProcessingPromises);
    
    // Collect results and calculate totals
    results.push(...urlResults);
    totalItemsExtracted = urlResults.reduce((total, result) => {
      if (result.success && result.data?.extract) {
        return total + result.data.extract.length;
      }
      return total;
    }, 0);
    
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    console.log(`\n=== CONCURRENT PROCESSING COMPLETED ===`);
    console.log(`Total processing time: ${processingTime.toFixed(2)} seconds`);
    console.log(`Average time per URL: ${(processingTime / urls.length).toFixed(2)} seconds`);
    const successfulScrapes = results.filter(r => r.success).length;
    const failedScrapes = results.filter(r => !r.success).length;

    console.log("=== SCRAPING SUMMARY ===");
    console.log("Total URLs processed:", urls.length);
    console.log("Successful scrapes:", successfulScrapes);
    console.log("Failed scrapes:", failedScrapes);
    console.log("Total items extracted:", totalItemsExtracted);
    console.log("Specific data type requested:", specificDataType);
    console.log("Results summary:", results.map(r => ({
      url: r.url,
      success: r.success,
      itemCount: r.success ? r.data?.extract?.length || 0 : 0,
      extractionMethod: r.success ? r.data?.metadata?.extractionMethod : 'failed',
      usedChatGPT: r.success ? r.data?.metadata?.usedChatGPT : false,
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