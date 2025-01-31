// netlify/functions/query-ai.js

// For Netlify compatibility:
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async function (event, context) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed. Use POST." }),
    };
  }

  try {
    // 1) Parse user query
    const { user_query } = JSON.parse(event.body || '{}');
    if (!user_query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing 'user_query' in request body." }),
      };
    }

    // 2) Read HF API key from Netlify environment
    const HF_API_KEY = process.env.HF_API_KEY;
    if (!HF_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Server config error: HF_API_KEY not set." }),
      };
    }

    // 3) Load your knowledge base from GitHub (raw URL)
    const kbUrl = "https://raw.githubusercontent.com/simwilso/virtualaiofficer-site/main/knowledge_base.md";
    let knowledgeBaseText = "";
    try {
      const kbResponse = await fetch(kbUrl);
      if (kbResponse.ok) {
        knowledgeBaseText = await kbResponse.text();
      } else {
        console.warn("Warning: Could not load knowledge base. Response:", kbResponse.status, kbResponse.statusText);
      }
    } catch (e) {
      console.warn("Warning: Knowledge base fetch failed:", e);
    }

    // 4) Construct a combined prompt with instructions + knowledge base + user query
    //    Keep instructions short, but be clear about your style constraints.
    const prompt = `
You are a helpful AI for the VirtualAIOfficer.com.au business. 
Answer succinctly and focus on the business/team offerings. Avoid repeating text verbatim from the knowledge base. 
If the question is irrelevant, politely say it's outside your current scope.

Knowledge Base:
${knowledgeBaseText}

User's Question:
${user_query}

Answer (be concise and avoid repeating yourself):
`;

    // 5) Call Hugging Face Inference API
    //    We'll reduce temperature, add repetition_penalty, and reduce max_new_tokens
    const modelURL = "https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct";
    const hfResponse = await fetch(modelURL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          // Fewer tokens => more succinct replies
          max_new_tokens: 150,          
          // Lower temperature => less "creative" / less wandering
          temperature: 0.1,             
          // Keep top_p moderate; can tweak if you want less variety
          top_p: 0.7,
          // Increase repetition_penalty => discourage repeating content
          repetition_penalty: 2.0       
        }
      })
    });

    if (!hfResponse.ok) {
      const errText = await hfResponse.text();
      console.error("Hugging Face API error:", errText);
      return {
        statusCode: hfResponse.status,
        body: JSON.stringify({ error: `Hugging Face API error: ${errText}` }),
      };
    }

    // 6) Parse the AI response
    const hfData = await hfResponse.json();
    let aiReply = "No response found.";
    if (Array.isArray(hfData) && hfData[0]?.generated_text) {
      aiReply = hfData[0].generated_text;
    } else if (hfData.generated_text) {
      aiReply = hfData.generated_text;
    }

    // Return final text
    return {
      statusCode: 200,
      body: JSON.stringify({ aiReply })
    };

  } catch (error) {
    console.error("Error in serverless function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

