// netlify/functions/query-ai.js

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// A quick helper to remove repeated system text from the final response
function sanitizeReply(text) {
  const forbiddenPhrases = [
    "You are a helpful AI", 
    "Relevant Knowledge Base Info:",
    "User's Question:",
    // etc. add more lines that you see repeated
  ];
  let sanitized = text;
  forbiddenPhrases.forEach(phrase => {
    // remove lines that contain these phrases
    const regex = new RegExp(`^.*${phrase}.*$`, 'mg');
    sanitized = sanitized.replace(regex, '');
  });
  return sanitized.trim();
}

exports.handler = async function (event, context) {
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

    // 1) Fetch knowledge base
    const kbUrl = "https://raw.githubusercontent.com/YourUser/YourRepo/main/knowledge_base.md";
    let knowledgeBaseText = "";
    try {
      const kbRes = await fetch(kbUrl);
      if (kbRes.ok) {
        knowledgeBaseText = await kbRes.text();
      }
    } catch (err) {
      console.warn("KB fetch failed:", err);
    }

    // 2) Split + naive retrieval
    const paragraphs = knowledgeBaseText
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean);

    function getOverlapScore(a, b) {
      const setA = new Set(a.toLowerCase().split(/\W+/));
      const setB = new Set(b.toLowerCase().split(/\W+/));
      let score = 0;
      for (const w of setA) if (setB.has(w)) score++;
      return score;
    }

    const scored = paragraphs.map(text => ({
      text,
      score: getOverlapScore(text, user_query)
    }));
    scored.sort((x, y) => y.score - x.score);

    const topChunks = scored.slice(0, 2).map(obj => obj.text).join("\n\n");

    // 3) Minimal prompt
    //    Note: we only add the top chunk plus user query
    const prompt = `
Below is relevant info about VirtualAIOfficer.com.au. Summarize if used; do not copy large sections.

${topChunks}

User question: ${user_query}

Answer concisely:
`;

    // 4) Call Falcon with lower max tokens, high repetition penalty, zero temperature
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
      const errText = await hfRes.text();
      console.error("HF API error:", errText);
      return {
        statusCode: hfRes.status,
        body: JSON.stringify({ error: `Hugging Face error: ${errText}` }),
      };
    }

    const hfData = await hfRes.json();
    let aiReply = "No response found.";
    if (Array.isArray(hfData) && hfData[0]?.generated_text) {
      aiReply = hfData[0].generated_text;
    } else if (hfData.generated_text) {
      aiReply = hfData.generated_text;
    }

    // 5) Post-process to remove system lines or repeated text
    aiReply = sanitizeReply(aiReply);

    return {
      statusCode: 200,
      body: JSON.stringify({ aiReply })
    };

  } catch (err) {
    console.error("Error in function:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
