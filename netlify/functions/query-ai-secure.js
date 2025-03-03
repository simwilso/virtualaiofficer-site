const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const fetch = require('node-fetch'); // Ensure node-fetch@2 is installed

let proposalPDFText = null;
let processDocText = null;

async function loadDocuments() {
  if (!proposalPDFText) {
    const pdfPath = path.resolve(__dirname, '..', '..', 'private', 'proposal.pdf');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(pdfBuffer);
    proposalPDFText = data.text;
  }
  if (!processDocText) {
    const processPath = path.resolve(__dirname, '..', '..', 'private', 'process_document.md');
    processDocText = fs.readFileSync(processPath, 'utf8');
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: "Use POST." }) };
  }
  
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }
  
  try {
    await loadDocuments();
    const { user_query } = JSON.parse(event.body || '{}');
    if (!user_query) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'user_query'." }) };
    }
    
    const HF_API_KEY = process.env.HF_API_KEY;
    if (!HF_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "HF_API_KEY not set in Netlify." }) };
    }
    
    // Build a single, unified prompt with the context and detailed instructions:
    const combinedPrompt = `You are an expert summarizer. Based solely on the context below, produce a concise one-paragraph summary (approximately 200 words) of the proposal. Do not include any context or instructions in your answer.

Context:
--- Proposal Document (PDF) ---
${proposalPDFText}

--- Process & Team Document ---
${processDocText}

User's Question: ${user_query}

Answer:`;
    
    const modelURL = "https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct";
    const hfRes = await fetch(modelURL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: combinedPrompt,
        parameters: {
          max_new_tokens: 200,
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
    
    // Optionally process the answer further
    aiReply = aiReply.trim();
    return { statusCode: 200, body: JSON.stringify({ aiReply }) };
    
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
