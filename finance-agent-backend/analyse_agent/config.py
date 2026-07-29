from langchain.chat_models import init_chat_model
from langchain_nvidia_ai_endpoints import ChatNVIDIA
import os

DEFAULT_RECURSION_LIMIT = 15

def get_graph_config(thread_id: str) -> dict:
    """
    Generates a unique LangGraph configuration dictionary for a given user session.
    """
    return {
        "recursion_limit": DEFAULT_RECURSION_LIMIT,
        "configurable": {
            # Standard composite key pattern: combines user and session
            "thread_id": thread_id
        }
    }

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
LANGSMITH_TRACING = os.getenv("LANGSMITH_TRACING")

# 2. Tell the SDK where to send the traces (Default endpoint)
LANGSMITH_ENDPOINT = os.getenv("LANGSMITH_ENDPOINT")
LANGSMITH_API_KEY = os.getenv('LANGSMITH_API_KEY')
LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT")


analysis_model = ChatNVIDIA(
  model="nvidia/nemotron-3-ultra-550b-a55b",
  temperature=0,
)

chat_model = init_chat_model(
    "google_genai:gemini-2.5-flash",
    temperature=0,
)