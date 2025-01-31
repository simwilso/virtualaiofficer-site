/*****************************************************
 * script.js
 *****************************************************/

// ========== SELECTORS ==========
const chatDisplay = document.getElementById('chatDisplay');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const promptEls = document
  .getElementById('promptSuggestions')
  .querySelectorAll('.prompt-suggestion');

// ========== NETLIFY FUNCTION ENDPOINT ==========
// This is how we call our serverless proxy
const NETLIFY_FUNCTION_URL = "/.netlify/functions/query-ai"; 

// ========== KNOWLEDGE BASE (OPTIONAL) ==========
const KNOWLEDGE_BASE_URL = "https://raw.githubusercontent.com/simwilso/virtualaiofficer-site/main/knowledge_base.md";
let knowledgeBaseText = "";

fetch(KNOWLEDGE_BASE_URL)
  .then(response => response.text())
  .then(text => {
    knowledgeBaseText = text;
  })
  .catch(error => console.error("Error loading knowledge base:", error));

// ========== TYPEWRITER EFFECT ==========
function typeWriterEffect(text, speed, element) {
  if (!element) {
    console.error("typeWriterEffect was called with an undefined element!");
    return;
  }

  let index = 0;

  function type() {
    if (index < text.length) {
      element.innerHTML = `<strong>AI:</strong> ${text.substring(0, index + 1)}`;
      index++;
      chatDisplay.scrollTop = chatDisplay.scrollHeight; 
      setTimeout(type, speed);
    } else {
      chatDisplay.scrollTop = chatDisplay.scrollHeight; 
    }
  }

  type();
}

// ========== ADD CHAT MESSAGE ==========
function addMessage(sender, text, applyTypingEffect = false) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('chat-message');
  chatDisplay.appendChild(msgDiv);

  if (applyTypingEffect) {
    typeWriterEffect(text, 30, msgDiv);
  } else {
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
  }
}

// ========== ON PAGE LOAD ==========
document.addEventListener('DOMContentLoaded', () => {
  // Intro message
  const introMessageDiv = document.createElement('div');
  introMessageDiv.classList.add('chat-message');
  chatDisplay.appendChild(introMessageDiv);

  typeWriterEffect(
    "Hey there, I’m Marvin, AI agent and Co-Founder of VirtualAIOfficer.com.au! Ask me anything about AI and business solutions.",
    30,
    introMessageDiv
  );
});

// ========== EVENT LISTENERS ==========
sendBtn.addEventListener('click', handleUserInput);
userInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') handleUserInput();
});
promptEls.forEach(promptEl => {
  promptEl.addEventListener('click', () => {
    userInput.value = promptEl.textContent;
    handleUserInput();
  });
});

// ========== HANDLE USER INPUT ==========
function handleUserInput() {
  const text = userInput.value.trim();
  if (!text) return;

  addMessage('User', text);
  userInput.value = '';

  fetchAIResponse(text);
}

// ========== FETCH AI RESPONSE VIA NETLIFY FUNCTION ==========
async function fetchAIResponse(userQuery) {
  try {
    // Show immediate "Thinking..." message
    addMessage('AI', "Thinking...", true);

    // Call Netlify function
    const response = await fetch(NETLIFY_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ user_query: userQuery })
    });

    if (!response.ok) {
      throw new Error(`Netlify function call failed: ${response.status} ${response.statusText}`);
    }

    // Parse JSON from serverless function
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    // Display the AI reply
    const aiReply = data.aiReply || "No response found.";
    addMessage('AI', aiReply, true);

  } catch (error) {
    console.error("Error fetching AI response from Netlify:", error);
    addMessage('AI', "An error occurred. Please try again later.", true);
  }
}
