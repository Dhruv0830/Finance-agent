import json
import pandas as pd
import asyncio
import yfinance as yf
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.types import interrupt, Command
from langchain_tavily import TavilySearch

from .tools import tool_array
from .prompts import *
from .config import analysis_model
from .schemas import *

# Bind Tools
model_with_tools = analysis_model.bind_tools(tool_array)
structuring_chain = model_with_tools.with_structured_output(StructuredCompanyListings)
prompt = PROMPT
search_chain = prompt | structuring_chain


# Node 1: Stock Search
async def stock_search_node(state: AgentState) -> dict:
    print("Search Node: Executing Web Search Node")

    query = state.messages[-1].content
    print("Search Node: User Query: ", query)

    structured_response = None
    try:
        structured_response = await search_chain.ainvoke({"query": query})
        print("Search Node: Search Results: ", structured_response)
    except Exception as e:
        print(f"Search Node: Error in Search Chain: {e}")

    if structured_response is None:
        return {
            "search_options": [],
            "company_name": "NOT_FOUND",
            "messages": [AIMessage(content=f"Unable to find search options for query: '{query}'.")]
        }

    # Pass AIMessage directly to messages, and Pydantic items directly to search_options
    return {
        "search_options": structured_response.listings,
        "company_name": structured_response.company_name,
        "messages": [AIMessage(content=structured_response.model_dump_json(indent=2))]
    }


# Node 2: Human-in-the-Loop Interruption
def ask_human_node(state: AgentState) -> dict:
    print("Ask Human Node: Entering the Human Node")

    # Options are Pydantic objects, convert to json strings for human display
    options =  state.search_options or [] 
    if not options:
        print("Ask Human Node: No search options found to present. Automatically terminating.")
        return {"user_choice": None}

    interrupt_payload = {
        "message": f"Multiple listings found for {state.company_name}. Please choose a market asset:",
        "company_name":{state.company_name},
        "options": options
    }

    print("Ask Human Node: Choices: ", interrupt_payload)
    human_response: dict = interrupt(interrupt_payload)
    print("Ask Human Node: Selection received: ", human_response)

    # if isinstance(human_response, dict):
    #     validated_choice = AgentInput(**human_response)
    # else:
    validated_choice = human_response

    # Save Pydantic object directly back to state!
    return {
        "user_choice": validated_choice,
        "messages": [HumanMessage(content=f"Search Stock: {human_response}")]
    }


# Node 3: Router
def market_router(state: AgentState) -> str:
    # Full dot notation access!
    market_name = state.user_choice["market"] if state.user_choice else "NOT_FOUND"
    print(f"Market Router: Market : {market_name}")

    if market_name == "NOT_FOUND" or (state.user_choice and state.user_choice["ticker"] == "NOT_FOUND"):
        return "terminate"
    elif market_name == "INDIA":
        return "india_tools"
    else:
        return "us_tools"


def india_tools(state: AgentState) -> dict:
    print("India Tools: ")
    return {}


def us_tools(state: AgentState) -> dict:
    print("US Tools: ")
    return {}


def termination_node(state: AgentState) -> dict:
    print("Termination Node: Stock verification failed after maximum attempts.")
    return {
        "messages": [
            AIMessage(content="System Notice: We were unable to verify this stock ticker on US or Indian markets after searching. Please check your spelling and try again.")
        ]
    }

def _get_yf_info(symbol: str) -> dict:
    ticker = yf.Ticker(symbol)
    return ticker

