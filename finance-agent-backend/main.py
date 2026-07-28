import asyncio
import json
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from analyse_agent.checkpointer import init_checkpointer
from sse_starlette.sse import EventSourceResponse
from analyse_agent.analyse_agent import run_finance_analysis, resume_finance_analysis
from dotenv import load_dotenv
from analyse_agent.config import get_graph_config 
import os

# Load variables from backend/.env
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs ONCE when the app starts
    await init_checkpointer()
    yield
    # Cleanup on shutdown if needed

# Access your secrets

app = FastAPI(title="FinAgent SSE Backend", version="1.0.0", lifespan=lifespan)

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
    prompt: str
    user_id: str
    thread_id: str
    model: str = "gpt-4o"
    
class ResumeRequest(BaseModel):
    user_id: str
    thread_id: str
    user_response: dict 
    model: str = "gpt-4o"

class AnalyseRequest(BaseModel):
    prompt: str
    user_id: str
    thread_id: str
    model: str = "gpt-4o"


# --- SSE Event Generators ---

async def chat_stream_generator(prompt: str, config: dict) -> AsyncGenerator[dict, None]:
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


async def analyse_stream_generator(prompt: str, config: dict) -> AsyncGenerator[dict, None]:
    """
    Simulates a multi-agent analysis workflow streaming state transitions & progress updates.
    """
    
    initial_state = {
        "messages": [{"role": "user", "content": prompt}]
    }
    
    async for chunk in run_finance_analysis(initial_state, config=config):
        # sse-starlette natively converts dictionaries with "event" and "data" keys to SSE format
        yield {
            "event": chunk["event"],
            "data": chunk["data"]
        }


async def resume_stream_generator(user_response: dict, config: dict) -> AsyncGenerator[dict, None]:
    """
    Streams progress and state transitions when resuming an interrupted graph execution.
    """
    # resume_finance_analysis invokes:
    # finance_graph.astream(Command(resume=user_response), config=config, stream_mode="updates")
    async for chunk in resume_finance_analysis(user_response=user_response, config=config):
        yield {
            "event": chunk["event"],
            "data": chunk["data"]
        }



# --- API Routes ---

#RAG Agent endpoint
@app.post("/api/finance/chat")
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
@app.post("/api/finance/analyse")
async def analyse_finance_endpoint(request: AnalyseRequest):
    """
    Streams structured progress updates during complex multi-agent analysis.
    """
    prompt = request.prompt 
    user_id = request.user_id
    thread_id = request.thread_id
    
    config = get_graph_config(user_id = user_id, thread_id = thread_id)
    
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    
    if not user_id.strip():
        raise HTTPException(status_code=400, detail="User ID cannot be empty.")
    
    if not thread_id.strip():
        raise HTTPException(status_code=400, detail="Thread ID cannot be empty.")

    return EventSourceResponse(
        analyse_stream_generator(prompt=prompt, config= config),
        media_type="text/event-stream"
    )


#FinAgent Resume endpoint
@app.post("/api/finance/resume")
async def resume_finance_endpoint(request: ResumeRequest):
    # Match the EXACT same thread_id used when the interrupt occurred
    
    user_id = request.user_id
    thread_id = request.thread_id
    user_response = request.user_response
    
    config = get_graph_config(user_id = user_id, thread_id = thread_id)
    
    if not user_response:
            raise HTTPException(status_code=400, detail="User response cannot be empty.")
        
    if not user_id.strip():
        raise HTTPException(status_code=400, detail="User ID cannot be empty.")
    
    if not thread_id.strip():
        raise HTTPException(status_code=400, detail="Thread ID cannot be empty.")

    return EventSourceResponse(
        resume_stream_generator(user_response=user_response, config=config),
        media_type="text/event-stream"
    )
    
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)