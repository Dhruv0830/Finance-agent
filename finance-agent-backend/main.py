import asyncio
import json
from typing import AsyncGenerator
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv
import os

# Load variables from backend/.env
load_dotenv()

# Access your secrets

app = FastAPI(title="FinAgent SSE Backend", version="1.0.0")

# Enable CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request Schemas ---

class ChatRequest(BaseModel):
    message: str
    model: str = "gpt-4o"


class AnalyseRequest(BaseModel):
    message: str


# --- SSE Event Generators ---

async def chat_stream_generator(prompt: str) -> AsyncGenerator[dict, None]:
    """
    Simulates token-by-token streaming from an LLM.
    Replace the dummy loop with your LLM provider call (e.g., OpenAI/LangChain async stream).
    """
    tokens = [] #This is where the agent call is placed 

    for token in tokens:
        yield {
            "event": "message",
            "data": json.dumps({"token": token})
        }

    # Signal stream completion
    yield {
        "event": "done",
        "data": json.dumps({"status": "complete"})
    }


async def analyse_stream_generator(prompt: str) -> AsyncGenerator[dict, None]:
    """
    Simulates a multi-agent analysis workflow streaming state transitions & progress updates.
    """

    steps = []  #Agent call is placed here
    #   [  {"step": 1, "status": "Fetching market data & SEC filings...", "progress": 25},
    #     {"step": 2, "status": "Running sentiment analysis on news feeds...", "progress": 50},
    #     {"step": 3, "status": "Calculating quantitative risk & momentum scores...", "progress": 75},
    #     {"step": 4, "status": "Synthesizing final multi-agent report...", "progress": 90},
    # ]

    for step_info in steps:
        yield {
            "event": "progress",
            "data": json.dumps(step_info)
        }

    # Final result event payload
    
    final_report = {
    "ticker": str ,
    "action": str ,
    "confidence_score": float ,
    "risk_level": str ,
    "reasoning_summary": str ,  
    "key_catalysts": [str] ,
    "invalidation_rules": [str] ,
    }

    yield {
        "event": "result",
        "data": json.dumps(final_report)
    }


# --- API Routes ---

#RAG Agent endpoint
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Streams conversational model responses using SSE.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    return EventSourceResponse(
        chat_stream_generator(request.message),
        media_type="text/event-stream"
    )

#FinAgent endpoint
@app.post("/api/analyse")
async def analyse_endpoint(request: AnalyseRequest):
    """
    Streams structured progress updates during complex multi-agent analysis.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    return EventSourceResponse(
        analyse_stream_generator(request.message),
        media_type="text/event-stream"
    )


# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)