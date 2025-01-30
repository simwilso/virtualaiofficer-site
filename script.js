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

// AI Typing Effect
function typeWriterEffect(element, text, speed) {
  let index = 0;
  function type() {
    if (index < text.length) {
      element.innerHTML += text.charAt(index);
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
  You are Marvin, an AI agent and co-founder of Virtual AI Officer. 
  Your job is to answer user questions **based on the following knowledge base**:
  
  === KNOWLEDGE BASE START ===
  ${knowledgeBaseText}
  === KNOWLEDGE BASE END ===

  When answering:
  - **DO NOT** repeat the full knowledge base.
  - **ONLY** provide relevant answers based on the user's question.
  - If unsure, say: "I don't know the answer to that yet, but my team is always updating me!"
  - Keep responses short and professional unless more detail is required.

  Now, answer the following user question:
  
  **User:** ${userQuery}
  **Marvin:**`;

  const response = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: systemMessage,
      parameters: { max_new_tokens: 150, temperature: 0.6 }
    })
  });

  const data = await response.json();
  console.log("API Response:", data);

  const aiReply = data[0]?.generated_text || "I couldn't process that. Try again!";
  addMessage('AI', aiReply);
}


