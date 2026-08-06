from pydantic import BaseModel, Field
from typing import Annotated, Literal, Optional, List, Dict, Any
from langchain.messages import AnyMessage
from langgraph.graph.message import add_messages

class ChatState(BaseModel):
    chat_messages: Annotated[List[AnyMessage], add_messages] = Field(default_factory=list)
    final_action_payload: Optional[Dict[str, Any]] = None
    
class ChatOutput(BaseModel):
    output : str