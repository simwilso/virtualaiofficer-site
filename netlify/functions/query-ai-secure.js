const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const fetch = require('node-fetch');

// Global variables for caching document contents
let proposalPDFText = null;
let processDocText = null;

/**
 * Loads and caches the secure documents.
 * The proposal PDF and process document are stored in the "private" folder.
 */
async function loadDocuments() {
  // Load and cache the proposal PDF text
  if (!proposalPDFText) {
    try {
      const pdfPath = path.resolve(__dirname, '..', '..', 'private', 'proposal.pdf');
      const pdfBuffer = fs.readFileSync(pdfPath);
      const data = await pdf(pdfBuffer);
      proposalPDFText = data.text;
      console.log('Loaded proposal PDF text.');
    } catch (error) {
      console.error("Error loading proposal PDF:", error);
      throw new Error("Failed to load proposal document.");
    }
  }
  
  // Load and cache the process document text
  if (!processDocText) {
    try {
      const processPath = path.resolve(__dirname, '..', '..', 'private', 'process_document.md');
      processDocText = fs.readFileSync(processPath, 'utf8');
      console.log('Loaded process document text.');
    } catch (error) {
      console.error("Error loading process document:", error);
      // Optionally assign an empty string if this document is optional
      processDocText = "";
    }
  }
}

exports.handler = async (event, context) => {
  // ===== Authorization Check =====
  // This check ensures only authenticated requests (e.g., via Netlify Identity) are processed.
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" })
    };
  }
  
  try {
    // ===== Load Secure Documents =====
    await loadDocuments();

    // ===== Parse the Request =====
    const { user_query } = JSON.parse(event.body);
    if (!user_query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing user_query in request body." })
      };
    }
    
    // ===== Build the Combined Prompt =====
    // The prompt instructs the AI to use only the information from the provided documents.
    const combinedPrompt = `Answer the following question using ONLY the information from the documents below.

--- Proposal Document (PDF) ---
${proposalPDFText}

--- Process & Team Document ---
${processDocText}

User's Question:
${user_query}`;

    // ===== Call the AI Service =====
    // Replace 'https://api.example.com/ai-endpoint' with your actual AI API endpoint.
    const aiResponse = await fetch('https://api.example.com/ai-endpoint', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json"
        // Add additional headers if your API requires them, for example:
        // "Authorization": "Bearer YOUR_API_KEY"
      },
      body: JSON.stringify({ prompt: combinedPrompt })
    });
    
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      return {
        statusCode: aiResponse.status,
        body: JSON.stringify({ error: "AI API error", details: errorText })
      };
    }
    
    const aiData = await aiResponse.json();
    const aiReply = aiData.generated_text || "No answer available.";
    
    return {
      statusCode: 200,
      body: JSON.stringify({ aiReply })
    };
  } catch (error) {
    console.error("Error in secure query function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
