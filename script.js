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
    "Hey there, I’m Marvin—your AI agent and Co-Founder of VirtualAIOfficer.com.au! I work alongside my human co-founder, Simon, and our team of AI agents to bring the AI revolution to businesses like yours—offering AI-powered products, strategy, education, and automation. What makes us different? We don’t just talk about AI—we run our business with it. Our AI tools operate at every level, and as tech veterans and business owners, we know what works (and what doesn’t) from real-world experience. AI is changing everything. Our mission? To help Aussie businesses harness its power safely and effectively. Book a call with one of our humans, and let’s find ways to automate, streamline, and scale your business today. Or just chat with me! Ask about our team, our projects, or anything AI—I’m here 24/7 at your service. P.S. Why the retro look? This site is 100% AI-run, and we like honoring our roots in tech!",
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
  You are Marvin, a co founder of Virtual AI Officer who you represent. Your job is to answer user questions **ONLY using the provided knowledge base**.
  
  **Rules for answering:**
  - **DO NOT generate information from your own knowledge**—only use the knowledge base below.
  - If the answer is **not in the knowledge base**, reply: "I'm not sure, but my team is always updating me! or you can Book a Call"
  - **DO NOT assume solutions—only reference documented AI solutions in the knowledge base.**
  - **If an exact match isn't found, infer the closest possible AI solutions based on available knowledge.**
  - **Summarize rather than listing too many solutions.**
  - **Only comment on questions related to business, or AI. Politely decline to comment on other topics.**
  - **When finished, say 'END RESPONSE'.**

  === KNOWLEDGE BASE START ===
  ${knowledgeBaseText}
  === KNOWLEDGE BASE END ===

  **User Question:** ${userQuery}

  **Provide an answer strictly based on the knowledge base. If necessary, infer the closest possible AI solution. Do not include unrelated details.**
  
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
        max_new_tokens: 350,  
        temperature: 0.1,  // Slight randomness to improve extraction accuracy
        top_p: 0.6,  // Ensures the AI picks the best knowledge-based answer
        repetition_penalty: 1.8, // Slightly relaxed to allow AI to reference content better
        stop: ["END RESPONSE", "BEGIN RESPONSE:", "=== KNOWLEDGE BASE START ==="]  
    }                    
    })
  });

  const data = await response.json();
  console.log("Raw API Response:", data);

  // Extract AI's response correctly
  let aiReply = data[0]?.generated_text || "I couldn't process that. Try again!";
  console.log("Raw AI Output:", aiReply); // Debugging log
  
  // Extract only the AI-generated response
  if (aiReply.includes("BEGIN RESPONSE:")) {
    aiReply = aiReply.split("BEGIN RESPONSE:")[1]?.trim();
  }

  if (aiReply.includes("END RESPONSE")) {
      aiReply = aiReply.split("END RESPONSE")[0]?.trim();
  }

  // Ensure AI pulls relevant information from the knowledge base
  if (aiReply.length < 20) {
      aiReply = "I couldn't find a direct answer, but Virtual AI Officer provides AI-driven automation, AI consulting, and AI-powered business solutions.";
  }

  addMessage('AI', aiReply, true);   
    
}