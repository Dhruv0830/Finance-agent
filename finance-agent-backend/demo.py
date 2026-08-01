import asyncio
import json
from datetime import datetime, timedelta, timezone
import uuid
from typing import AsyncGenerator, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

router = APIRouter(prefix="/demo", tags=["Demo Finance Agent Graph"])


# =====================================================================
# REQUEST SCHEMAS
# =====================================================================
class DemoAnalyseRequest(BaseModel):
    prompt: str
    model: str = "gpt-4o"

class DemoResumeRequest(BaseModel):
    thread_id: str
    user_response: Dict[str, Any]  # Expects human selection input e.g. {"ticker": "RELIANCE.NS", "market": "INDIA"}

mock_thread_id = str(uuid.uuid4())
# =====================================================================
# MOCK STREAM GENERATORS (Simulating Graph Nodes)
# =====================================================================
async def mock_analyse_stream_generator(prompt: str, thread_id: str) -> AsyncGenerator[dict, None]:
    """
    Simulates execution from stock_search_node up to ask_human_node (Interrupt).
    """
    # 0. Initial Handshake Event (Returns thread_id immediately)
    yield {
        "event": "thread_created",
        "data": json.dumps({"thread_id": thread_id, "status": "started"})
    }
    await asyncio.sleep(0.8)

    # Node 1: stock_search_node
    yield {
        "event": "node_update",
        "data": json.dumps({
            "node": "stock_search_node",
            "state": {
                "search_options": [
                    {
                        "company_name": "Reliance Industries Limited",
                        "ticker": "RELIANCE",
                        "market": "INDIA",
                        "exchange": "NSE"
                    },
                    {
                        "company_name": "Reliance Steel & Aluminum Co.",
                        "ticker": "RS",
                        "market": "US",
                        "exchange": "NYSE"
                    }
                ],
                "company_name": "Reliance",
                "messages": [f"Search Stock: {prompt}"]
            }
        })
    }
    await asyncio.sleep(1.2)

    # Node 2: ask_human_node (Triggers Interrupt for Market Selection)
    yield {
        "event": "interrupt",
        "data": json.dumps({
            "node": "ask_human_node",
            "interrupt_reason": "Multiple listings found for Reliance. Please choose a market asset:",
            "options": [
                {
                    "company_name": "Reliance Industries Limited",
                    "ticker": "RELIANCE",
                    "market": "INDIA",
                    "lookback_days": 30
                },
                {
                    "company_name": "Reliance Steel & Aluminum Co.",
                    "ticker": "RS",
                    "market": "US",
                    "lookback_days": 30
                }
            ]
        })
    }


