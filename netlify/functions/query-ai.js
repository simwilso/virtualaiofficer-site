// netlify/functions/query-ai.js

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function (event, context) {
  // Only allow POST requests (optional safeguard)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed. Use POST." }),
    };
  }

  try {
    // Parse the incoming request body
    const { user_query } = JSON.parse(event.body || '{}');
    if (!user_query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing 'user_query' in request body." }),
      };
    }

    // 1) Trigger GitHub Actions workflow via "repository_dispatch"
    // We read the token from Netlify environment variables (not in front-end!)
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
    const REPO_OWNER = "simwilso";
    const REPO_NAME = "virtualaiofficer-site";

    // Fire off the dispatch
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

    console.log("Repository Dispatch triggered successfully.");

    // 2) Wait for 10 seconds to let GH Action do its job (naive approach)
    //    You could poll the GH Actions run instead, but we'll keep it simple.
    await new Promise(res => setTimeout(res, 10000));

    // 3) Fetch AI-generated response from GH Actions artifacts
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

    // We'll just grab the first artifact in the list
    const latestArtifact = artifactData.artifacts[0];
    const artifactURL = latestArtifact.archive_download_url;

    // 4) Download the artifact, which should be a JSON file with the HF text
    response = await fetch(artifactURL, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch AI response artifact: ${response.status} ${response.statusText}`);
    }

    const jsonData = await response.json();
    let aiReply = jsonData.generated_text || "I couldn't process that. Try again!";

    // 5) Return the text response to the front-end
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