# Node 4b: Fundamental India Data
async def india_fundamental(state: AgentState) -> dict:
    print("India Fundamental Node: ")
    choice = state.user_choice
    stock_name = choice["ticker"] if choice["ticker"].endswith('.NS') else f"{choice['ticker']}.NS"
    lookback_days = choice["lookback_days"]

    ticker_obj = await asyncio.to_thread(_get_yf_info, stock_name)
    
    history_df = ticker_obj.history(period=f"{lookback_days}d")
    # 1. Reset index to turn Date/Datetime into an explicit column
    history_df = history_df.reset_index()

    # 2. Convert all datetime/timestamp columns to ISO string format
    for col in history_df.select_dtypes(include=["datetime64", "datetimetz"]).columns:
        history_df[col] = history_df[col].dt.strftime("%Y-%m-%d %H:%M:%S")

    # 3. Clean native Python dict records (safe for state & JSON serialization)
    price_history = history_df.to_dict(orient="records")

    info = ticker_obj.info or {}
    key_ratios = {
        "current_price": info.get("currentPrice") or info.get("previousClose"),
        "market_cap": info.get("marketCap"),
        "pe_ratio": info.get("trailingPE"),
        "forward_pe": info.get("forwardPE"),
        "peg_ratio": info.get("pegRatio"),
        "price_to_book": info.get("priceToBook"),
        "debt_to_equity": info.get("debtToEquity"),
        "return_on_equity": info.get("returnOnEquity"),
        "free_cash_flow": info.get("freeCashflow"),
        "ebitda": info.get("ebitda"),
        "total_revenue": info.get("totalRevenue"),
        "revenue_growth": info.get("revenueGrowth"),
        "profit_margins": info.get("profitMargins"),
    }

    financials = {}
    try:
        q_financials = ticker_obj.quarterly_financials
        if not q_financials.empty:
            q_financials.columns = q_financials.columns.astype(str)
            financials["income_statement"] = q_financials.fillna(0).to_dict()

        q_balance_sheet = ticker_obj.quarterly_balance_sheet
        if not q_balance_sheet.empty:
            q_balance_sheet.columns = q_balance_sheet.columns.astype(str)
            financials["balance_sheet"] = q_balance_sheet.fillna(0).to_dict()
    except Exception as e:
        print(f"Warning: Could not fetch detailed India financial statements: {e}")

    return {
        "fundamental_raw": {
            "price_history": price_history,
            "key_ratios": key_ratios,
            "financial_statements": financials
        }
    }


# Node 4c: Social Sentiment India
async def india_X_reddit(state: AgentState) -> dict:
    print("India X/Reddit Node: ")
    choice = state.user_choice
    stock_name = choice["ticker"] if choice["ticker"].endswith('.NS') else f"{choice['ticker']}.NS"
    lookback_days = choice["lookback_days"]

    search = TavilySearch(max_results=15)
    reddit_context = None
    x_context = None

    try:
        reddit_context = await search.ainvoke({
            "query": f"{stock_name} stock for last {lookback_days} days",
            "include_domains": ["reddit.com/r/IndianStockMarket", "reddit.com/r/IndianStreetBets"]
        })

        x_context = await search.ainvoke({
            "query": f"{stock_name} stock for last {lookback_days} days",
            "include_domains": ["x.com", "moneycontrol.com", "nseindia.com"]
        })
    except Exception as e:
        print(f"Warning: Could not fetch India social sentiment data: {e}")

    return {
        "social_raw": {
            "reddit": reddit_context or {},
            "x": x_context or {}
        }
    }


