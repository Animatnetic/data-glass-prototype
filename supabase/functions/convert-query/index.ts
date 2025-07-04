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
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { userQuery, urls }: ConvertQueryRequest = await req.json();

    if (!userQuery || !urls || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing userQuery or urls" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = `You are a web scraping expert that converts natural language queries into Firecrawl API configurations.

Firecrawl Documentation Summary:
- Use /scrape endpoint for single URLs
- Use /crawl endpoint for multiple URLs or site crawling
- Extract options: "markdown", "html", "rawHtml", "screenshot"
- Schema extraction using JSON schema for structured data
- Selectors can target specific elements
- Rate limiting and concurrent requests supported

Your task:
1. Analyze the user's natural language query
2. Determine the best Firecrawl configuration
3. Create a JSON schema for data extraction if structured data is requested
4. Return a JSON object with firecrawlConfig and extractionSchema

Example response format:
{
  "firecrawlConfig": {
    "formats": ["markdown", "html"],
    "onlyMainContent": true,
    "includeTags": ["h1", "h2", "h3", "p", "a"],
    "excludeTags": ["script", "style", "nav", "footer"]
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
            "url": {"type": "string"},
            "category": {"type": "string"}
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
- Optimizing for the content type (news, products, contacts, etc.)`;

    const chatGPTResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Convert this natural language query into Firecrawl configuration:

Query: "${userQuery}"
Target URLs: ${urls.join(", ")}

Please provide the optimal Firecrawl configuration and extraction schema for this request.`
          }
        ],
        temperature: 0.1,
        max_tokens: 1500
      }),
    });

    if (!chatGPTResponse.ok) {
      const errorText = await chatGPTResponse.text();
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${errorText}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const chatGPTData = await chatGPTResponse.json();
    const assistantMessage = chatGPTData.choices[0]?.message?.content;

    if (!assistantMessage) {
      return new Response(
        JSON.stringify({ error: "No response from ChatGPT" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse the JSON response from ChatGPT
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(assistantMessage);
    } catch (parseError) {
      // If direct parsing fails, try to extract JSON from the response
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedConfig = JSON.parse(jsonMatch[0]);
      } else {
        return new Response(
          JSON.stringify({ error: "Could not parse ChatGPT response as JSON" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const response: ConvertQueryResponse = {
      firecrawlConfig: parsedConfig.firecrawlConfig || {},
      extractionSchema: parsedConfig.extractionSchema || {}
    };

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
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});