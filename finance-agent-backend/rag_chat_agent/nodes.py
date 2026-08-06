from .schemas import ChatState
from typing import Literal
from langgraph.graph import END
from .tools import tool_array
from .config import chat_model
from langchain_core.messages import SystemMessage, AIMessage, ToolMessage

llm_with_tools = chat_model.bind_tools(tool_array)

def chat_node(state: ChatState):
    print("Chat Node: ", state.chat_messages[-1])
    report = {}
    if state.final_action_payload:
        report = state.final_action_payload.copy()
        report.pop("source_citations", None)

    # 1. Define the system instructions including the report context
    system_instruction = f"""You are an expert financial AI assistant answering follow-up questions.
    Here is the final report card data for context:
    {report}

    Answer the user's questions accurately based on this context and previous messages."""

    # 2. Combine the SystemMessage with full conversation history
    # LangGraph's checkpointer has already stored all previous messages in state.messages
    full_conversation = [SystemMessage(content=system_instruction)] + state.chat_messages

    try:
        response = llm_with_tools.invoke(full_conversation)
        return {"chat_messages": [response]}
    except Exception as e:
        print(f"Error in CHAT LLM: {e}")
        return { 
                "chat_messages": AIMessage(content="Sorry, I encountered an error processing your request.")
            }

def custom_tools_condition(state: ChatState) -> Literal["tools", "__end__"]:
    messages = state.chat_messages or []
    if not messages:
        return END
    
    last_message = messages[-1]
    if getattr(last_message, "tool_calls", None):
        return "tools"
    return END

    last_message = state.chat_messages[-1]

    # If the last message is a ToolMessage, loop back so the LLM synthesizes the final answer
    if isinstance(last_message, ToolMessage):
        return "chat"

    # Otherwise, exit the graph
    return "end"