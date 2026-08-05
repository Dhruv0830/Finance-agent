from .schemas import ChatState
from .tools import tool_array
from .prompts import CHAT_AGENT_PROMPT
from .config import chat_model
from langchain_core.messages import HumanMessage, AIMessage

llm_with_tools = chat_model.bind_tools(tool_array)

def chat_node(state: ChatState):
    query = state.messages[-1].content
    print("Chat Node: User Query: ", query)
    
    formatted_prompt = CHAT_AGENT_PROMPT.format(
    final_report=state.final_action_payload,
    user_input=query
    )
    
    response = None
    try:
        response = llm_with_tools.invoke(formatted_prompt) 
    except Exception as e:
        print(f"Error in CHAT LLM: {e}")
        response = AIMessage(content="Sorry, I encountered an error processing your request.")
        
    return {
        "messages": [response],
            }
 