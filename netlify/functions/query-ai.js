// netlify/functions/query-ai.js

// Netlify often requires a dynamic import of node-fetch.
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async function (event, context) {
  // 1) Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed, use POST." }),
    };
  }

  try {
    // 2) Parse the input from the body
    const { user_query } = JSON.parse(event.body || '{}');
    if (!user_query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing 'user_query' in request body." }),
      };
    }

    // 3) Read HF API key from Netlify env vars (private)
    const HF_API_KEY = process.env.HF_API_KEY;
    if (!HF_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Server config error: HF_API_KEY not set." }),
      };
    }

    // 4) Call Hugging Face Inference API
    //    Adjust model & parameters as needed. This example uses Falcon 7B Instruct:
    const modelURL = "https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct";
    const hfResponse = await fetch(modelURL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: user_query,
        parameters: {
          max_new_tokens: 250,
          temperature: 0.2,
          top_p: 0.7,
          repetition_penalty: 1.5
        }
      })
    });

    if (!hfResponse.ok) {
      // Possibly show details in logs
      const errText = await hfResponse.text();
      console.error("Hugging Face API error:", errText);
      return {
        statusCode: hfResponse.status,
        body: JSON.stringify({ error: `Hugging Face API error: ${errText}` }),
      };
    }

    // 5) The HF Inference endpoint generally returns an array with { generated_text: ... }
    const hfData = await hfResponse.json();
    // Example shape: [{ "generated_text": "Hello world" }]

    let aiReply = "No response found.";
    if (Array.isArray(hfData) && hfData[0]?.generated_text) {
      aiReply = hfData[0].generated_text;
    } else if (hfData.generated_text) {
      // If the model returns a single object
      aiReply = hfData.generated_text;
    }

    // 6) Return the AI-generated text
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
