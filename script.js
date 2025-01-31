// script.js

const chatDisplay = document.getElementById('chatDisplay');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const prompts = document.getElementById('promptSuggestions').querySelectorAll('.prompt-suggestion');

// OLD code used GITHUB_TOKEN -- remove that. Instead:
const NETLIFY_FUNCTION_URL = "/.netlify/functions/query-ai"; // or full URL if hosted elsewhere

// ... your typeWriterEffect, addMessage, etc. remain the same ...

function handleUserInput() {
  const text = userInput.value.trim();
  if (!text) return;

  addMessage('User', text);
  userInput.value = '';

  fetchAIResponse(text);
}

async function fetchAIResponse(userQuery) {
  try {
    // POST to Netlify function
    const triggerResponse = await fetch(NETLIFY_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_query: userQuery })
    });

    if (!triggerResponse.ok) {
      throw new Error(`Netlify function call failed: ${triggerResponse.status} ${triggerResponse.statusText}`);
    }

    // Show "Thinking..."
    addMessage('AI', "Thinking...", true);

    // Parse the JSON (which includes the AI reply)
    const data = await triggerResponse.json();
    if (data.error) {
      throw new Error(data.error);
    }

    const aiReply = data.aiReply || "No response found.";
    addMessage('AI', aiReply, true);

  } catch (error) {
    console.error("Error fetching AI response from Netlify:", error);
    addMessage('AI', "An error occurred. Please try again later.", true);
  }
}

// Add event listeners for sending message...
sendBtn.addEventListener('click', handleUserInput);
userInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') handleUserInput();
});
prompts.forEach(promptEl => {
  promptEl.addEventListener('click', () => {
    userInput.value = promptEl.textContent;
    handleUserInput();
  });
});

