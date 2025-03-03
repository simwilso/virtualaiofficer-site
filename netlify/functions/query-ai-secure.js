const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const fetch = require('node-fetch'); // Ensure node-fetch@2 is installed

let proposalPDFText = null;
let processDocText = null;

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

// Helper to extract the summary from the output using a marker.
// In this case, we expect the model to output the summary after the "Summary:" marker.
function extractSummary(text) {
  const marker = "Summary:";
  const index = text.indexOf(marker);
  if (index !== -1) {
    return text.substring(index + marker.length).trim();
  }
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
    
    // Revised prompt: We remove extraneous instructions and clearly delineate context.
    const combinedPrompt = `You are a professional summarizer. Based solely on the detailed proposal information provided below, generate an original, concise one-paragraph summary of the proposal in about 200 words. Do not include any repetitive phrases or generic statements (e.g., "please refer to the projects documentation for more information"). Your answer must be written in your own words and should not include any part of the context or any instructions.
    
        Context:
        --- Proposal Document (PDF) ---
        ${proposalPDFText}
        
        --- Process & Team Document ---
        ${processDocText}
        
        User's Question: ${user_query}
        
        Answer:`;
    
    console.log("Combined Prompt (first 200 chars):", combinedPrompt.substring(0, 200));
    
    // Call Hugging Face API with increased token limit to allow a full summary.
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
          max_new_tokens: 400,
          temperature: 0.3,
          top_p: 0.9,
          repetition_penalty: 3.0
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
    
    // Attempt to extract the summary after the "Summary:" marker.
    let aiReply = extractSummary(fullOutput);
    
    // If the marker wasn't found, try to remove any prompt echoes manually.
    if (!aiReply || aiReply.length < 20) {
      // Fallback: Remove the prompt portion if it's repeated.
      aiReply = fullOutput.replace(combinedPrompt, "").trim();
    }
    
    console.log("Final AI Reply (first 200 chars):", aiReply.substring(0, 200));
    
    return { statusCode: 200, body: JSON.stringify({ aiReply }) };
    
  } catch (err) {
    console.error("Error in secure query function:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
