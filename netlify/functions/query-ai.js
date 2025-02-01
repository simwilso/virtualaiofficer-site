// netlify/functions/query-ai.js

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

function sanitizeReply(fullText) {
  // Remove prompt lines:
  const forbiddenPhrases = [
    "Below is relevant info about",
    "User question:",
    "Answer concisely:"
  ];
  let sanitized = fullText;
  forbiddenPhrases.forEach(phrase => {
    const regex = new RegExp(`^.*${phrase}.*$`, 'mg');
    sanitized = sanitized.replace(regex, '');
  });
  // Also remove everything before "Answer concisely:" 
  sanitized = sanitized.replace(/[\s\S]*Answer concisely:\s*/i, '');
  return sanitized.trim();
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: "Use POST." }) };
  }

  try {
    const { user_query } = JSON.parse(event.body || '{}');
    if (!user_query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing 'user_query'." }),
      };
    }

    const HF_API_KEY = process.env.HF_API_KEY;
    if (!HF_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "HF_API_KEY not set in Netlify." }),
      };
    }

    // Build a minimal prompt
    // (You could do chunk retrieval first if you want to pass only relevant KB paragraphs)
    const prompt = `
Below is relevant info about VirtualAIOfficer.com.au. Summarize if used; do not copy large sections.

User question: ${user_query}

Answer concisely:
`;

    const modelURL = "https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct";
    const hfRes = await fetch(modelURL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 80,
          temperature: 0.1,
          top_p: 0.7,
          repetition_penalty: 2.5
          // optionally try: stop: ["User question:", "Below is relevant info", "Answer concisely:"]
        }
      })
    });

    if (!hfRes.ok) {
      const err = await hfRes.text();
      return {
        statusCode: hfRes.status,
        body: JSON.stringify({ error: "Hugging Face error: " + err }),
      };
    }

    const result = await hfRes.json();
    let aiReply = "No response found.";
    if (Array.isArray(result) && result[0]?.generated_text) {
      aiReply = result[0].generated_text;
    } else if (result.generated_text) {
      aiReply = result.generated_text;
    }

    // Remove leftover prompt text
    aiReply = sanitizeReply(aiReply);

    return {
      statusCode: 200,
      body: JSON.stringify({ aiReply })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
