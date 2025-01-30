// script.js
const chatDisplay = document.getElementById('chatDisplay');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const prompts = document.getElementById('promptSuggestions').querySelectorAll('.prompt-suggestion');

// Hugging Face API Key (Store securely in a backend for production)
const HF_API_KEY = "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";
const MODEL = "tiiuae/falcon-7b-instruct";  // You can change the model if needed
const KNOWLEDGE_BASE_URL = "https://raw.githubusercontent.com/simwilso/virtualaiofficer-site/main/knowledge_base.md";

// Load the knowledge base document
let knowledgeBaseText = "";

fetch(KNOWLEDGE_BASE_URL)
  .then(response => response.text())
  .then(text => {
    knowledgeBaseText = text;
  })
  .catch(error => console.error("Error loading knowledge base:", error));

// ========== AI GREETING ON PAGE LOAD ==========
document.addEventListener('DOMContentLoaded', () => {
  typeWriterEffect(
    "Hi there, I'm Marvin! I'm an AI Agent and Co-Founder of Virtual AI Officer alongside my human colleague Simon. We deliver cutting-edge AI solutions, strategy, and automation to businesses like yours.\n\nAsk me about our services, AI insights, or how we run a fully AI-powered business!",
    30
  );
});

// ========== FUNCTION TO SHOW TYPING EFFECT ==========
function typeWriterEffect(text, speed) {
  let index = 0;
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('chat-message');
  chatDisplay.appendChild(messageDiv);

  function type() {
    if (index < text.length) {
      messageDiv.innerHTML = `<strong>AI:</strong> ${text.substring(0, index + 1)}`;
      index++;
      setTimeout(type, speed);
    }
  }

  type();
}


// Handle user input
sendBtn.addEventListener('click', () => handleUserInput());
userInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') handleUserInput();
});
prompts.forEach(promptEl => {
  promptEl.addEventListener('click', () => {
    userInput.value = promptEl.textContent;
    handleUserInput();
  });
});

function handleUserInput() {
  const text = userInput.value.trim();
  if (!text) return;

  addMessage('User', text);
  userInput.value = '';

  fetchAIResponse(text);
}

// Display messages
function addMessage(sender, text) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('chat-message');
  msgDiv.innerHTML = `<strong>${sender}:</strong> `;
  chatDisplay.appendChild(msgDiv);

  typeWriterEffect(msgDiv, text, 30);
  chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

// Fetch AI response
async function fetchAIResponse(userQuery) {
  const systemMessage = `
  You are Marvin, an AI assistant for Virtual AI Officer. Answer user questions based on the following knowledge base. 
  Do NOT repeat the entire knowledge base in your responses. Only extract relevant information and make your responses reasonably succinct.
  Do NOT answer questions relating to politics, religion, countries, war or anything controversial. In the case of any questions like that answer 'I don't have an opinion on that.'

  ---
  # Knowledge Base:
  ${knowledgeBaseText}
  ---

  **User Question:** ${userQuery}
  **Answer:**`;

  const response = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: systemMessage,
      parameters: { max_new_tokens: 200, temperature: 0.6 }
    })
  });

  const data = await response.json();
  console.log("API Response:", data);

  // Extract AI's response correctly
  const aiReply = data[0]?.generated_text?.split("**Answer:**")?.[1]?.trim() || "I couldn't process that. Try again!";
  addMessage('AI', aiReply);
}



