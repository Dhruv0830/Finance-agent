from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, APIRouter, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv
load_dotenv()
from analyse_agent.generators import analyse_stream_generator, resume_stream_generator, chat_stream_generator
from analyse_agent.db import get_user_conversation, create_thread_and_initial_message, update_thread_and_log_resume_input, get_user_threads
from auth import get_current_user_id 
import json
from analyse_agent.db import lifespan 
from demo import router as demo_router
# Load variables from backend/.env

GRAPH_NODES = {
  "stock_search": "1. Extract Ticker",
  "ask_human": "2. Human Validation",

  "india_fundamental": "3. Market Analysis",
  "india_X_reddit": "4. Social Buzz",
  "us_fundamental": "3. Market Analysis",
  "us_X_reddit": "4. Social Buzz",

  "state_consolidation": "5. Aggregating Data",
  "social_momentum_analyst": "6. Social Momentum Analyst",

  "quantitative_valuation_analyst": "7. Quantitative Valuation Analyst",

  "orchestrator": "8. Aggregating Results",

  "action_payload": "9. Generating Verdict",
}

app = FastAPI(title="FinAgent SSE Backend", version="1.0.0", lifespan=lifespan)

# Enable CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Demo routes
# app.include_router(demo_router)
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

class ThreadHistoryResponse(BaseModel):
    thread_id: str
    nodes: List[Dict[str, Any]] = []
    messages: List[Dict[str, Any]] = []
    final_report: Optional[Dict[str, Any]] = None

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
    

#All of the user's conversation threads 
@app.get("/api/finance/threads")
async def get_threads_endpoint(user_id: str = Depends(get_current_user_id)):
    """
    Fetches all historical conversation threads for the authenticated user.
    """
    
    try:
        threads = await get_user_threads(user_id=user_id)
        return {"threads": threads}
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve conversation history: {str(err)}"
        )


@app.get("/api/finance/threads/{thread_id}/")
async def get_conversation_thread(thread_id: str, user_id : str = Depends(get_current_user_id)):
    "To load the user conversation tied to a thread_id"
    
    if not user_id.strip():
        raise HTTPException(status_code=400, detail="User ID cannot be empty.")
        
    if not thread_id.strip():
            raise HTTPException(status_code=400, detail="Thread ID cannot be empty.")
    
    try:
        messages = await get_user_conversation(thread_id=thread_id)
        agent_graph = []
        final_report = {}

        for item in messages:
            if item["role"] != "assistant":
                continue

            # Extract final_report safely from dict
            if item["node_name"] == "action_payload":
                content = item.get("content") or {}
                state = content.get("state") or {}
                final_report = state.get("final_action_payload", {})
                sources = final_report.get("source_citations", [])
                parsed_citations = []
                for c in sources:
                    if isinstance(c, str) and c.strip():  # Ensure string is not empty or whitespace
                        try:
                            parsed_citations.append(json.loads(c))
                        except json.JSONDecodeError:
                            parsed_citations.append(c)   # Fallback: keep raw string if it's not valid JSON
                    elif c:
                        parsed_citations.append(c)

                final_report = {
                    **final_report,
                    "source_citations": parsed_citations
                }

            # Build agent_graph
            agent_graph.append({
                "node_name": item["node_name"],
                "label": GRAPH_NODES.get(item["node_name"], item["node_name"]),
                "status": "completed",
                "nodeStreamText": item["content"] if item["node_name"] != "action_payload" else "",
            })
        
        return {
            "agent_graph" : agent_graph,
            "final_report": final_report,
            "chat": {}
            }
    
    except Exception as err:
        raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to retrieve conversation history: {str(err)}"
                )
        
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)