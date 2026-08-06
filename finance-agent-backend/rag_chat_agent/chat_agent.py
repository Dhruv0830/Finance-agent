import json
import asyncio
from langchain_core.messages import AIMessageChunk, AIMessage
from analyse_agent.db import record_thread_message 
from .builder import get_chat_graph
from typing import AsyncGenerator

async def chat_with_report(input_data: dict, config: dict) -> AsyncGenerator[str, None] :
    """
    1. Yields real-time LLM token chunks via astream(stream_mode="messages").
    2. Accumulates the full assistant response.
    3. Saves user and assistant messages into `thread_messages` DB table upon completion.
    """
    chat_agent = await get_chat_graph()
    
    thread_id = config.get("configurable", {}).get("thread_id")
    
    user_content = ""
    if "chat_messages" in input_data and input_data["chat_messages"]:
        last_msg = input_data["chat_messages"][-1]
        user_content = last_msg[1] if isinstance(last_msg, tuple) else getattr(last_msg, "content", str(last_msg))

    # 2. Save the user response with role "chat_user" before streaming
    if thread_id and user_content:
        await record_thread_message(
            thread_id=thread_id,
            role="chat_user",
            content=user_content,
            node_name="chat"
        )

    full_assistant_response = ""
    
    try:
        # 3. Stream tokens using astream
        async for chunk, metadata in chat_agent.astream(
            input_data, 
            config=config, 
            stream_mode="messages"
        ):
            # 1. ONLY process chunks originating from the 'agent' node
            if metadata.get("langgraph_node") != "chat":
                continue

            # 2. Skip chunks generated while the LLM is constructing tool call arguments
            tool_chunks = getattr(chunk, "tool_call_chunks", None)
            if tool_chunks and len(tool_chunks) > 0:
                continue

            # 3. Extract text content safely
            content = getattr(chunk, "content", "")

            # Handle string tokens
            if isinstance(content, str) and content:
                full_assistant_response += content
                yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                
            # Handle block/list tokens (some models stream as list dicts)
            elif isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text_val = block.get("text", "")
                        if text_val:
                            full_assistant_response += text_val
                            yield f"data: {json.dumps({'type': 'token', 'content': text_val})}\n\n"

        # Yield completion event
        yield f"data: {json.dumps({'type': 'DONE'})}\n\n"
        if thread_id and full_assistant_response:
            await record_thread_message(
                thread_id=thread_id,
                role="chat_agent",
                content=full_assistant_response,
                node_name="chat"
            )
            
    except asyncio.CancelledError:
        print("Client disconnected from chat stream.")
        raise
    except Exception as e:
        print(f"Error in chat stream: {e}")
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        
def extract_text_content(content) -> str:
    """Safely extracts text whether content is a string or a list of blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, str):
                text_parts.append(item)
            elif isinstance(item, dict) and item.get("type") == "text":
                text_parts.append(item.get("text", ""))
        return "".join(text_parts)
    return ""