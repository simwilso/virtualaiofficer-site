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
  const systemMessage = `You are an AI assistant for Virtual AI Officer. Use the following knowledge base to answer user queries:\n\n${knowledgeBaseText}`;

  const response = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: `${systemMessage}\n\nUser: ${userQuery}\nAI:`,
      parameters: { max_new_tokens: 100, temperature: 0.7 }
    })
  });

  const data = await response.json();
  console.log("API Response:", data);
  const aiReply = data[0]?.generated_text || "Sorry, I couldn't process that.";

  addMessage('AI', aiReply);
}

