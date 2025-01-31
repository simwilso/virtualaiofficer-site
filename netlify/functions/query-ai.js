// netlify/functions/query-ai.js

// We dynamically import "node-fetch" for Netlify compatibility.
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async function (event, context) {
  // 1) Only allow POST requests to this function (optional safeguard)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed. Use POST." }),
    };
  }

  try {
    // 2) Parse the JSON body to get the user's query
    const { user_query } = JSON.parse(event.body || '{}');
    if (!user_query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing 'user_query' in request body." }),
      };
    }

    // 3) Read the GitHub token from Netlify environment variables (private!)
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
    const REPO_OWNER = "simwilso";
    const REPO_NAME = "virtualaiofficer-site";

    // 4) Trigger GitHub Actions Workflow via repository_dispatch
    const dispatchURL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`;
    let response = await fetch(dispatchURL, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`
      },
      body: JSON.stringify({
        event_type: "query-ai",
        client_payload: { user_query }
      })
    });

    if (!response.ok) {
      throw new Error(`Dispatch failed: ${response.status} ${response.statusText}`);
    }

    console.log("GitHub repository_dispatch triggered successfully.");

    // 5) Naively wait 10s for the workflow to run. (You could poll the run status instead.)
    await new Promise(res => setTimeout(res, 20000));

    // 6) Fetch the artifact from the GitHub Actions run
    const artifactsURL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/artifacts`;
    response = await fetch(artifactsURL, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch artifacts: ${response.status} ${response.statusText}`);
    }

    const artifactData = await response.json();
    if (!artifactData.artifacts || artifactData.artifacts.length === 0) {
      throw new Error("No artifacts found (AI response not generated).");
    }

    // We'll assume the most recent artifact is the one we want
    const artifactURL = artifactData.artifacts[0].archive_download_url;

    // 7) Download the artifact (response.json) from the run
    response = await fetch(artifactURL, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch the AI response artifact: ${response.status} ${response.statusText}`);
    }

    const jsonData = await response.json();
    const aiReply = jsonData.generated_text || "I couldn't process that. Try again!";

    // 8) Return the AI reply back to the front-end
    return {
      statusCode: 200,
      body: JSON.stringify({ aiReply })
    };

  } catch (error) {
    console.error("Error in Netlify Function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

