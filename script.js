// script.js

const chatDisplay = document.getElementById('chatDisplay');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// The relative URL for your Netlify function
// If the site is served by Netlify, "/.netlify/functions/query-ai" is correct
const NETLIFY_FUNCTION_URL = "/.netlify/functions/query-ai";

// For demonstration, we'll just show messages in the chatDisplay
function addMessage(sender, text) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('chat-message');
  msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatDisplay.appendChild(msgDiv);
  chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

async function fetchAIResponse(userQuery) {
  try {
    addMessage("AI", "Thinking...");

    const res = await fetch(NETLIFY_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_query: userQuery })
    });

    if (!res.ok) {
      throw new Error(`Netlify function call failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }

    const aiReply = data.aiReply || "No reply found.";
    addMessage("AI", aiReply);

  } catch (error) {
    console.error("Error fetching AI response:", error);
    addMessage("AI", "An error occurred. Please try again later.");
  }
}

function handleUserInput() {
  const query = userInput.value.trim();
  if (!query) return;
  addMessage("User", query);
  userInput.value = "";

  fetchAIResponse(query);
}

sendBtn.addEventListener("click", handleUserInput);
userInput.addEventListener("keyup", (e) => {
  if (e.key === 'Enter') handleUserInput();
});

// Optionally an intro message
document.addEventListener("DOMContentLoaded", () => {
  addMessage("AI", "Hey there, I’m Marvin, AI agent from Hugging Face. Ask me anything!");
});
