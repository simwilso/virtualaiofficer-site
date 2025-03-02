const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const fetch = require('node-fetch'); // Ensure node-fetch@2 is installed

let proposalPDFText = null;
let processDocText = null;

// Function to load the secure documents from the private folder
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

// Helper function to extract the final answer (can be customized further)
function extractFinalAnswer(text) {
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
    
    // Build the combined prompt with explicit instructions:
    // The prompt instructs the model to output only a concise summary (approx. 200 words) and nothing else.
    const combinedPrompt = `You are an expert summarizer. Based solely on the context provided below, generate a concise, one-paragraph summary of the proposal in about 200 words. Do not include any of the context or prompt text in your answer—output only the summary.

Context:
--- Proposal Document (PDF) ---
${proposalPDFText}

--- Process & Team Document ---
${processDocText}

User's Question:
${user_query}

Answer:`;
    
    console.log("Combined Prompt (first 200 chars):", combinedPrompt.substring(0, 200));
    
    // Call the Hugging Face model
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
          max_new_tokens: 200, // Adjust token limit as needed
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
    
    let aiReply = "No response found.";
    if (Array.isArray(result) && result[0]?.generated_text) {
      aiReply = result[0].generated_text;
    } else if (result.generated_text) {
      aiReply = result.generated_text;
    }
    
    // Process the output to extract only the summary answer
    aiReply = extractFinalAnswer(aiReply);
    console.log("Final AI Reply (first 200 chars):", aiReply.substring(0, 200));
    
    return { statusCode: 200, body: JSON.stringify({ aiReply }) };
    
  } catch (err) {
    console.error("Error in secure query function:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};