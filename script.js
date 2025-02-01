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
// We call our serverless function that hits Hugging Face
const NETLIFY_FUNCTION_URL = "/.netlify/functions/query-ai";

// ========== KNOWLEDGE BASE URL ==========
const KNOWLEDGE_BASE_URL = "https://raw.githubusercontent.com/simwilso/virtualaiofficer-site/main/knowledge_base.md";
let knowledgeBaseText = "";

// Fetch the knowledge base on load
fetch(KNOWLEDGE_BASE_URL)
  .then(response => response.text())
  .then(text => {
    knowledgeBaseText = text;
  })
  .catch(error => console.error("Error loading knowledge base:", error));

// ========== TYPEWRITER EFFECT ==========
function typeWriterEffect(text, speed, element) {
  let index = 0;
  // Convert newlines to <br>
  const htmlText = text.replace(/\n/g, "<br>");

  function type() {
    if (index < htmlText.length) {
      element.innerHTML = `<strong>AI:</strong> ${htmlText.substring(0, index + 1)}`;
      index++;
      // Scroll to bottom each time we add a character
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
    // Show AI message with typewriter effect
    typeWriterEffect(text, 30, msgDiv);
  } else {
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
  }
}

// ========== INITIAL INTRODUCTION ON PAGE LOAD ==========
document.addEventListener('DOMContentLoaded', () => {
  const introMessageDiv = document.createElement('div');
  introMessageDiv.classList.add('chat-message');
  chatDisplay.appendChild(introMessageDiv);

  // Use \n\n for blank lines, etc.
  const introText = "Hey there, I’m Marvin, AI agent and Co-Founder of VirtualAIOfficer.com.au!\nAt VAIO we provide AI Strategy, Education, Consulting, and Project Delivery.\nWe are passionate about Responsible AI for Impact as well as Regional Development especially in Gippsland.\nAt VAIO we use AI Agents comprehensively in our business. In fact we have a team of agents who design, manage, update and maintain this site which we've for now deliberately made HIDEOUS and given our agents the task to progressively clean and fix.\nAs we do that hopefully you will see what a fully Autonomous and Orchestrated group of AI Agents can be configured to do for any business process or department all while you humans sleep!\nWe've asked them to only make one change a day so we can all watch the magic happen. Enjoy! :)";
  
  typeWriterEffect(introText, 30, introMessageDiv);
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

  // Show user's message
  addMessage('User', text);
  userInput.value = '';

  // Merge the knowledge base as context
  // In a naive approach, we just prepend it to the user's query
  let combinedPrompt = text;
  if (knowledgeBaseText) {
    combinedPrompt = `Here is some additional context from our knowledge base:\n\n${knowledgeBaseText}\n\nUser's Question:\n${text}`;
  }

  fetchAIResponse(combinedPrompt);
}

// ========== FETCH AI RESPONSE DIRECTLY VIA NETLIFY FUNCTION ==========
async function fetchAIResponse(combinedPrompt) {
  try {
    // Temporarily show "Thinking..." with a typewriter effect
    // We'll replace it once we get the real response
    addMessage('AI', "Thinking...", true);

    const response = await fetch(NETLIFY_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ user_query: combinedPrompt })
    });

    if (!response.ok) {
      throw new Error(`Netlify function call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    // Display the final AI reply
    // We'll do typewriter effect again
    const aiReply = data.aiReply || "No response found.";
    addMessage('AI', aiReply, true);

  } catch (error) {
    console.error("Error fetching AI response:", error);
    addMessage('AI', "An error occurred. Please try again later.");
  }
}
