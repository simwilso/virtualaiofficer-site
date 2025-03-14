import os
import json

# Import smolagent components
from smolagent import Agent
from smolagent.llm import OllamaLLM

# Function to load the knowledge base
def load_knowledge_base():
    # __file__ is netlify/functions/query-ai.py; adjust the relative path to get to your knowledge_base.md at the repo root.
    kb_path = os.path.join(os.path.dirname(__file__), '../../knowledge_base.md')
    with open(kb_path, 'r') as f:
        return f.read()

# Load the knowledge base once per function instance.
knowledge_base = load_knowledge_base()

# Retrieve model configuration from environment variables.
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "your-ollama-model")
OLLAMA_API_KEY = os.environ.get("HF_API_KEY", "your-api-key")

# Initialize the LLM and agent.
llm = OllamaLLM(model=OLLAMA_MODEL, api_key=OLLAMA_API_KEY)
agent = Agent(llm=llm, knowledge_base=knowledge_base)

def handler(event, context):
    try:
        body = json.loads(event.get("body", "{}"))
        user_query = body.get("user_query", "")
        if not user_query:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing 'user_query' parameter."})
            }

        # Get the answer from smolagent.
        answer = agent.ask(user_query)

        return {
            "statusCode": 200,
            "body": json.dumps({"aiReply": answer})
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
