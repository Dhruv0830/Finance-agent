from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, APIRouter, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from analyse_agent.generators import generate_thread_id, analyse_stream_generator, resume_stream_generator, chat_stream_generator
from dotenv import load_dotenv
from analyse_agent.db import create_thread_and_initial_message, update_thread_and_log_resume_input
from auth import get_current_user_id
from analyse_agent.config import get_graph_config 
from .analyse_agent.db import lifespan 
# Load variables from backend/.env
load_dotenv()

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
    thread_id: str
    model: str = "gpt-4o"
    
class ResumeRequest(BaseModel):
    user_response: dict 
    thread_id: str
    model: str = "gpt-4o"

class AnalyseRequest(BaseModel):
    prompt: str
    model: str = "gpt-4o"


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
async def analyse_finance_endpoint(request: AnalyseRequest, user_id: str = Depends(get_current_user_id)):
    """
    Streams structured progress updates during complex multi-agent analysis.
    """
    prompt = request.prompt 
    
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    
    if not user_id.strip():
        raise HTTPException(status_code=400, detail="User ID cannot be empty.")
    
    thread_id = await create_thread_and_initial_message(
        user_id=user_id,
        prompt=prompt,
        mode="ANALYSE"
    )

    return EventSourceResponse(
        analyse_stream_generator(prompt=prompt, thread_id=thread_id, user_id=user_id),
        media_type="text/event-stream"
    )


#FinAgent Resume endpoint
@app.post("/api/finance/resume")
async def resume_finance_endpoint(request: ResumeRequest, user_id: str = Depends(get_current_user_id)):
    # Match the EXACT same thread_id used when the interrupt occurred
    
    thread_id = request.thread_id
    user_response = request.user_response
    
    if not user_response:
            raise HTTPException(status_code=400, detail="User response cannot be empty.")
        
    if not thread_id.strip():
        raise HTTPException(status_code=400, detail="Thread ID cannot be empty.")
    
    if not user_id.strip():
        raise HTTPException(status_code=400, detail="User ID cannot be empty.")
    
    success = await update_thread_and_log_resume_input(
        thread_id=thread_id,
        user_id=user_id,
        resume_payload=request.user_response,
        node_name="hitl_node"
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found or user unauthorized to access this thread."
        )

    return EventSourceResponse(
        resume_stream_generator(user_response=user_response, thread_id=thread_id),
        media_type="text/event-stream"
    )
    
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)