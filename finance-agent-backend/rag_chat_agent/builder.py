from langgraph.graph import START, END, StateGraph
from analyse_agent.db import get_checkpointer
from langgraph.prebuilt import ToolNode
from .schemas import ChatState
from .tools import tool_array
from .nodes import chat_node, custom_tools_condition

builder = StateGraph(ChatState)

builder.add_node("chat", chat_node)
builder.add_node("tools", ToolNode(tool_array, messages_key="chat_messages"))

builder.add_edge(START, "chat")
builder.add_conditional_edges(
    "chat", 
    custom_tools_condition,
    {"tools": "tools", END: END}
)
builder.add_edge("tools", "chat")

async def get_chat_graph():
    checkpointer = get_checkpointer()
    return builder.compile(checkpointer=checkpointer)