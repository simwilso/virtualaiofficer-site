/*****************************************************
 * proposal-chat.js
 *****************************************************/

// ========== SELECTORS ==========
const chatDisplay = document.getElementById('chatDisplaySecure');
const userInput = document.getElementById('userInputSecure');
const sendBtn = document.getElementById('sendBtnSecure');

// ========== NETLIFY FUNCTION ENDPOINT ==========
const NETLIFY_FUNCTION_URL = "/.netlify/functions/query-ai-secure";

// ========== LOAD SECURE DOCUMENTS ==========
let proposalDoc = "";
let processDoc = "";

// Fetch the proposal document (ensure this file is not linked publicly if needed)
fetch("proposal_document.md")
  .then(response => response.text())
  .then(text => { proposalDoc = text; })
  .catch(error => console.error("Error loading proposal document:", error));

// Fetch the process & team document
fetch("process_document.md")
  .then(response => response.text())
  .then(text => { processDoc = text; })
  .catch(error => console.error("Error loading process document:", error));

// ========== TYPEWRITER EFFECT (as in script.js) ==========
function typeWriterEffect(text, speed, element) {
  let index = 0;
  const htmlText = text.replace(/\n/g, "<br>");
  function type() {
    if (index < htmlText.length) {
      element.innerHTML = `<strong>AI:</strong> ${htmlText.substring(0, index + 1)}`;
      index++;
      chatDisplay.scrollTop = chatDisplay.scrollHeight;
      setTimeout(type, speed);
    }
  }
  type();
}

// ========== FUNCTION TO DISPLAY A CHAT MESSAGE ==========
function addMessage(sender, text, applyTypingEffect = false) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('chat-message');
  chatDisplay.appendChild(msgDiv);

  if (applyTypingEffect && sender === 'AI') {
    typeWriterEffect(text, 30, msgDiv);
  } else {
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
  }
}

// ========== HANDLE USER INPUT ==========
function handleUserInput() {
  const text = userInput.value.trim();
  if (!text) return;
  addMessage('User', text);
  userInput.value = '';

  // Build combined prompt that forces the answer to be based solely on the documents.
  let combinedPrompt = `Answer the following question using ONLY the information from the documents below.

--- Proposal Document ---
${proposalDoc}

--- Process & Team Document ---
${processDoc}

User's Question:
${text}`;

  fetchAIResponse(combinedPrompt);
}

// ========== FETCH AI RESPONSE ==========
async function fetchAIResponse(combinedPrompt) {
  try {
    addMessage('AI', "Thinking...", true);
    const response = await fetch(NETLIFY_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_query: combinedPrompt })
    });
    if (!response.ok) throw new Error(`Error: ${response.status}`);
    const data = await response.json();
    const aiReply = data.aiReply || "No response available.";
    addMessage('AI', aiReply, true);
  } catch (error) {
    console.error("Error fetching AI response:", error);
    addMessage('AI', "An error occurred. Please try again later.");
  }
}

// ========== EVENT LISTENERS ==========
sendBtn.addEventListener('click', handleUserInput);
userInput.addEventListener('keyup', (e) => {
  if(e.key === 'Enter') handleUserInput();
});
