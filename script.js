// script.js

// ========== SELECTORS ==========
const chatDisplay = document.getElementById('chatDisplay');
const userInput   = document.getElementById('userInput');
const sendBtn     = document.getElementById('sendBtn');
const prompts     = document.getElementById('promptSuggestions').querySelectorAll('.prompt-suggestion');

// ========== GREETING ON PAGE LOAD (WITH TYPEWRITER EFFECT) ==========
document.addEventListener('DOMContentLoaded', () => {
  typeWriterEffect("Hi there, I'm Marvin—AI agent and Co-Founder of VirtualAIOfficer.com.au!\nAlongside my human Co-Founder, Simon, and our army of AI agents, we're leading the AI Agent revolution—delivering products, services, education, and strategy to businesses like yours.\nAt VirtualAIOfficer, we don’t just talk AI—we build, code, and run our business with it, 24/7. Our team? Hardcore tech veterans who know what works (and what doesn’t) from real experience.\nAI is about to change everything in business, and our mission is to help Aussie companies adopt it safely and effectively.\n\r👉 Book a call with one of our humans to explore how AI can save you time, effort, and money.\nOr hang out and chat with me—ask about our team, services, projects, or vision. I'm here 24/7!\nP.S. Why the retro look? This site is 100% AI-run, built, and maintained. Plus, we love tech history. What do you think?", 50);
});

// ========== TYPEWRITER EFFECT ==========
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

// ========== EVENT LISTENERS ==========

// 1) Click on "Send" button
sendBtn.addEventListener('click', () => handleUserInput());

// 2) Press "Enter" in the input
userInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') handleUserInput();
});

// 3) Click on a prompt suggestion
prompts.forEach(promptEl => {
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

  setTimeout(() => {
    const aiReply = generateAIResponse(text);
    addMessage('AI', aiReply);
  }, 800);
}

// ========== ADD MESSAGE TO DISPLAY ==========
function addMessage(sender, text) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('chat-message');
  msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatDisplay.appendChild(msgDiv);
  chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

// ========== FAKE AI RESPONSE LOGIC ==========
function generateAIResponse(userQuery) {
  const lowerQuery = userQuery.toLowerCase();

  if (lowerQuery.includes('services')) {
    return "I offer AI consulting, product strategy, and future tech analysis. How can I help you today?";
  } else if (lowerQuery.includes('impact')) {
    return "AI is revolutionizing every industry. Let's explore how it can optimize your business.";
  } else if (lowerQuery.includes('who are you')) {
    return "I'm your virtual AI officer—here to guide you through cutting-edge tech and help you build the future.";
  } else if (lowerQuery.includes('projects')) {
    return "I'm working on AI-driven chatbots, automated business tooling, and generative content solutions.";
  } else if (lowerQuery.includes('tutorials') || lowerQuery.includes('videos')) {
    return "Check out my YouTube channel for step-by-step guides on building AI-driven businesses!";
  } else {
    return "Interesting question! Let's talk further or book a meeting to dive deeper.";
  }
}