# Node 4d: US Fundamental Data
async def us_fundamental(state: AgentState) -> dict:
    print("US Fundamental Node: ")
    choice = state.user_choice
    stock_name = choice["ticker"]
    lookback_days = choice["lookback_days"]

    ticker_obj = await asyncio.to_thread(_get_yf_info, stock_name)
    history_df = ticker_obj.history(period=f"{lookback_days}d")
    
    # 1. Reset index to turn Date/Datetime into an explicit column
    history_df = history_df.reset_index()

    # 2. Convert all datetime/timestamp columns to ISO string format
    for col in history_df.select_dtypes(include=["datetime64", "datetimetz"]).columns:
        history_df[col] = history_df[col].dt.strftime("%Y-%m-%d %H:%M:%S")

    # 3. Clean native Python dict records (safe for state & JSON serialization)
    price_history = history_df.to_dict(orient="records")

    info = ticker_obj.info or {}
    key_ratios = {
        "current_price": info.get("currentPrice") or info.get("previousClose"),
        "market_cap": info.get("marketCap"),
        "pe_ratio": info.get("trailingPE"),
        "forward_pe": info.get("forwardPE"),
        "peg_ratio": info.get("pegRatio"),
        "price_to_book": info.get("priceToBook"),
        "debt_to_equity": info.get("debtToEquity"),
        "return_on_equity": info.get("returnOnEquity"),
        "free_cash_flow": info.get("freeCashflow"),
        "ebitda": info.get("ebitda"),
        "total_revenue": info.get("totalRevenue"),
        "revenue_growth": info.get("revenueGrowth"),
        "profit_margins": info.get("profitMargins"),
    }

    financials = {}
    try:
        q_financials = ticker_obj.quarterly_financials
        if not q_financials.empty:
            q_financials.columns = q_financials.columns.astype(str)
            financials["income_statement"] = q_financials.fillna(0).to_dict()

        q_balance_sheet = ticker_obj.quarterly_balance_sheet
        if not q_balance_sheet.empty:
            q_balance_sheet.columns = q_balance_sheet.columns.astype(str)
            financials["balance_sheet"] = q_balance_sheet.fillna(0).to_dict()
    except Exception as e:
        print(f"Warning: Could not fetch detailed US financial statements: {e}")

    return {
        "fundamental_raw": {
            "price_history": price_history,
            "key_ratios": key_ratios,
            "financial_statements": financials
        }
    }


# Node 4e: US Social Sentiment
async def us_X_reddit(state: AgentState) -> dict:
    print("US X/Reddit Node: ")
    choice = state.user_choice
    stock_name = choice["ticker"]
    lookback_days = choice["lookback_days"]

    search = TavilySearch(max_results=15)
    reddit_context = None
    x_context = None

    try:
        reddit_context = await search.ainvoke({
            "query": f"{stock_name} stock for last {lookback_days} days",
            "include_domains": ["reddit.com/r/wallstreetbets", "reddit.com/r/stocks"]
        })

        x_context = await search.ainvoke({
            "query": f"{stock_name} stock for last {lookback_days} days",
            "include_domains": ["x.com", "robinhood.com", "cnbc.com"]
        })
    except Exception as e:
        print(f"Warning: Could not fetch US social sentiment data: {e}")

    return {
        "social_raw": {
            "reddit": reddit_context or {},
            "x": x_context or {}
        }
    }


# Node 5: State Consolidation
def state_consolidation(state: AgentState) -> dict:
    print("State Consolidation Node")

    fundamental = state.fundamental_raw or {}
    raw_history = fundamental.get("price_history", [])
    key_ratios = fundamental.get("key_ratios", {})
    financials = fundamental.get("financial_statements", {})

    history_md, ratios_md, financials_md = None, None, None

    try:
        df_history = pd.DataFrame(raw_history).round(2)
        history_md = df_history.to_markdown(index=False)
    except Exception as e:
        print("Error in History MD", e)

    try:
        df_ratios = pd.DataFrame([key_ratios]).round(2)
        ratios_md = df_ratios.to_markdown(index=False)
    except Exception as e:
        print("Error in Key Ratios MD", e)

    try:
        df_statements = pd.DataFrame(financials).round(2)
        financials_md = df_statements.to_markdown(index=False)
    except Exception as e:
        print("Error in Financials MD", e)

    frontend_citations = []
    social_dump = state.social_raw or {}
    reddit_data = social_dump.get("reddit", {})
    x_data = social_dump.get("x", {})

    social_markdown = ["### 📱 Social Media Sentiment (Reddit & X):"]
    institutional_markdown = ["### 🏛️ Corporate & Market News Feeds:"]

    def parse_source(url: str) -> tuple[str, str]:
        url_lower = url.lower()
        if "reddit.com" in url_lower:
            return "Social Media", "Reddit"
        elif "x.com" in url_lower or "twitter.com" in url_lower:
            return "Social Media", "X (Twitter)"
        elif "nseindia.com" in url_lower:
            return "Institutional/News", "NSE India"
        elif "moneycontrol.com" in url_lower:
            return "Institutional/News", "MoneyControl"
        else:
            return "Institutional/News", "Web Result"

    all_results = (reddit_data.get("results", []) or []) + (x_data.get("results", []) or [])

    for item in all_results:
        url = item.get("url", "")
        title = item.get("title", "No Title Available").strip()
        content = item.get("content", "").strip()

        if not url:
            continue

        category, source_name = parse_source(url)

        frontend_citations.append({
            "category": category,
            "source_name": source_name,
            "title": title,
            "url": url,
            "content": content
        })

        if category == "Social Media":
            social_markdown.append(f"- **[{source_name}]** {title}\n  *Snippet*: {content}\n")
        else:
            institutional_markdown.append(f"- **[{source_name}]** {title}\n  *Context*: {content}\n")

    final_llm_markdown = "## COMPREHENSIVE WEB & SOCIAL DATA OVERVIEW\n\n" + \
                        "\n".join(social_markdown) + "\n\n" + \
                        "\n".join(institutional_markdown)

    return {
        "standardized_fundamentals": {
            "price_history": history_md,
            "key_ratios": ratios_md,
            "financial_statements": financials_md
        },
        "standardized_social_dump": final_llm_markdown,
        "source_citations": frontend_citations,
    }


