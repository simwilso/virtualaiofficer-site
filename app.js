// app.js
import express from 'express';
import axios from 'axios';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Use JSON parser middleware
app.use(express.json());

// Analyze issue using OpenAI's Chat Completions API
async function analyzeIssue(issueDescription) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("Missing OpenAI API key. Please set OPENAI_API_KEY.");
  }
  
  const messages = [
    {
      role: "system",
      content: "You are an expert developer and UX designer. Provide a concise suggestion to improve a website based on the issue provided."
    },
    {
      role: "user",
      content: `Issue: "${issueDescription}". Provide a concise suggestion:`
    }
  ];
  
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 100,
        temperature: 0.3,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      },
      {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    // Log detailed error info for debugging
    if (error.response) {
      console.error("OpenAI API Error:", error.response.data);
      throw new Error(`OpenAI API error: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Generate code diff based on a suggestion
async function generateCodeDiff(suggestion) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("Missing OpenAI API key. Please set OPENAI_API_KEY.");
  }
  
  const messages = [
    {
      role: "system",
      content: "You are an expert developer. Given a suggestion to improve a website, generate only the code changes in a diff format (or as a code snippet) that implements the suggestion. Do not include any commentary; output only the code."
    },
    {
      role: "user",
      content: `Suggestion: "${suggestion}"`
    }
  ];
  
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 150,
      temperature: 0.2
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data.choices[0].message.content.trim();
}

// Review the generated code diff for issues or improvements.
// The agent should output only "Approved" if everything looks good,
// or list any potential issues.
async function reviewCodeDiff(codeDiff) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("Missing OpenAI API key. Please set OPENAI_API_KEY.");
  }

  // Build a messages array for the Chat Completions API.
  // The prompt instructs the model to review the provided code diff.
  const messages = [
    {
      role: "system",
      content:
        "You are an expert software engineer and code reviewer. Review the following code diff for potential issues, bugs, or improvements. If there are no issues, simply respond with 'Approved'. Otherwise, list the issues briefly. Do not include any extra commentary."
    },
    {
      role: "user",
      content: `Code Diff:\n${codeDiff}\nReview:`
    }
  ];

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-3.5-turbo",
      messages: messages,
      max_tokens: 100,
      temperature: 0.0, // Lower temperature for deterministic review results
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    },
    {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices[0].message.content.trim();
}


// GitHub integration: push changes and create a pull request
async function pushChangesToGitHub(codeDiff, branchName, commitMessage) {
  const githubToken = process.env.GITHUB_TOKEN;
  const githubOwner = process.env.GITHUB_OWNER;
  const githubRepo = process.env.GITHUB_REPO;
  if (!githubToken || !githubOwner || !githubRepo) {
    throw new Error("Missing GitHub environment variables (GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO)");
  }
  
  // Initialize Octokit with our fetch implementation.
  const octokit = new Octokit({ auth: githubToken, request: { fetch } });
  
  // Get default branch (assumed "main")
  const { data: repoData } = await octokit.repos.get({
    owner: githubOwner,
    repo: githubRepo,
  });
  const defaultBranch = repoData.default_branch || "main";
  
  // Get latest commit SHA of default branch using getBranch
  const { data: branchData } = await octokit.repos.getBranch({
    owner: githubOwner,
    repo: githubRepo,
    branch: defaultBranch,
  });
  const baseSha = branchData.commit.sha;
  
  // Create a new branch name if not provided
  const newBranch = branchName || `auto-update-${Date.now()}`;
  
  // Create the new branch from the default branch
  await octokit.git.createRef({
    owner: githubOwner,
    repo: githubRepo,
    ref: `refs/heads/${newBranch}`,
    sha: baseSha,
  });
  
  // Define the file path where the code diff will be stored.
  const filePath = "proposed_changes.txt";
  const contentEncoded = Buffer.from(codeDiff).toString('base64');

  // Try to get the existing file SHA on the new branch (if the file already exists)
  let fileSha;
  try {
    const { data: fileData } = await octokit.repos.getContent({
      owner: githubOwner,
      repo: githubRepo,
      path: filePath,
      ref: newBranch,
    });
    fileSha = fileData.sha;
  } catch (error) {
    // If not found, this error is expected; we will create the file.
    fileSha = undefined;
  }
  
  // Prepare parameters for createOrUpdateFileContents.
  const updateParams = {
    owner: githubOwner,
    repo: githubRepo,
    path: filePath,
    message: commitMessage || "Automated update: proposed code changes",
    content: contentEncoded,
    branch: newBranch,
  };
  if (fileSha) {
    updateParams.sha = fileSha;
  }
  
  // Create or update the file on the new branch
  await octokit.repos.createOrUpdateFileContents(updateParams);
  
  // Create a pull request from the new branch to the default branch
  const { data: prData } = await octokit.pulls.create({
    owner: githubOwner,
    repo: githubRepo,
    title: commitMessage || "Automated update: proposed code changes",
    head: newBranch,
    base: defaultBranch,
    body: "This pull request contains automated code changes generated by the AI Orchestrator.",
  });
  
  return prData.html_url;
}


// Endpoint to analyze an issue
app.post('/processIssue', async (req, res) => {
  const { issue } = req.body;
  if (!issue) {
    return res.status(400).json({ error: "Missing 'issue' in request body" });
  }
  try {
    const suggestion = await analyzeIssue(issue);
    res.json({ suggestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to generate code from a suggestion
app.post('/generateCode', async (req, res) => {
  const { suggestion } = req.body;
  if (!suggestion) {
    return res.status(400).json({ error: "Missing 'suggestion' in request body" });
  }
  try {
    const codeDiff = await generateCodeDiff(suggestion);
    res.json({ codeDiff });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to review a code diff using the reviewCodeDiff function.
app.post("/reviewCode", async (req, res) => {
  const { codeDiff } = req.body;
  if (!codeDiff) {
    return res.status(400).json({ error: "Missing 'codeDiff' in request body" });
  }
  try {
    const review = await reviewCodeDiff(codeDiff);
    res.json({ review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// Endpoint to push code changes to GitHub and create a pull request
app.post('/pushChanges', async (req, res) => {
  const { codeDiff, branchName, commitMessage } = req.body;
  if (!codeDiff) {
    return res.status(400).json({ error: "Missing 'codeDiff' in request body" });
  }
  try {
    const prUrl = await pushChangesToGitHub(codeDiff, branchName, commitMessage);
    res.json({ prUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to fully automate the issue handling workflow:
// It takes an issue description, generates a suggestion, produces a code diff,
// reviews the code diff, and if approved, pushes the changes to GitHub.
app.post('/automateIssue', async (req, res) => {
  const { issue } = req.body;
  if (!issue) {
    return res.status(400).json({ error: "Missing 'issue' in request body" });
  }
  try {
    // 1. Analyze the issue to get a suggestion.
    const suggestion = await analyzeIssue(issue);
    console.log("Suggestion:", suggestion);

    // 2. Generate code diff based on the suggestion.
    const codeDiff = await generateCodeDiff(suggestion);
    console.log("Generated Code Diff:", codeDiff);

    // 3. Review the code diff.
    const review = await reviewCodeDiff(codeDiff);
    console.log("Review Result:", review);

    // 4. Check if the review is approved.
    // Here we assume that if the review response equals "Approved" (case-insensitive), it’s good to go.
    if (review.toLowerCase() === "approved") {
      // Prepare a commit message.
      const commitMessage = `Auto-update for issue: ${issue}`;
      
      // 5. Push the changes to GitHub and create a pull request.
      const prUrl = await pushChangesToGitHub(codeDiff, undefined, commitMessage);
      console.log("Pull Request URL:", prUrl);
      
      // Return the full chain of results.
      res.json({ 
        prUrl, 
        suggestion, 
        codeDiff,
        review
      });
    } else {
      // If not approved, return the review feedback for manual review.
      res.json({ 
        suggestion, 
        codeDiff,
        review,
        message: "The generated code diff did not pass automated review. Please review manually."
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


app.listen(port, () => {
  console.log(`AI Orchestrator service listening on port ${port}`);
});

// Export the app for testing purposes
export default app;

