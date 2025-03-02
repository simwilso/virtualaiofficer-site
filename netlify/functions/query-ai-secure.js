const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const fetch = require('node-fetch'); // Ensure node-fetch version 2 is installed

let proposalPDFText = null;
let processDocText = null;

// Function to load the secure documents from the private folder
async function loadDocuments() {
  // Load the proposal PDF text if not already loaded
  if (!proposalPDFText) {
    try {
      // __dirname is in netlify/functions, so go two levels up to reach the repo root, then into "private"
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
  
  // Load the process document text if not already loaded
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

// Helper function to keep only the last paragraph of the response
function keepLastParagraph(text) {
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs[paragraphs.length - 1].trim();
}

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: "Use POST." }) };
  }
  
  // ===== Authorization Check =====
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }
  
  try {
    // Load the secure documents (proposal PDF and process document)
    await loadDocuments();
    
    // Parse the incoming request body
    const { user_query } = JSON.parse(event.body || '{}');
    if (!user_query) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'user_query'." }) };
    }
    
    // Retrieve the Hugging Face API key from environment variables
    const HF_API_KEY = process.env.HF_API_KEY;
    if (!HF_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "HF_API_KEY not set in Netlify." }) };
    }
    
    // ===== Build the Combined Prompt =====
    // Instruct the model to answer using ONLY the information from the secure documents.
    const combinedPrompt = `Answer the following question using ONLY the information from the documents below.

--- Proposal Document (PDF) ---
${proposalPDFText}

--- Process & Team Document ---
${processDocText}

User's Question:
${user_query}

Answer concisely:
`;
    // Log the first 200 characters of the prompt (for debugging)
    console.log("Combined Prompt (first 200 chars):", combinedPrompt.substring(0, 200));
    
    // ===== Call the Hugging Face LLM =====
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
          max_new_tokens: 80,
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
    
    // Optionally, keep only the last paragraph of the AI response
    aiReply = keepLastParagraph(aiReply);
    
    return { statusCode: 200, body: JSON.stringify({ aiReply }) };
    
  } catch (err) {
    console.error("Error in secure query function:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};