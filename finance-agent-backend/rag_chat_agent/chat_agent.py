import json
import asyncio
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
    if "messages" in input_data and input_data["messages"]:
        last_msg = input_data["messages"][-1]
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
            content = getattr(chunk, "content", "")
            if content:
                full_assistant_response += content
                yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"

        # 4. Save the full assistant message with role "chat_agent"
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
    finally:
        # Signal stream completion to client
        yield "data: [DONE]\n\n"