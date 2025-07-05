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
    if (!openaiApiKey) {
      console.error("OpenAI API key not found in environment");
      return new Response(
        JSON.stringify({ 
          error: "OpenAI API key not found",
          debug: { env: Deno.env.toObject() }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = `You are an expert web scraping assistant that converts natural language queries into Firecrawl API configurations. 

CRITICAL: You must follow the exact Firecrawl API v1 specification:

1. When using "extract" format, you MUST provide an "extract" object with a "schema" property
2. The schema must be a valid JSON schema object
3. Available formats: ["markdown", "html", "rawHtml", "extract", "screenshot"]
4. If using "extract" format, do NOT include "markdown" or "html" in formats array
5. If NOT using extract, use ["markdown"] or ["html"] formats

EXAMPLES OF CORRECT CONFIGURATIONS:

For structured data extraction (products, articles, etc.):
{
  "firecrawlConfig": {
    "formats": ["extract"],
    "onlyMainContent": true,
    "extract": {
      "schema": {
        "type": "object",
        "properties": {
          "articles": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "title": {"type": "string"},
                "url": {"type": "string"},
                "description": {"type": "string"}
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
      "articles": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "title": {"type": "string"},
            "url": {"type": "string"},
            "description": {"type": "string"}
          }
        }
      }
    }
  }
}

For simple content extraction:
{
  "firecrawlConfig": {
    "formats": ["markdown"],
    "onlyMainContent": true,
    "includeTags": ["h1", "h2", "h3", "p", "a"],
    "excludeTags": ["script", "style", "nav", "footer"]
  },
  "extractionSchema": null
}

MAPPING GUIDE:
- "headlines", "titles", "news" → extract h1, h2, h3 tags
- "links", "urls" → extract a tags with href
- "products", "items", "listings" → structured extraction with name, price, description
- "contact info", "emails", "phones" → extract contact-related text
- "images", "photos" → extract img tags with src and alt
- "prices", "costs" → extract price-related text and numbers
- "descriptions", "content", "text" → extract p, div text content

RESPONSE FORMAT (return ONLY valid JSON):`;

    const userPrompt = `Convert this natural language query into a Firecrawl configuration:

Query: "${userQuery}"
Target URLs: ${urls.join(", ")}

Analyze the query and determine:
1. What specific data elements are being requested
2. Whether structured extraction is needed (use "extract" format) or simple content (use "markdown" format)
3. Appropriate HTML selectors and schema properties

Return ONLY the JSON configuration, no explanations.`;

    console.log("Making OpenAI API request...");

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

    console.log("OpenAI response status:", chatGPTResponse.status);

    if (!chatGPTResponse.ok) {
      const errorText = await chatGPTResponse.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ 
          error: `OpenAI API error: ${chatGPTResponse.status} - ${errorText}`,
          debug: { 
            status: chatGPTResponse.status,
            hasApiKey: !!openaiApiKey,
            apiKeyPrefix: openaiApiKey?.substring(0, 10) + "..."
          }
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
          error: "No response from ChatGPT",
          debug: { 
            choices: chatGPTData.choices?.length || 0,
            usage: chatGPTData.usage
          }
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
                parseError: parseError.message,
                extractedJson: jsonMatch?.[0]
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
      extractionSchema: extractionSchema
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