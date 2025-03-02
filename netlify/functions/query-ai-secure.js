const fetch = require('node-fetch'); // if needed

exports.handler = async (event, context) => {
  // ===== AUTHENTICATION CHECK =====
  // Check for an authorization header set by Netlify Identity.
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }
  // Optionally, verify the token here for additional security.

  try {
    const { user_query } = JSON.parse(event.body);

    // ===== CONSTRUCT THE API REQUEST =====
    // For example, call your AI service (such as OpenAI or a Hugging Face endpoint).
    // Replace 'https://api.example.com/ai-endpoint' with your actual endpoint.
    const apiResponse = await fetch('https://api.example.com/ai-endpoint', {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: user_query })
    });
    const apiData = await apiResponse.json();
    const aiReply = apiData.generated_text || "No answer available.";

    return {
      statusCode: 200,
      body: JSON.stringify({ aiReply })
    };
  } catch (error) {
    console.error("Error in secure query function:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
