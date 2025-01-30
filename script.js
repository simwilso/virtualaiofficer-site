// ========== SELECTORS ==========
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
  // Create a new chat message div for the AI greeting
  const introMessageDiv = document.createElement('div');
  introMessageDiv.classList.add('chat-message');
  chatDisplay.appendChild(introMessageDiv);

  typeWriterEffect(
    "Hi there, I'm Marvin! I'm an AI Agent and Co-Founder of Virtual AI Officer alongside my human colleague Simon. We deliver cutting-edge AI solutions, strategy, and automation to businesses like yours.\n\nAsk me about our services, AI insights, or how we run a fully AI-powered business!",
    30,
    introMessageDiv  // Ensure the typing effect knows where to insert the text
  );
});

// ========== FUNCTION TO SHOW TYPING EFFECT ==========
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
      chatDisplay.scrollTop = chatDisplay.scrollHeight; // Ensure scrolling happens as text is typed
      setTimeout(type, speed);
    } else {
      chatDisplay.scrollTop = chatDisplay.scrollHeight; // Final scroll to ensure visibility
    }
  }

  type();
}

// ========== HANDLE USER INPUT ==========
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

// ========== FUNCTION TO DISPLAY CHAT MESSAGES ==========
function addMessage(sender, text, applyTypingEffect = false) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('chat-message');
  chatDisplay.appendChild(msgDiv);

  if (applyTypingEffect) {
    typeWriterEffect(text, 30, msgDiv); // AI messages use typing effect
  } else {
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`; // User messages appear instantly
    chatDisplay.scrollTop = chatDisplay.scrollHeight; // Scroll to bottom
  }
}

// ========== FETCH AI RESPONSE ==========
async function fetchAIResponse(userQuery) {
  const systemMessage = `
  You are Marvin, an AI assistant for Virtual AI Officer.
  - Answer questions **ONLY using the knowledge base** provided below.
  - **DO NOT repeat the knowledge base text** in your response.
  - **ONLY extract relevant details** related to the user’s query.
  - If you don’t know the answer, say: "I'm not sure, but my team is always updating me!"
  - Keep responses **concise and professional**.

  === KNOWLEDGE BASE START ===
  ${knowledgeBaseText}
  === KNOWLEDGE BASE END ===

  **User Question:** ${userQuery}

  BEGIN RESPONSE:
  `;

  const response = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: systemMessage,
      parameters: { 
        max_new_tokens: 150,  // Slightly shorter responses
        temperature: 0.1,  // Reduce randomness
        top_p: 0.5,  // Prioritize most likely words
        repetition_penalty: 1.5, // Stronger penalty for repeated phrases
        stop: ["\n\n", "=== KNOWLEDGE BASE START ===", "BEGIN RESPONSE:"]  // Force AI to stop early
    }         
    })
  });

  const data = await response.json();
  console.log("Raw API Response:", data);

  // Extract AI's response correctly
  let aiReply = data[0]?.generated_text || "I couldn't process that. Try again!";
  console.log("Raw AI Output:", aiReply); // Debugging log
  
  // Remove instructions or repeated knowledge base references
  if (aiReply.includes("BEGIN RESPONSE:")) {
      aiReply = aiReply.split("BEGIN RESPONSE:")[1]?.trim();
  } else if (aiReply.includes(userQuery)) {
      aiReply = aiReply.replace(userQuery, "").trim(); // Remove echoed query
  }
  
  // Remove any excessive whitespace or formatting issues
  aiReply = aiReply.replace(/\s+/g, " ").trim();
  
  addMessage('AI', aiReply, true);  
    
}