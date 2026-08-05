from langgraph.graph import START, END, StateGraph
from analyse_agent.db import get_checkpointer
from .schemas import ChatState
from .nodes import chat_node

builder = StateGraph(ChatState)

builder.add_node("chat", chat_node)

builder.add_edge(START, "chat")
builder.add_edge("chat", END)

async def get_chat_graph():
    checkpointer = get_checkpointer()
    return builder.compile(checkpointer=checkpointer)