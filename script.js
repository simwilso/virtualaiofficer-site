// ========== SELECTORS ==========
const chatDisplay = document.getElementById('chatDisplay');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const prompts = document.getElementById('promptSuggestions').querySelectorAll('.prompt-suggestion');

// GitHub Actions API Proxy (replace with your GitHub details)
const GITHUB_PROXY_URL = "https://api.github.com/repos/simwilso/virtualaiofficer-site/dispatches";

// Knowledge Base URL (stored in GitHub repo)
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
  const introMessageDiv = document.createElement('div');
  introMessageDiv.classList.add('chat-message');
  chatDisplay.appendChild(introMessageDiv);

  typeWriterEffect(
    "Hey there, I’m Marvin, AI agent and Co-Founder of VirtualAIOfficer.com.au! I work with my human co-founder, Simon, and our team of AI agents to bring the AI revolution to businesses like yours—We offer AI products, strategy, education, automation, and advice.\n\nHow are we different? We don’t just talk about AI—we run our business with it. Our AI tools operate at every level, including management of this site! We are tech veterans and business owners, we know what works (and what doesn’t) from real-world experience and we know how AI can and will change everything.\n\nOur mission is to help Aussie businesses like you ride this wave safely and win!\n\nSo Book a call or just chat with me and ask about our team, our projects, or anything AI—I’m here 24/7 at your service.\n\nP.S. Do you like the retro look? Well, this site is 100% AI-designed and run, and we felt like honoring our roots in tech! :)",
    30,
    introMessageDiv
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
      chatDisplay.scrollTop = chatDisplay.scrollHeight; 
      setTimeout(type, speed);
    } else {
      chatDisplay.scrollTop = chatDisplay.scrollHeight; 
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
    typeWriterEffect(text, 30, msgDiv); 
  } else {
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`; 
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
  }
}

// ========== FETCH AI RESPONSE VIA GITHUB ACTIONS ==========
async function fetchAIResponse(userQuery) {
  const GITHUB_PAT = "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"; // Securely fetch from GitHub Secrets

  const systemMessage = `
  You are Marvin, a co-founder of Virtual AI Officer, and you represent the business. Your job is to answer user questions **ONLY using the provided knowledge base**.

  === KNOWLEDGE BASE START ===
  ${knowledgeBaseText}
  === KNOWLEDGE BASE END ===

  **User Question:** ${userQuery}

  BEGIN RESPONSE:
  `;

  try {
    const response = await fetch(GITHUB_PROXY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_PAT}`,  
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event_type: "query-ai",
        client_payload: { user_query: systemMessage }
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub API Authentication Failed: ${response.status} ${response.statusText}`);
    }

    console.log("Query sent to GitHub Actions, waiting for response...");
    addMessage('AI', "Thinking...", true);

  } catch (error) {
    console.error("Error fetching AI response:", error);
    addMessage('AI', "An authentication error occurred. Please check the GitHub API token.", true);
  }
}
