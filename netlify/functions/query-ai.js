// netlify/functions/query-ai.js

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed. Use POST." }) };
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

    // 2) Hugging Face API key from Netlify env
    const HF_API_KEY = process.env.HF_API_KEY;
    if (!HF_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Server config error: HF_API_KEY not set." }),
      };
    }

    // 3) Load your knowledge base from GitHub
    const kbUrl = "https://raw.githubusercontent.com/simwilso/virtualaiofficer-site/main/knowledge_base.md";
    let knowledgeBaseText = "";
    try {
      const kbResponse = await fetch(kbUrl);
      if (kbResponse.ok) {
        knowledgeBaseText = await kbResponse.text();
      } else {
        console.warn("Warning: KB fetch failed:", kbResponse.status, kbResponse.statusText);
      }
    } catch (e) {
      console.warn("Warning: KB fetch error:", e);
    }

    // 4) Split the KB into paragraphs (or lines) for naive retrieval
    //    The delimiter "\n\n" is a guess. Adjust if your MD uses single line breaks.
    const paragraphs = knowledgeBaseText
      .split(/\n\s*\n/) // split by blank lines
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // 5) A super-naive "similarity" by counting word overlap
    function getOverlapScore(textA, textB) {
      const setA = new Set(textA.toLowerCase().split(/\W+/));
      const setB = new Set(textB.toLowerCase().split(/\W+/));
      let score = 0;
      for (let word of setA) {
        if (setB.has(word)) score++;
      }
      return score;
    }

    // 6) Rank each paragraph by overlap with user query
    const scoredParagraphs = paragraphs.map((p) => ({
      text: p,
      score: getOverlapScore(p, user_query),
    }));

    // 7) Sort descending by score
    scoredParagraphs.sort((a, b) => b.score - a.score);

    // 8) Take the top 1 or 2 paragraphs
    const topChunks = scoredParagraphs.slice(0, 2).map(obj => obj.text).join("\n\n");

    // 9) Build a short prompt with:
    //    - Our “system instruction” style text
    //    - The top chunk(s) of the KB
    //    - The user’s question
    const prompt = `
You are a helpful AI for VirtualAIOfficer.com.au. 
- Provide concise answers, relevant to the user’s question.
- Don't repeat large sections verbatim from the KB. Summarize when needed.
- If question is off-topic, say so politely.

Relevant Knowledge Base Info:
${topChunks}

User's Question:
${user_query}

Answer (brief, relevant, no large verbatim quotes):
`;

    // 10) Call Hugging Face Inference API with lower temperature, higher repetition penalty, shorter max tokens
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
          max_new_tokens: 150,
          temperature: 0.1,
          top_p: 0.7,
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

    const hfData = await hfResponse.json();
    let aiReply = "No response found.";
    if (Array.isArray(hfData) && hfData[0]?.generated_text) {
      aiReply = hfData[0].generated_text;
    } else if (hfData.generated_text) {
      aiReply = hfData.generated_text;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ aiReply })
    };

  } catch (error) {
    console.error("Error in Netlify function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
