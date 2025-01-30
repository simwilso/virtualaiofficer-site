// ========== SELECTORS ==========
const chatDisplay = document.getElementById('chatDisplay');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const prompts = document.getElementById('promptSuggestions').querySelectorAll('.prompt-suggestion');

// GitHub Actions API Proxy (replace with your GitHub details)
const GITHUB_PROXY_URL = "https://api.github.com/repos/simwilso/virtualaiofficer-site/dispatches";
//const GITHUB_SECRET_NAME = "GH_PAT_AI"; // Must match the GitHub Secret Name

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
    "Hey there, I’m Marvin, AI agent and Co-Founder of VirtualAIOfficer.com.au! I work with my human co-founder, Simon, and our team of AI agents to bring the AI revolution to businesses like yours—We offer AI products, strategy, education, automation, and advice. \n\n How are we different? We don’t just talk about AI—we run our business with it. Our AI tools operate at every level, including management of this site! We are tech veterans and business owners, we know what works (and what doesn’t) from real-world experience and we know how AI can and will change everything. \n\n Our mission is to help Aussie businesses like you ride this wave safely and win! \n\n So Book a call or just chat with me and ask about our team, our projects, or anything AI—I’m here 24/7 at your service. \n\n P.S. Do you like the retro look? Well, this site is 100% AI-designed and run, and we felt like honoring our roots in tech! :)",
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
  // Construct system message with knowledge base
  const systemMessage = `
  You are Marvin, a co-founder of Virtual AI Officer, and you represent the business. Your job is to answer user questions **ONLY using the provided knowledge base**.
 
  **Rules for answering:**
  - **DO NOT generate information from your own knowledge**—only use the knowledge base below.
  - If the answer is **not in the knowledge base**, reply: "I'm not sure, but my team is always updating me! Or you can Book a Call."
  - **DO NOT assume solutions—only reference documented AI solutions in the knowledge base.**
  - **If an exact match isn't found, infer the closest possible AI solutions based on available knowledge.**
  - **Summarize rather than listing too many solutions.**
  - **Only comment on questions related to business or AI. Politely decline to comment on other topics.**
  - **When finished, say 'END RESPONSE'.**

  === KNOWLEDGE BASE START ===
  ${knowledgeBaseText}
  === KNOWLEDGE BASE END ===

  **User Question:** ${userQuery}

  **Provide an answer strictly based on the knowledge base. If necessary, infer the closest possible AI solution. Do not include unrelated details.**

  BEGIN RESPONSE:
  `;

  try {
    // Send request to GitHub Actions API Proxy
    const response = await fetch(GITHUB_PROXY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_SECRET_NAME}`,  
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event_type: "query-ai",
        client_payload: { user_query: systemMessage }
      })
    });

    if (response.ok) {
      console.log("Query sent to GitHub Actions, waiting for response...");

      // Wait before retrieving response from GitHub Actions artifact
      await new Promise(resolve => setTimeout(resolve, 5000));

      const artifactResponse = await fetch(`https://api.github.com/repos/simwilso/virtualaiofficer-site/actions/artifacts`, {
        headers: { "Authorization": `Bearer ${GITHUB_SECRET_NAME}` }
      });

      const artifactData = await artifactResponse.json();

      if (artifactData.artifacts && artifactData.artifacts.length > 0) {
        const artifactURL = artifactData.artifacts[0].archive_download_url;

        const aiResponse = await fetch(artifactURL, {
          headers: { "Authorization": `Bearer ${GITHUB_SECRET_NAME}` }
        });

        const jsonData = await aiResponse.json();
        console.log("AI Response:", jsonData);
        
        let aiReply = jsonData.generated_text || "I couldn't process that. Try again!";

        // Extract only AI-generated response
        if (aiReply.includes("BEGIN RESPONSE:")) {
          aiReply = aiReply.split("BEGIN RESPONSE:")[1]?.trim();
        }
        if (aiReply.includes("END RESPONSE")) {
          aiReply = aiReply.split("END RESPONSE")[0]?.trim();
        }

        addMessage('AI', aiReply, true);
      } else {
        addMessage('AI', "I couldn't process that. Try again!", true);
      }
    } else {
      console.error("Failed to send request to GitHub Actions.");
    }
  } catch (error) {
    console.error("Error fetching AI response:", error);
    addMessage('AI', "An error occurred. Please try again later.", true);
  }
}
