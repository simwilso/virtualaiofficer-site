// ========== SELECTORS ==========
const chatDisplay = document.getElementById('chatDisplay');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const prompts = document
  .getElementById('promptSuggestions')
  .querySelectorAll('.prompt-suggestion');

// NOTE: Must have your GH PAT if calling from the front-end:
const GITHUB_PROXY_URL = "https://api.github.com/repos/simwilso/virtualaiofficer-site/dispatches";
const GITHUB_TOKEN = "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"; // <-- Replace with a real token (NOT recommended in production)

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
    "Hey there, I’m Marvin, AI agent and Co-Founder of VirtualAIOfficer.com.au! Ask me anything about AI and business solutions.",
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
  try {
    // 1) Trigger GitHub Actions workflow using "repository_dispatch" event
    const triggerResponse = await fetch(GITHUB_PROXY_URL, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        // IMPORTANT: Include the token below
        "Authorization": `Bearer ${GITHUB_TOKEN}`
      },
      body: JSON.stringify({
        event_type: "query-ai",
        client_payload: { user_query: userQuery }
      })
    });

    if (!triggerResponse.ok) {
      throw new Error(`GitHub API Failed: ${triggerResponse.status} ${triggerResponse.statusText}`);
    }

    console.log("Query sent to GitHub Actions, waiting for response...");
    addMessage('AI', "Thinking...", true);

    // 2) Wait for GitHub Actions to complete
    //    This is just a naive wait; you could poll for the status, but here's a simple 10s delay:
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 3) Fetch AI-generated response from GitHub Actions artifacts
    const artifactResponse = await fetch(`https://api.github.com/repos/simwilso/virtualaiofficer-site/actions/artifacts`, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        // If the repo is private, you also need the token here.
        "Authorization": `Bearer ${GITHUB_TOKEN}`
      }
    });

    if (!artifactResponse.ok) {
      throw new Error(`Failed to fetch artifacts: ${artifactResponse.status} ${artifactResponse.statusText}`);
    }

    const artifactData = await artifactResponse.json();

    if (!artifactData.artifacts || artifactData.artifacts.length === 0) {
      throw new Error("No AI response found in artifacts.");
    }

    // Retrieve the latest AI-generated response
    const artifactURL = artifactData.artifacts[0].archive_download_url;

    const aiResponse = await fetch(artifactURL, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`
      }
    });

    if (!aiResponse.ok) {
      throw new Error(`Failed to fetch AI response: ${aiResponse.status} ${aiResponse.statusText}`);
    }

    // 4) This response is a JSON file with the HF text
    const jsonData = await aiResponse.json();
    console.log("AI Response:", jsonData);

    let aiReply = jsonData.generated_text || "I couldn't process that. Try again!";

    // Clean up custom markers if you had them
    if (aiReply.includes("BEGIN RESPONSE:")) {
      aiReply = aiReply.split("BEGIN RESPONSE:")[1]?.trim();
    }
    if (aiReply.includes("END RESPONSE")) {
      aiReply = aiReply.split("END RESPONSE")[0]?.trim();
    }

    addMessage('AI', aiReply, true);

  } catch (error) {
    console.error("Error fetching AI response:", error);
    addMessage('AI', "An error occurred. Please try again later.", true);
  }
}