async def mock_resume_stream_generator(thread_id: str, user_response: dict) -> AsyncGenerator[dict, None]:
    """
    Simulates graph execution resuming from ask_human_node through tools, analysts, orchestrator, and action payload nodes.
    """
    await asyncio.sleep(0.8)

    # Node 3 & 4: market_router -> india_fundamental / us_fundamental
    market = user_response.get("market", "INDIA")
    node_prefix = "india" if market == "INDIA" else "us"
    ticker = user_response.get("ticker", "RELIANCE.NS")

    # Node 4b/4d: Fundamental Node Output
    yield {
        "event": "node_update",
        "data": json.dumps({
            "node": f"{node_prefix}_fundamental",
            "state": {
                "fundamental_raw": {
                    "key_ratios": {
                        "current_price": 2980.50,
                        "market_cap": 20150000000000,
                        "pe_ratio": 28.4,
                        "debt_to_equity": 0.42,
                        "revenue_growth": 0.115
                    }
                }
            }
        })
    }
    await asyncio.sleep(1.2)

    # Node 4c/4e: Social Node Output
    yield {
        "event": "node_update",
        "data": json.dumps({
            "node": f"{node_prefix}_X_reddit",
            "state": {
                "social_raw": {
                    "reddit": {"results": [{"title": "Bullish breakout on Reliance", "url": "https://reddit.com/r/IndianStockMarket"}]},
                    "x": {"results": [{"title": "Q2 Earnings expectations", "url": "https://moneycontrol.com/news"}]}
                }
            }
        })
    }
    await asyncio.sleep(1.2)

    # Node 5: state_consolidation
    yield {
        "event": "node_update",
        "data": json.dumps({
            "node": "state_consolidation",
            "state": {
                "standardized_fundamentals": "### Fundamentals Summary Available",
                "standardized_social_dump": "### Social Sentiment Overview Available",
                "source_citations": [
                    {
                        "category": "Institutional/News",
                        "source_name": "MoneyControl",
                        "title": "Q2 Earnings expectations",
                        "url": "https://moneycontrol.com/news"
                    }
                ]
            }
        })
    }
    await asyncio.sleep(1.0)

    # Node 6a & 6b: Parallel Analysts Output
    yield {
        "event": "node_update",
        "data": json.dumps({
            "node": "social_momentum_analyst",
            "state": {
                "social_momentum_analysis": {
                    "momentum_score": 7.8,
                    "sentiment_label": "Bullish",
                    "executive_summary": "Strong positive buzz following retail sector expansion announcement."
                }
            }
        })
    }
    await asyncio.sleep(0.8)

    yield {
        "event": "node_update",
        "data": json.dumps({
            "node": "quantitative_valuation_analyst",
            "state": {
                "quantitative_valuation_analysis": {
                    "valuation_score": 8.2,
                    "executive_summary": "Healthy balance sheet with stable debt-to-equity ratio."
                }
            }
        })
    }
    await asyncio.sleep(1.0)

    # Node 7 & 9: Orchestrator & Adjust Weights
    yield {
        "event": "node_update",
        "data": json.dumps({
            "node": "orchestrator",
            "state": {
                "orchestrator_summary": "Quantitative and social metrics align on positive growth outlook.",
                "dissonance_score": 2
            }
        })
    }
    await asyncio.sleep(0.8)

    # Node 10 & 11: Action Payload & Send Action JSON
    final_payload = {
        "ticker": ticker,
        "action": "BUY",
        "confidence_score": 0.86,
        "risk_level": "LOW",
        "reasoning_summary": "High valuation score coupled with bullish social momentum.",
        "weights_applied": {"quantitative": 0.6, "social": 0.4},
        "source_citations": [
    {
        "category": "Institutional/News",
        "source_name": "MoneyControl",
        "title": "Reliance Q2 Consolidated Net Profit Rises 11.5% YoY; Retail Revenue Momentum Strong",
        "url": "https://www.moneycontrol.com/news/business/earnings/reliance-q2-results-2026-net-profit-rises-11-5-percent.html",
        "content": "Reliance Industries reported a strong performance in its quarterly results driven by consumer business growth and robust operational EBITDA across retail and telecom segments."
    },
    {
        "category": "Institutional/News",
        "source_name": "NSE India",
        "title": "Corporate Announcement: Schedule of Analyst / Institutional Investor Meets",
        "url": "https://www.nseindia.com/companies-listing/corporate-filings-announcements",
        "content": "Official filing confirming upcoming investor roadshows and strategic updates regarding green energy segment capital expenditure."
    },
    {
        "category": "Social Media",
        "source_name": "Reddit",
        "title": "[r/IndianStockMarket] Technical Analysis: RELIANCE forming classic Cup & Handle on Weekly Chart",
        "url": "https://www.reddit.com/r/IndianStockMarket/comments/1f8a9bc/reliance_technical_breakout/",
        "content": "Community discussion highlighting key support levels at ₹2,920 and high delivery volumes indicating institutional accumulation over the past two weeks."
    },
    {
        "category": "Social Media",
        "source_name": "X (Twitter)",
        "title": "Market Sentiment Pulse: High Bullish Options Positioning on ₹3,000 Call Contracts",
        "url": "https://x.com/market_tracker/status/18320491029",
        "content": "Options chain analysis shows significant open interest build-up at the 3,000 CE strike for the upcoming monthly expiry."
    },
    {
        "category": "Institutional/News",
        "source_name": "Web Result",
        "title": "Bloomberg: Global Petrochemical Spreads Stabilize in Q2",
        "url": "https://www.bloomberg.com/news/articles/petrochemical-margins-q2-review",
        "content": "Refining margins and gross refining margins (GRMs) showed marginal quarter-over-quarter recovery, benefiting integrated energy players."
    }
        ]
    }

    yield {
        "event": "node_update",
        "data": json.dumps({
            "node": "action_payload",
            "state": {
                "final_action_payload": final_payload
            }
        })
    }
    await asyncio.sleep(0.6)

    # Complete Event
    yield {
        "event": "complete",
        "data": json.dumps({"thread_id": thread_id, "status": "finished"})
    }


# =====================================================================
# FASTAPI ENDPOINTS
# =====================================================================
@router.post("/analyse")
async def demo_analyse_endpoint(request: DemoAnalyseRequest):
    """
    Streams simulated initial analysis until the market option selection interrupt is triggered.
    """
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")
    
    # Generate mock thread ID
    mock_thread_id = str(uuid.uuid4())

    return EventSourceResponse(
        mock_analyse_stream_generator(prompt=request.prompt, thread_id=mock_thread_id),
        media_type="text/event-stream"
    )


@router.post("/resume")
async def demo_resume_endpoint(request: DemoResumeRequest):
    """
    Resumes graph execution after human option selection in ask_human_node.
    """
    if not request.user_response:
        raise HTTPException(status_code=400, detail="User response cannot be empty.")

    return EventSourceResponse(
        mock_resume_stream_generator(thread_id=mock_thread_id, user_response=request.user_response),
        media_type="text/event-stream"
    )
    
    
@router.get("/threads")
async def get_demo_threads():
    """
    Returns mock conversation threads for testing sidebar rendering.
    """
    now = datetime.now(timezone.utc)
    
    mock_threads = [
        {
            "thread_id": "demo-thread-reliance-001",
            "ticker": "RELIANCE.NS",
            "title": "BUY Strategy: RELIANCE.NS",
            "mode": "CHAT",
            "created_at": (now - timedelta(hours=2)).isoformat(),
            "updated_at": (now - timedelta(minutes=15)).isoformat()
        },
        {
            "thread_id": "demo-thread-aapl-002",
            "ticker": "AAPL",
            "title": "Apple Inc. Market Analysis",
            "mode": "ANALYSE",  # Currently paused at interrupt or analyzing
            "created_at": (now - timedelta(days=1)).isoformat(),
            "updated_at": (now - timedelta(hours=5)).isoformat()
        },
        {
            "thread_id": "demo-thread-nvda-003",
            "ticker": "NVDA",
            "title": "HOLD Strategy: NVDA",
            "mode": "CHAT",
            "created_at": (now - timedelta(days=3)).isoformat(),
            "updated_at": (now - timedelta(days=2)).isoformat()
        },
        {
            "thread_id": "demo-thread-tcs-004",
            "ticker": "TCS.NS",
            "title": "BUY Strategy: TCS.NS",
            "mode": "CHAT",
            "created_at": (now - timedelta(days=7)).isoformat(),
            "updated_at": (now - timedelta(days=6)).isoformat()
        }
    ]
    
    return {"threads": mock_threads}