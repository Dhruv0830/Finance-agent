import json
from .config import get_graph_config
from .agent import run_finance_analysis, resume_finance_analysis
from typing import AsyncGenerator
from .db import (
    record_thread_message,
    complete_thread_analysis
)

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


async def analyse_stream_generator(user_id: str, thread_id: str, prompt: str) -> AsyncGenerator[dict, None]:
    """
    1. Streams graph node updates and interrupts over SSE.
    """
    
    yield {
        "event": "thread_created",
        "data": json.dumps({
            "thread_id": thread_id,
            "status": "started"
        })
    }
    
    # 1. Build graph config using the thread_id
    config = get_graph_config(thread_id)
    
    initial_input = {
        "messages": [{"role": "user", "content": prompt}]
    }
    
    try:
        # Stream events from LangGraph runner
        async for chunk in run_finance_analysis(input_data=initial_input, config=config):
            event_type = chunk["event"]
            data_payload = json.loads(chunk["data"])

            # Log intermediate node completion steps to thread_messages table
            if event_type == "node_update":
                await record_thread_message(
                    thread_id=thread_id,
                    role="assistant",
                    node_name=data_payload.get("node"),
                    content={"type": "node_update", "state": data_payload.get("state")}
                )

            # Stream event to client UI
            yield {
                "event": event_type,
                "data": chunk["data"]
            }
    
    except Exception as err:
        # Log system error event to application DB
        await record_thread_message(
            thread_id=thread_id,
            role="system",
            node_name="graph_runner",
            content={"type": "error", "error_message": str(err)}
        )
        yield {
            "event": "error",
            "data": json.dumps({"message": str(err)})
        }


async def resume_stream_generator(user_response: dict, thread_id: str) -> AsyncGenerator[dict, None]:
    """
    Streams progress and state transitions when resuming an interrupted graph execution,
    persisting node updates to the thread_messages table.
    """
    # 1. Build graph config using the thread_id
    config = get_graph_config(thread_id)

    try:
        # 2. Iterate over streamed chunks from the resume runner
        async for chunk in resume_finance_analysis(user_response=user_response, config=config):
            event_type = chunk["event"]

            # Normalize data_payload regardless of whether chunk["data"] is stringified JSON or a dict
            if isinstance(chunk["data"], str):
                data_payload = json.loads(chunk["data"])
                raw_data_str = chunk["data"]
            else:
                data_payload = chunk["data"]
                raw_data_str = json.dumps(chunk["data"])

            # 3. Log intermediate node updates into thread_messages
            if event_type == "node_update":
                node_name = data_payload.get("node")
                state = data_payload.get("state", {})
                await record_thread_message(
                    thread_id=thread_id,
                    role="assistant",
                    node_name=node_name,
                    content={
                        "type": "node_update",
                        "state": state
                    }
                )
                
                # 2. When the graph hits the final node, just flip the thread mode to 'CHAT'
                if node_name == "action_payload":
                    payload = state.get("final_action_payload") or {}
                    
                    await complete_thread_analysis(
                        thread_id=thread_id,
                    )

            # 4. Stream event out over SSE
            yield {
                "event": event_type,
                "data": raw_data_str
            }

    except Exception as err:
        # 5. Log system runtime exceptions to application DB
        await record_thread_message(
            thread_id=thread_id,
            role="system",
            node_name="graph_resume_runner",
            content={"type": "error", "error_message": str(err)}
        )

        # Emit SSE error event to frontend
        yield {
            "event": "error",
            "data": json.dumps({"message": str(err)})
        }