# Node 6a: Social Analyst
async def social_momentum_analyst(state: AgentState) -> dict:
    if not state.standardized_social_dump:
        return {
            "messages": [AIMessage(content="Insufficient social data for this stock ticker")],
            "social_momentum_analysis":{
                "momentum_score": 0.0,
                "sentiment_label":"Neutral (No Data)",
                "executive_summary":"No social media or news data was available for analysis."
            }
        }

    structured_llm = analysis_model.with_structured_output(SocialMomentumAnalysis).with_retry(
        stop_after_attempt=2, wait_exponential_jitter=True
    )

    formatted_prompt = SOCIAL_MOMENTUM_ANALYST_PROMPT.format(
        consolidated_markdown_data=state.standardized_social_dump
    )
    
    try:
        analysis_result = await structured_llm.ainvoke(formatted_prompt)
    except Exception as e:
        print(f"Error in Social Momentum Analyst LLM: {e}")
        return  {
                    "messages": [AIMessage(content="Error while gathering social data for this stock ticker")],
                    "social_momentum_analysis":{
                        "momentum_score": 0.0,
                        "sentiment_label":"Neutral (No Data)",
                        "executive_summary":"No social media or news data was available for analysis."
                    }
                }

    return {
        "messages": [AIMessage(content="Analysis data ready to be displayed.")],
        "social_momentum_analysis": analysis_result.model_dump()
    }


# Node 6b: Quant Analyst
async def quantitative_valuation_analyst(state: AgentState) -> dict:
    if not state.standardized_fundamentals:
        return {
            "messages": [AIMessage(content="Insufficient fundamental data for this stock ticker")],
            "quantitative_valuation_analysis": {
                "momentum_score":0.0,
                "sentiment_label":"Neutral (No Data)",
                "executive_summary":"No fundamental data was available for analysis."
            }
        }

    fundamentals = state.standardized_fundamentals
    final_md = f"{fundamentals.get('price_history', '')}\n\n{fundamentals.get('financial_statements', '')}\n\n{fundamentals.get('key_ratios', '')}"

    structured_llm = analysis_model.with_structured_output(QuantitativeValuationAnalysis).with_retry(
        stop_after_attempt=2, wait_exponential_jitter=True
    )

    formatted_prompt = QUANTITATIVE_VALUATION_PROMPT.format(fundamental_data_markdown=final_md)

    try:
        analysis_result = await structured_llm.ainvoke(formatted_prompt)
        status_msg = "Quantitative analysis completed successfully."
    except Exception as e:
        print(f"[Error] Quantitative Valuation Analyst LLM failed: {e}")
        analysis_result = {
            "momentum_score":0.0,
            "sentiment_label":"Error",
            "executive_summary":"LLM processing failed to parse fundamental data."
        }
        status_msg = "Quantitative analysis failed due to an execution error."

    return {
        "messages": [AIMessage(content=status_msg)],
        "quantitative_valuation_analysis": analysis_result.model_dump()
    }


