from langgraph.graph import StateGraph, START, END
from analyse_agent.db import get_checkpointer
from .schemas import AgentState
from .nodes import (
    stock_search_node, ask_human_node, india_tools, us_tools, india_fundamental, india_X_reddit,
    us_fundamental, us_X_reddit, state_consolidation, termination_node,
    social_momentum_analyst, quantitative_valuation_analyst, orchestrator,
    adjust_confidence_weights, action_payload, send_action_json,
    market_router, contradict_router
)

builder = StateGraph(AgentState)

#Layer 1:
builder.add_node("stock_search", stock_search_node)
builder.add_node("ask_human", ask_human_node)

#Layer 2:
builder.add_node("india_tools", india_tools)
builder.add_node("us_tools", us_tools)

#Layer 3:
builder.add_node("india_fundamental", india_fundamental)
builder.add_node("india_social", india_X_reddit)
builder.add_node("us_fundamental", us_fundamental)
builder.add_node("us_social", us_X_reddit)

#Layer 4:
builder.add_node("state_consolidation", state_consolidation)
builder.add_node("termination_node", termination_node)

#Layer 5:
builder.add_node("social_momentum_analyst",social_momentum_analyst)
builder.add_node("quantitative_valuation_analyst",quantitative_valuation_analyst)

#Layer 6:
builder.add_node("orchestrator", orchestrator)

#Layer 7:
builder.add_node("adjust_confidence_weights", adjust_confidence_weights)

#Layer 8:
builder.add_node("action_payload", action_payload)
builder.add_node("send_action_json", send_action_json)

builder.add_edge(START, 'stock_search')
builder.add_edge("stock_search", "ask_human")

builder.add_conditional_edges(
    "ask_human",
    market_router,
    {
        "india_tools": "india_tools",
        "us_tools": "us_tools",
        "terminate": "termination_node"
    }
)

builder.add_edge("india_tools","india_fundamental")
builder.add_edge("india_tools","india_social")
builder.add_edge("us_tools","us_fundamental")
builder.add_edge("us_tools","us_social")

builder.add_edge("termination_node",END)
builder.add_edge("india_social", "state_consolidation")
builder.add_edge("india_fundamental", "state_consolidation")
builder.add_edge("us_social", "state_consolidation")
builder.add_edge("us_fundamental", "state_consolidation")

builder.add_edge("state_consolidation",'social_momentum_analyst')
# builder.add_edge("state_consolidation",'quantitative_valuation_analyst')
builder.add_edge("social_momentum_analyst",'quantitative_valuation_analyst')

# builder.add_edge("social_momentum_analyst",'orchestrator')
builder.add_edge("quantitative_valuation_analyst",'orchestrator')

builder.add_conditional_edges(
    "orchestrator",
    contradict_router,
    {
        "yes": "adjust_confidence_weights",
        "no": "action_payload"
    }
    )

builder.add_edge("adjust_confidence_weights","orchestrator")
builder.add_edge("action_payload","send_action_json")
    
async def get_finance_graph():
    checkpointer = await get_checkpointer()
    return builder.compile(checkpointer=checkpointer)