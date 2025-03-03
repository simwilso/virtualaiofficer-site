const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const fetch = require('node-fetch'); // Ensure node-fetch@2 is installed

let proposalPDFText = null;
let processDocText = null;

// Load secure documents from the private folder
async function loadDocuments() {
  if (!proposalPDFText) {
    try {
      const pdfPath = path.resolve(__dirname, '..', '..', 'private', 'proposal.pdf');
      console.log('Using PDF path:', pdfPath);
      const pdfBuffer = fs.readFileSync(pdfPath);
      const data = await pdf(pdfBuffer);
      proposalPDFText = data.text;
      console.log('Loaded proposal PDF text successfully.');
    } catch (error) {
      console.error("Error loading proposal PDF:", error);
      throw new Error("Failed to load proposal document: " + error.message);
    }
  }
  
  if (!processDocText) {
    try {
      const processPath = path.resolve(__dirname, '..', '..', 'private', 'process_document.md');
      processDocText = fs.readFileSync(processPath, 'utf8');
      console.log('Loaded process document text successfully.');
    } catch (error) {
      console.error("Error loading process document:", error);
      processDocText = "";
    }
  }
}

// Helper function to extract text after a delimiter
function extractSummary(text) {
  const marker = "Summary:";
  const index = text.indexOf(marker);
  if (index !== -1) {
    return text.substring(index + marker.length).trim();
  }
  // Fallback: return the entire text trimmed
  return text.trim();
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
    console.log("query-ai-secure invoked at:", new Date().toISOString());
    await loadDocuments();
    
    const { user_query } = JSON.parse(event.body || '{}');
    if (!user_query) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'user_query'." }) };
    }
    
    const HF_API_KEY = process.env.HF_API_KEY;
    if (!HF_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "HF_API_KEY not set in Netlify." }) };
    }
    
    // Build a single, unified prompt that provides the context and instructs the model
    // to output ONLY the summary. We ignore the user_query in the summary instructions if needed.
    const combinedPrompt = `Below is the content of a proposal document and a supporting process document.
Generate a detailed, concise summary of the proposal in approximately 200 words.
Your output must include ONLY the summary text and nothing else.
Do not echo any of the prompt instructions or context.

[BEGIN CONTEXT]
Proposal Document:
${proposalPDFText}

Process Document:
${processDocText}
[END CONTEXT]

User's Question: ${user_query}

Summary:`;
    
    console.log("Combined Prompt (first 200 chars):", combinedPrompt.substring(0, 200));
    
    // Call the Hugging Face LLM with a larger token limit to allow a longer summary
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
          max_new_tokens: 400, // Increase to allow a 200-word summary
          temperature: 0.1,
          top_p: 0.7,
          repetition_penalty: 2.5
        }
      })
    });
    
    if (!hfRes.ok) {
      const err = await hfRes.text();
      console.error("Hugging Face error:", err);
      return { statusCode: hfRes.status, body: JSON.stringify({ error: "Hugging Face error: " + err }) };
    }
    
    const result = await hfRes.json();
    console.log("Hugging Face result:", result);
    
    let fullOutput = "";
    if (Array.isArray(result) && result[0]?.generated_text) {
      fullOutput = result[0].generated_text;
    } else if (result.generated_text) {
      fullOutput = result.generated_text;
    } else {
      fullOutput = "No response found.";
    }
    
    // Extract only the summary portion (text after "Summary:")
    const aiReply = extractSummary(fullOutput);
    
    console.log("Final AI Reply (first 200 chars):", aiReply.substring(0, 200));
    
    return { statusCode: 200, body: JSON.stringify({ aiReply }) };
    
  } catch (err) {
    console.error("Error in secure query function:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
