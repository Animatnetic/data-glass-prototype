const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ConvertQueryRequest {
  userQuery: string;
  urls: string[];
}

interface ConvertQueryResponse {
  firecrawlConfig: any;
  extractionSchema: any;
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
    console.log("Received request:", requestBody);

    const { userQuery, urls }: ConvertQueryRequest = requestBody;

    if (!userQuery || !urls || urls.length === 0) {
      console.error("Missing required fields:", { userQuery, urls });
      return new Response(
        JSON.stringify({ 
          error: "Missing userQuery or urls",
          debug: { userQuery: !!userQuery, urls: urls?.length || 0 }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!openaiApiKey) {
      console.error("OpenAI API key not found in environment");
      return new Response(
        JSON.stringify({ 
          error: "OpenAI API key not found"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!firecrawlApiKey) {
      console.error("Firecrawl API key not found in environment");
      return new Response(
        JSON.stringify({ 
          error: "Firecrawl API key not found"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 1: Get webpage content for context analysis
    console.log("=== STEP 1: ANALYZING WEBPAGE CONTENT ===");
    let webpageContent = "";
    const sampleUrl = urls[0]; // Use first URL for context analysis

    try {
      console.log(`Fetching content from: ${sampleUrl}`);
      const contentResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: sampleUrl,
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: 2000
        }),
      });

      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        webpageContent = contentData.data?.markdown || "";
        
        // Limit content length for ChatGPT analysis (keep first 3000 chars)
        if (webpageContent.length > 3000) {
          webpageContent = webpageContent.substring(0, 3000) + "...";
        }
        
        console.log("Successfully fetched webpage content:", webpageContent.length, "characters");
        console.log("Content preview:", webpageContent.substring(0, 500));
      } else {
        console.log("Failed to fetch webpage content, proceeding without context");
        webpageContent = "";
      }
    } catch (error) {
      console.log("Error fetching webpage content:", error.message);
      webpageContent = "";
    }

    // Step 2: Analyze content and create extraction configuration
    console.log("=== STEP 2: CREATING EXTRACTION CONFIGURATION ===");

    const systemPrompt = `You are an expert web scraping assistant that analyzes webpage content and creates precise Firecrawl API configurations.

CRITICAL FIRECRAWL API v1 REQUIREMENTS:
1. When using "extract" format, you MUST provide an "extract" object with a "schema" property
2. The schema must be a valid JSON schema object
3. Available formats: ["markdown", "html", "rawHtml", "extract", "screenshot"]
4. If using "extract" format, do NOT include other formats in the array
5. If NOT using extract, use ["markdown"] format

ANALYSIS PROCESS:
1. Analyze the provided webpage content to understand the structure and data types
2. Map the user's natural language query to specific elements found in the content
3. Create a precise extraction schema that targets exactly what the user wants

EXTRACTION STRATEGIES:

For SPECIFIC DATA TYPES (emails, phone numbers, prices, etc.):
- Use "extract" format with targeted schema
- Create properties that match the specific data pattern
- Be very precise about what constitutes the target data

For GENERAL CONTENT (headlines, paragraphs, links):
- Use "extract" format with structured schema
- Create clear property names that describe the content type
- Include relevant metadata like URLs, titles, descriptions

EXAMPLE CONFIGURATIONS:

For "extract email addresses":
{
  "firecrawlConfig": {
    "formats": ["extract"],
    "onlyMainContent": true,
    "extract": {
      "schema": {
        "type": "object",
        "properties": {
          "emails": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "email": {"type": "string", "pattern": "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$"},
                "context": {"type": "string", "description": "Surrounding text context"}
              }
            }
          }
        }
      }
    }
  },
  "extractionSchema": {
    "type": "object",
    "properties": {
      "emails": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "email": {"type": "string"},
            "context": {"type": "string"}
          }
        }
      }
    }
  }
}

For "headlines and titles":
{
  "firecrawlConfig": {
    "formats": ["extract"],
    "onlyMainContent": true,
    "extract": {
      "schema": {
        "type": "object",
        "properties": {
          "headlines": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "title": {"type": "string"},
                "level": {"type": "string", "description": "h1, h2, h3, etc."},
                "url": {"type": "string"}
              }
            }
          }
        }
      }
    }
  },
  "extractionSchema": {
    "type": "object",
    "properties": {
      "headlines": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "title": {"type": "string"},
            "level": {"type": "string"},
            "url": {"type": "string"}
          }
        }
      }
    }
  }
}

RESPONSE FORMAT: Return ONLY valid JSON, no explanations or markdown.`;

    const userPrompt = `WEBPAGE CONTENT ANALYSIS:
${webpageContent ? `Here is the content from the target webpage (${sampleUrl}):\n\n${webpageContent}\n\n` : "No webpage content available for analysis.\n\n"}

USER EXTRACTION REQUEST: "${userQuery}"

TARGET URLS: ${urls.join(", ")}

TASK:
1. Analyze the webpage content above to understand what data is available
2. Map the user's request "${userQuery}" to specific elements in the content
3. Create a precise Firecrawl extraction configuration that will extract ONLY the requested data type
4. Be very specific - if they want "email addresses", extract only email addresses, not other contact info
5. If they want "headlines", extract only headline/title elements, not body text
6. Use the webpage content to understand the actual structure and create targeted selectors

Return ONLY the JSON configuration, no explanations.`;

    console.log("Making OpenAI API request for extraction configuration...");

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
        max_tokens: 2500
      }),
    });

    console.log("OpenAI response status:", chatGPTResponse.status);

    if (!chatGPTResponse.ok) {
      const errorText = await chatGPTResponse.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ 
          error: `OpenAI API error: ${chatGPTResponse.status} - ${errorText}`
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const chatGPTData = await chatGPTResponse.json();
    console.log("OpenAI response:", chatGPTData);

    const assistantMessage = chatGPTData.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      console.error("No response from ChatGPT:", chatGPTData);
      return new Response(
        JSON.stringify({ 
          error: "No response from ChatGPT"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("=== CHATGPT RESPONSE DEBUG ===");
    console.log("Raw ChatGPT response:", assistantMessage);
    console.log("Response length:", assistantMessage.length);
    console.log("=== END CHATGPT DEBUG ===");

    // Parse the JSON response from ChatGPT
    let parsedConfig;
    try {
      // Clean the response - remove any markdown formatting
      let cleanedResponse = assistantMessage.trim();
      
      // Remove markdown code blocks if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log("Cleaned response for parsing:", cleanedResponse);
      
      parsedConfig = JSON.parse(cleanedResponse);
      console.log("Successfully parsed ChatGPT response:", JSON.stringify(parsedConfig, null, 2));
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw response that failed to parse:", assistantMessage);
      
      // Try to extract JSON from the response using regex
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedConfig = JSON.parse(jsonMatch[0]);
          console.log("Regex extraction successful:", parsedConfig);
        } catch (secondParseError) {
          console.error("Second parse attempt failed:", secondParseError);
          return new Response(
            JSON.stringify({ 
              error: "Could not parse ChatGPT response as JSON",
              debug: { 
                rawResponse: assistantMessage,
                parseError: parseError.message
              }
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ 
            error: "No valid JSON found in ChatGPT response",
            debug: { 
              rawResponse: assistantMessage,
              parseError: parseError.message
            }
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Validate and fix the configuration
    if (!parsedConfig || typeof parsedConfig !== 'object') {
      console.error("Invalid configuration from ChatGPT:", parsedConfig);
      return new Response(
        JSON.stringify({ 
          error: "Invalid configuration format from ChatGPT",
          debug: { parsedConfig }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Ensure proper Firecrawl configuration structure
    let firecrawlConfig = parsedConfig.firecrawlConfig || {};
    let extractionSchema = parsedConfig.extractionSchema;

    // Validate formats and extract configuration
    if (firecrawlConfig.formats && firecrawlConfig.formats.includes("extract")) {
      // If using extract format, ensure extract object exists
      if (!firecrawlConfig.extract || !firecrawlConfig.extract.schema) {
        console.log("Extract format specified but no extract.schema found, adding default");
        firecrawlConfig.extract = {
          schema: extractionSchema || {
            type: "object",
            properties: {
              content: { type: "string" }
            }
          }
        };
      }
      
      // Remove other formats when using extract
      firecrawlConfig.formats = ["extract"];
    } else {
      // If not using extract, ensure we have basic formats
      if (!firecrawlConfig.formats || firecrawlConfig.formats.length === 0) {
        firecrawlConfig.formats = ["markdown"];
      }
      
      // Remove extract object if not using extract format
      if (firecrawlConfig.extract) {
        delete firecrawlConfig.extract;
      }
    }

    // Set defaults
    if (firecrawlConfig.onlyMainContent === undefined) {
      firecrawlConfig.onlyMainContent = true;
    }

    console.log("Final validated firecrawlConfig:", JSON.stringify(firecrawlConfig, null, 2));
    console.log("Final extractionSchema:", JSON.stringify(extractionSchema, null, 2));

    const response: ConvertQueryResponse = {
      firecrawlConfig: firecrawlConfig,
      extractionSchema: extractionSchema,
      debug: {
        webpageContentLength: webpageContent.length,
        hasWebpageContent: webpageContent.length > 0,
        sampleUrl: sampleUrl
      }
    };

    console.log("Returning response:", JSON.stringify(response, null, 2));

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in convert-query function:", error);
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