# Node 7: Orchestrator
async def orchestrator(state: AgentState) -> dict:
    if not state.quantitative_valuation_analysis or not state.social_momentum_analysis:
        return {
            "messages": [AIMessage(content="Insufficient data for analysis.")],
            "dissonance_score": 0,
            "orchestrator_summary": "Insufficient data for analysis."
        }

    formatted_prompt = ORCHESTRATOR_PROMPT.format(
        quant_analysis=state.quantitative_valuation_analysis,
        social_analysis=state.social_momentum_analysis
    )

    structured_llm = model_with_tools.with_structured_output(OrchestratorOutput)

    try:
        response = await structured_llm.ainvoke(formatted_prompt)
    except Exception as e:
        print(f"Error in Orchestrator LLM: {e}")
        response = {
            "messages": [AIMessage(content="LLM processing failed in orchestrator")],
            "dissonance_score": 0,
            "orchestrator_summary": "There was an error in the orchestrator LLM."
        }

    return {
        "orchestrator_summary": response.executive_summary ,
        "dissonance_score": response.dissonance_score
    }


# Node 8: Contradict Router
def contradict_router(state: AgentState) -> str:
    score = state.dissonance_score or 0
    recal_count = state.recalibration_count or 0

    if score >= 7 and recal_count > 1:
        return "yes"
    return "no"


# Node 9: Adjust Confidence Weights
def adjust_confidence_weights(state: AgentState) -> dict:
    dissonance = state.dissonance_score or 0.5
    current_recalibrations = state.recalibration_count or 0

    dissonance_penalty = (dissonance / 10.0) * 0.4
    new_social_weight = max(0.1, round(0.5 - dissonance_penalty, 2))
    new_quant_weight = round(1.0 - new_social_weight, 2)

    return {
        "quant_weight": new_quant_weight,
        "social_weight": new_social_weight,
        "recalibration_count": current_recalibrations + 1
    }


# Node 10: Action Payload
async def action_payload(state: AgentState) -> dict:
    ticker = state.user_choice["ticker"] if state.user_choice else "NOT_FOUND"
    orchestrator_summary = state.orchestrator_summary or "NOT_FOUND"
    quant_weight = state.quant_weight or 0.5
    social_weight = state.social_weight or 0.5
    dissonance_score = state.dissonance_score or 0

    formatted_prompt = ACTION_PAYLOAD_PROMPT.format(
        ticker=ticker,
        orchestrator_summary=orchestrator_summary,
        quant_weight=quant_weight,
        social_weight=social_weight,
        dissonance_score=dissonance_score
    )

    structured_llm = model_with_tools.with_structured_output(InvestmentActionPayload)

    try:
        response = await structured_llm.ainvoke(formatted_prompt)
    except Exception as e:
        response = {
                    "ticker": ticker,
                    "action": "HOLD",
                    "confidence_score": 0.5,
                    "risk_level": "LOW",
                    "reasoning_summary": "No data available for analysis.",
                    "key_catalysts": [],
                    "invalidation_rules": [],
                    "weights_applied": {"quantitative": quant_weight, "social": social_weight},
                    "source_citations": []
                } 
        print(f"Error in Action Payload LLM: {e}")

    payload_dict = response.model_dump()
    payload_dict["weights_applied"] = {"quantitative": quant_weight, "social": social_weight}
    payload_dict["source_citations"] = state.source_citations or []  # Fixed list syntax!

    return {
        "final_action_payload": payload_dict
    }


# # Node 11: Send Action
# def send_action_json(state: AgentState) -> dict:
#     payload = state.final_action_payload or {}

#     if not payload:
#         return {
#             "payload_sent": False,
#             "api_response_status": 500,
#             "payload": ""
#         }

#     formatted_json = json.dumps(payload, indent=2)

#     return {
#         "payload_sent": True,
#         "payload": formatted_json,
#         "api_response_status": 200
#     }