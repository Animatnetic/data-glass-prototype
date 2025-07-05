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
          error: "OpenAI API key not configured. Please add OPENAI_API_KEY to your Supabase edge function secrets.",
          debug: { hasApiKey: false }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = `You are a web scraping expert that converts natural language queries into Firecrawl API configurations.

Firecrawl Documentation Summary:
- Use /scrape endpoint for single URLs
- Extract options: "markdown", "html", "rawHtml", "screenshot"
- Schema extraction using JSON schema for structured data
- Selectors can target specific elements
- Rate limiting and concurrent requests supported

Your task:
1. Analyze the user's natural language query
2. Determine the best Firecrawl configuration
3. Create a JSON schema for data extraction if structured data is requested
4. Return ONLY a valid JSON object (no markdown, no explanations)

Response format (return ONLY this JSON, nothing else):
{
  "firecrawlConfig": {
    "formats": ["markdown"],
    "onlyMainContent": true,
    "includeTags": ["h1", "h2", "h3", "p", "a"],
    "excludeTags": ["script", "style", "nav", "footer"]
  },
  "extractionSchema": {
    "type": "object",
    "properties": {
      "items": {
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

Focus on:
- Extracting the specific data the user wants
- Using appropriate selectors and formats
- Creating structured schemas for complex data
- Optimizing for the content type (news, products, contacts, etc.)
- RETURN ONLY VALID JSON, NO MARKDOWN OR EXPLANATIONS`;

    const userPrompt = `Convert this natural language query into Firecrawl configuration:

Query: "${userQuery}"
Target URLs: ${urls.join(", ")}

Return only the JSON configuration, no explanations or markdown formatting.`;

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
        max_tokens: 1500
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

    console.log("ChatGPT response content:", assistantMessage);

    // Log the raw response for debugging
    console.log("=== CHATGPT DEBUG INFO ===");
    console.log("Raw response length:", assistantMessage.length);
    console.log("Raw response (first 500 chars):", assistantMessage.substring(0, 500));
    console.log("Raw response (full):", assistantMessage);
    console.log("Response starts with:", assistantMessage.substring(0, 20));
    console.log("Response ends with:", assistantMessage.substring(assistantMessage.length - 20));
    console.log("Contains 'firecrawlConfig':", assistantMessage.includes('firecrawlConfig'));
    console.log("Contains 'extractionSchema':", assistantMessage.includes('extractionSchema'));
    console.log("=== END DEBUG INFO ===");

    // Parse the JSON response from ChatGPT
    let parsedConfig;
    try {
      // Clean the response - remove any markdown formatting
      let cleanedResponse = assistantMessage.trim();
      console.log("Cleaned response (before markdown removal):", cleanedResponse);
      
      // Remove markdown code blocks if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        console.log("Removed ```json markdown blocks");
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        console.log("Removed ``` markdown blocks");
      }
      
      console.log("Final cleaned response:", cleanedResponse);
      console.log("Attempting to parse JSON...");
      
      parsedConfig = JSON.parse(cleanedResponse);
      console.log("JSON parsing successful!");
      console.log("Parsed config:", JSON.stringify(parsedConfig, null, 2));
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw response:", assistantMessage);
      console.error("Parse error details:", {
        message: parseError.message,
        name: parseError.name,
        stack: parseError.stack
      });
      
      // Try to extract JSON from the response using regex
      console.log("Attempting regex extraction...");
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      console.log("Regex match found:", !!jsonMatch);
      if (jsonMatch) {
        console.log("Extracted JSON:", jsonMatch[0]);
      }
      
      if (jsonMatch) {
        try {
          parsedConfig = JSON.parse(jsonMatch[0]);
          console.log("Regex extraction successful:", parsedConfig);
        } catch (secondParseError) {
          console.error("Second parse attempt failed:", secondParseError);
          console.error("Second parse error details:", {
            message: secondParseError.message,
            extractedText: jsonMatch[0]
          });
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

    // Validate the parsed configuration
    if (!parsedConfig || typeof parsedConfig !== 'object') {
      console.error("Configuration validation failed:", {
        parsedConfig,
        type: typeof parsedConfig,
        isNull: parsedConfig === null,
        isUndefined: parsedConfig === undefined
      });
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

    // Provide defaults if missing
    console.log("Applying defaults and creating final response...");
    console.log("Original firecrawlConfig:", parsedConfig.firecrawlConfig);
    console.log("Original extractionSchema:", parsedConfig.extractionSchema);
    
    const response: ConvertQueryResponse = {
      firecrawlConfig: parsedConfig.firecrawlConfig || {
        formats: ["markdown"],
        onlyMainContent: true
      },
      extractionSchema: parsedConfig.extractionSchema || {
        type: "object",
        properties: {
          content: { type: "string" }
        }
      }
    };

    console.log("Final response object:", JSON.stringify(response, null, 2));
    console.log("Returning successful response:", response);

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