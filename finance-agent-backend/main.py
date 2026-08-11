from contextlib import asynccontextmanager
import uuid
import re
from fastapi import FastAPI, HTTPException, APIRouter, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv
load_dotenv()
from rag_chat_agent.chat_agent import chat_with_report
from analyse_agent.generators import analyse_stream_generator, resume_stream_generator
from analyse_agent.db import get_user_conversation, create_thread_and_initial_message, update_thread_and_log_resume_input, get_user_threads
from auth import get_current_user_id 
import json
from analyse_agent.db import lifespan
from rag_chat_agent.config import get_graph_config
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
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    input_data = {
        "chat_messages": [("user", request.prompt)]
    }

    config = get_graph_config(thread_id= request.thread_id)

    # Pass generator directly to StreamingResponse
    return StreamingResponse(
        chat_with_report(input_data, config),
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
        node_name="ask_human"
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
        final_report = None
        chat = []
        options = None
        
        for item in messages:
            if item['node_name'] == 'chat':
                if item["role"] == "chat_user":
                    id = str(uuid.uuid4())
                    content = item.get("content")
                    chat.append({
                        "id" : id,
                        "role" : "chat_user",
                        "content" : content
                    })
                
                else:
                    id = str(uuid.uuid4())
                    content = item.get("content")
                    chat.append({
                        "id" : id,
                        "role" : "chat_agent",
                        "content" : content
                    })
            else:
                if item["role"] == "user" :
                    continue
                
                # Extract final_report safely from dict
                elif item["node_name"] == "action_payload":
                    content = item.get("content") or {}
                    state = content.get("state") or {}
                    final_report = state.get("final_action_payload", {})
                    sources = final_report.get("source_citations", [])
                    parsed_citations = sources
                    # KEYS = ["category", "source_name", "title", "url", "content"]
                    # for raw_string in sources:
                    #     data = {}
                    #     for key in KEYS:
                    #         # Matches key='value' or key="value"
                    #         pattern = rf"{key}=(['\"])(.*?)\1(?=\s+\w+=|$)"
                    #         match = re.search(pattern, raw_string)
                    #         if match:
                    #             data[key] = match.group(2)
                    #     parsed_citations.append(data)
                        
                    final_report = {
                        **final_report,
                        "source_citations": parsed_citations
                    }

                # Build agent_graph
                agent_graph.append({
                    "name": item["node_name"],
                    "label": GRAPH_NODES.get(item["node_name"], item["node_name"]),
                    "status": "completed",
                    "nodeStreamText": json.dumps(item["content"]) if item["node_name"] != "action_payload" else "",
                })
                
                if item["node_name"] == "stock_search":
                    # print("Stock node", item)
                    options = item["content"]["state"]["search_options"]
                    agent_graph.append({
                                        "name": "ask_human",
                                        "label": GRAPH_NODES.get("ask_human"),
                                        "status": "running",
                                        "nodeStreamText": "Please select a stock from the options given above: ",
                                    })     
                
        if agent_graph:
            last_node = agent_graph[-1].get("name")

            if last_node == "action_payload":
                # 1. Collect all indices where node_name is 'ask_human'
                ask_human_indices = [
                    i for i, item in enumerate(agent_graph) 
                    if item.get("name") == "ask_human"
                ]
                
                # 2. If there are multiple ask_human nodes, keep only the last one
                if len(ask_human_indices) > 1:
                    indices_to_remove = set(ask_human_indices[:-1])
                    agent_graph = [
                        item for i, item in enumerate(agent_graph) 
                        if i not in indices_to_remove
                    ]

            else:
                # If run was interrupted, slice up to the FIRST ask_human node
                last_ask_human_idx = -1
                for i in range(len(agent_graph)):
                    if agent_graph[i].get("name") == "ask_human":
                        fist_ask_human_idx = i
                        break
                        
                if fist_ask_human_idx != -1:
                    agent_graph = agent_graph[: fist_ask_human_idx + 1]
            
        return {
            "agent_graph" : agent_graph,
            "final_report": final_report,
            "chat": chat,
            "options": options
            }
        
    
    except Exception as err:
        raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to retrieve conversation history: {str(err)}"
                )
        
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)