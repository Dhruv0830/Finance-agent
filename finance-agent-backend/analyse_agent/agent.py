# agents/analyse_agent/runner.py
import json
from typing import AsyncGenerator
from langgraph.types import Command
from .builder import get_finance_graph  # Function that returns uncompiled StateGraph

NODE_NAMES = {
  "stock_search",
  "ask_human", 

  "india_fundamental",
  "india_X_reddit",
  "us_fundamental",
  "us_X_reddit",

  "state_consolidation",
  "social_momentum_analyst",

  "quantitative_valuation_analyst",

  "orchestrator",

  "action_payload"
}

async def run_finance_analysis(input_data: dict, config: dict) -> AsyncGenerator[dict, None]:
    """
    Executes an initial analysis run for a specific user thread.
    
    :param input_data: Initial state inputs (e.g., {"messages": [{"role": "user", "content": "Analyze NVDA stock"}]})
    :param config: Dict containing thread isolation (e.g., {"configurable": {"thread_id": "user_123_thread_abc"}})
    """
    
    finance_graph = await get_finance_graph()
    
    # 1. Stream normal execution
    async for event in finance_graph.astream_events(input_data, config=config, stream_mode="updates", version="v2"):
        kind = event["event"]
        node_name = event["name"]
        
        if kind == "on_chain_start" and node_name in NODE_NAMES:
            yield {
                "event": "node_update",
                "data": json.dumps({"node": node_name, "status": "running"})
            }
        elif kind == "on_chain_end" and node_name in NODE_NAMES:
            output_data = event["data"].get("output", {})
            
            yield {
                "event": "node_update",
                "data": json.dumps({
                    "node": node_name, 
                    "status": "completed",
                    "state": output_data
                }, default=str) # default=str prevents serialization crashes
            }

    # 2. Check if execution paused on an active Human-in-the-Loop interrupt
    current_state = await finance_graph.aget_state(config)
    if current_state.tasks and current_state.tasks[0].interrupts:
        interrupt_info = current_state.tasks[0].interrupts[0].value
        yield {
            "event": "interrupt",
            "data": json.dumps({
                "node": current_state.tasks[0].name,
                "message": interrupt_info.get("message", "Human input required"),
                "options": interrupt_info.get("options", [])
            })
        }
    else:
        yield {
            "event": "complete",
            "data": json.dumps({"status": "finished"})
        }


async def resume_finance_analysis(user_response: dict, config: dict) -> AsyncGenerator[dict, None]:
    """
    Resumes an interrupted graph execution using a human response payload.
    
    :param user_response: Value passed back from human input (e.g., {"approve": True})
    :param config: Must contain the EXACT SAME thread_id to resume the paused thread state
    """
    
    finance_graph = await get_finance_graph()
    
    async for event in finance_graph.astream_events(Command(resume=user_response), config=config, stream_mode="updates", version="v2"):
        kind = event["event"]
        node_name = event["name"]
        
        if kind == "on_chain_start" and node_name in NODE_NAMES:
            yield {
                "event": "node_update",
                "data": json.dumps({"node": node_name, "status": "running"})
            }
            
        elif kind == "on_chain_end" and node_name in NODE_NAMES:
            output_data = event["data"].get("output", {})
            
            yield {
                "event": "node_update",
                "data": json.dumps({
                    "node": node_name, 
                    "status": "completed",
                    "state": output_data
                }, default=str) # default=str prevents serialization crashes
            }
            
    yield {
        "event": "complete",
        "data": json.dumps({"status": "finished"})
    }