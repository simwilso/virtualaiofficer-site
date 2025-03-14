// netlify/functions/query-ai.js

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

function keepLastParagraph(fullText) {
  // Split on blank lines, keep only last chunk
  const paragraphs = fullText
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return fullText.trim();
  }
  return paragraphs[paragraphs.length - 1];
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: "Use POST." }) };
  }

  try {
    const { user_query } = JSON.parse(event.body || '{}');
    if (!user_query) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'user_query'." }) };
    }

    const HF_API_KEY = process.env.HF_API_KEY;
    if (!HF_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "HF_API_KEY not set in Netlify." }),
      };
    }

    // Minimal prompt or chunk retrieval logic here:
    const prompt = `
Below is relevant info about VirtualAIOfficer.com.au. Summarize if used; do not copy large sections.

User question: ${user_query}

Answer concisely:
`;

    // Hugging Face call
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
        }
      })
    });

    if (!hfRes.ok) {
      const err = await hfRes.text();
      return { statusCode: hfRes.status, body: JSON.stringify({ error: "Hugging Face error: " + err }) };
    }

    const result = await hfRes.json();
    let aiReply = "No response found.";
    if (Array.isArray(result) && result[0]?.generated_text) {
      aiReply = result[0].generated_text;
    } else if (result.generated_text) {
      aiReply = result.generated_text;
    }

    // Keep only the last paragraph
    aiReply = keepLastParagraph(aiReply);

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
