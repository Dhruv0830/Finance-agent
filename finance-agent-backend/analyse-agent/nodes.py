import pandas as pd
import yfinance as yf
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langgraph.types import interrupt
from langgraph.types import Command
from langchain_core.messages import HumanMessage, AIMessage
import json
from langchain_tavily import TavilySearch
from .config import analysis_model as model
from .tools import tools
from .schemas import (
  AgentState, AgentInput, SocialMomentumAnalysis,
  StructuredCompanyListings, OrchestratorOutput,
  QuantitativeValuationAnalysis, InvestmentActionPayload
)
from .prompts import (
  PROMPT, SOCIAL_MOMENTUM_ANALYST_PROMPT, ORCHESTRATOR_PROMPT, QUANTITATIVE_VALUATION_PROMPT, ACTION_PAYLOAD_PROMPT,
)


#Bind Tools

model_with_tools = model.bind_tools(tools)

#Add structured output

structuring_chain = model_with_tools.with_structured_output(StructuredCompanyListings)

prompt = PROMPT
search_chain = prompt | structuring_chain

# Node 1:
def stock_search_node(state: AgentState) -> dict:
    print("Search Node: Executing Web Search Node")

    query = state.messages[-1].content

    print("Search Node: User Query: ", query)

    structured_response = None

    try:
      structured_response = search_chain.invoke({"query": query})
      print("Search Node: Search Results: ", structured_response)

    except Exception as e:
      print(f"Search Node: Error in Search Chain: {e}")

    if structured_response is None:
      return {
          "search_options": [],
          "company_name": "NOT_FOUND",
          "messages": [HumanMessage("Search Stock: ", query)]
      }

    return {
        "search_options": structured_response.listings,
        "company_name": structured_response.company_name,
        "messages": [AIMessage(structured_response.model_dump_json(indent=2))]

    }


#Node 2:
def ask_human_node(state: AgentState) -> dict:
    print("Ask Human Node: Entering the Human Node")

    options = state.search_options or []

    if not options:
        print("Ask Human Node: No search options found to present. Automatically terminating.")
        return {"user_choice": None}

    #Package the options into a payload to pass to the user interface
    interrupt_payload = {
        "message": f"Multiple listings found for {state.company_name}. Please choose a market asset:",
        "choices": options
    }

    print("Ask Human Node: Choices: ", interrupt_payload)

    #Generate an interrupt and wait for the human's response
    human_response = interrupt(interrupt_payload)

    print("Ask Human Node: Selection received: ",human_response)

    if isinstance(human_response, dict):
        validated_choice = AgentInput(**human_response)
    else:
        # Fallback if it's somehow already an AgentInput object
        validated_choice = human_response

    # 4. Save the chosen asset back to the state so intent_parser can route it
    return {
        "user_choice": validated_choice,
        "messages": [HumanMessage("Search Stock: ", json.dumps(human_response, indent=2) )]
    }
    

#Router function to route the agent to correct market
#Node 3:
def market_router(state: AgentState) -> str:
  market_name = state.user_choice.market if state.user_choice else "NOT_FOUND"
  print(f"Market Router: Market : {market_name}")

  if market_name == "NOT_FOUND":
    return "terminate"
  elif state.user_choice.ticker == "NOT_FOUND":
    return "terminate"
  elif market_name == "INDIA":
    return "india_tools"
  else:
    return "us_tools"


def india_tools(state: AgentState) -> str:
  print("India Tools: State: ", state)
  return {}


def us_tools(state: AgentState) -> str:
  print("US Tools: State: ", state)
  return {}


#Termination node if stock not found
#Node 4a:
def termination_node(state: AgentState):
  print("Termination Node: Stock verification failed after maximum attempts. Routing error message.", state)
  return {
      "messages": [
          "System Notice: We were unable to verify this stock ticker on US or Indian markets after searching. Please check your spelling and try again."
      ]
  }
  
  
#Node 4b:
def india_fundamental(state: AgentState) -> dict:
  print("India Fundamental Node: State: ", state)
  choice = state.user_choice
  stock_name = choice.ticker if choice.ticker.endswith('.NS') else f"{choice.ticker}.NS"
  lookback_days = choice.lookback_days

  ticker_obj = yf.Ticker(stock_name)
  history_df = ticker_obj.history(period=f"{lookback_days}d")

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

  # 3. Extract Recent Financial Statements (Quarterly)
  # Convert DataFrames to string/dict representations safely
  financials = {}
  try:
      q_financials = ticker_obj.quarterly_financials
      if not q_financials.empty:
          # Take top key lines (e.g., Total Revenue, Net Income)
          financials["income_statement"] = q_financials.fillna(0).to_dict()

      q_balance_sheet = ticker_obj.quarterly_balance_sheet
      if not q_balance_sheet.empty:
          financials["balance_sheet"] = q_balance_sheet.fillna(0).to_dict()
  except Exception as e:
      print(f"Warning: Could not fetch detailed India financial statements: {e}")

  # 4. Return consolidated payload to state
  return {
      "fundamental_raw": {
          "price_history": price_history,
          "key_ratios": key_ratios,
          "financial_statements": financials
      }
  }
  
  
#Node 4c:
def india_X_reddit(state: AgentState) -> dict:
  print("India X/Reddit Node: State: ", state)
  choice = state.user_choice
  stock_name = choice.ticker if choice.ticker.endswith('.NS') else f"{choice.ticker}.NS"
  lookback_days = choice.lookback_days

  search = TavilySearch(max_results= 15)
  reddit_context = None
  x_context = None

  try:
    reddit_context = search.invoke({
      "query": f"{stock_name} stock for last {lookback_days} days",
      "include_domains": ["reddit.com/r/IndianStockMarket", "reddit.com/r/IndianStreetBets"]
    })

    x_context = search.invoke({
        "query": f"{stock_name} stock for last {lookback_days} days",
        "include_domains": ["x.com", "moneycontrol.com", "nseindia.com"]
    })

  except Exception as e:
    print(f"Warning: Could not fetch India social sentiment data: {e}")

  if reddit_context is None:
    reddit_context = {}
  if x_context is None:
    x_context = {}

  return {
      "social_raw": {
            "reddit": reddit_context,
            "x": x_context
        }
  }
  
  
#Node 4d:
def us_fundamental(state: AgentState) -> dict:
  print("US Node: State: ", state)
  choice = state.user_choice
  stock_name = choice.ticker
  lookback_days = choice.lookback_days

  ticker_obj = yf.Ticker(stock_name)
  history_df = ticker_obj.history(period=f"{lookback_days}d")

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

  # 3. Extract Recent Financial Statements (Quarterly)
  # Convert DataFrames to string/dict representations safely
  financials = {}
  try:
      q_financials = ticker_obj.quarterly_financials
      if not q_financials.empty:
          # Take top key lines (e.g., Total Revenue, Net Income)
          financials["income_statement"] = q_financials.fillna(0).to_dict()

      q_balance_sheet = ticker_obj.quarterly_balance_sheet
      if not q_balance_sheet.empty:
          financials["balance_sheet"] = q_balance_sheet.fillna(0).to_dict()
  except Exception as e:
      print(f"Warning: Could not fetch detailed US financial statements: {e}")

  # 4. Return consolidated payload to state
  return {
      "fundamental_raw": {
          "price_history": price_history,
          "key_ratios": key_ratios,
          "financial_statements": financials
      }
  }
  

#Node 4e:
def us_X_reddit(state: AgentState) -> dict:
  print("US X/Reddit Node: State: ", state)
  choice = state.user_choice
  stock_name = choice.ticker
  lookback_days = choice.lookback_days

  search = TavilySearch(max_results= 15)
  reddit_context = None
  x_context = None

  try:
    reddit_context = search.invoke({
      "query": f"{stock_name} stock for last {lookback_days} days",
      "include_domains": ["reddit.com/r/wallstreetbets", "reddit.com/r/stocks"]
    })

    x_context = search.invoke({
        "query": f"{stock_name} stock for last {lookback_days} days",
        "include_domains": ["x.com", "robinhood.com", "cnbc.com"]
    })

  except Exception as e:
    print(f"Warning: Could not fetch US social sentiment data: {e}")

  if reddit_context is None:
    reddit_context = {}
  if x_context is None:
    x_context = {}

  return {
      "social_raw": {
            "reddit": reddit_context,
            "x": x_context
        }
  }

#Node 5:
def state_consolidation(state: AgentState) -> dict:
  print("State Consolidation Node", state)

  #Converting the fundamental data into a markdown file
  fundamental = getattr(state, "fundamental_raw", {})
  raw_history = fundamental.get("price_history", [])
  key_ratios = fundamental.get("key_ratios", [])
  financials = fundamental.get("financial_statements", [])

  history_md = None
  ratios_md = None
  financials_md = None

  #Price history
  try:
    df_history = pd.DataFrame(raw_history)
    df_history = df_history.round(2)
    history_md = df_history.to_markdown(index=False)
  except ValueError as e:
    print("Error in History MD", e)

  #Key_ratios
  try:
    df_ratios = pd.DataFrame(key_ratios, index=[0])
    df_ratios = df_ratios.round(2)
    ratios_md = df_ratios.to_markdown(index=False)
  except ValueError as e:
    print("Error in Key Ratios MD", e)

  #Financial_statements
  try:
    df_statements = pd.DataFrame(financials)
    df_statements = df_statements.round(2)
    financials_md = df_statements.to_markdown(index=False)
  except ValueError as e:
    print("Error in Financials MD", e)

  #Cleaing the Social data
  frontend_citations = []
  social_dump = getattr(state, "social_raw", {})
  reddit_data = social_dump.get("reddit", {})
  x_data = social_dump.get("x", {})

  # Markdown tracking blocks for the LLM prompt
  social_markdown = ["### 📱 Social Media Sentiment (Reddit & X):"]
  institutional_markdown = ["### 🏛️ Corporate & Market News Feeds (NSE, MoneyControl, etc.):"]

  # Helper utility to categorize and name the source based on the URL
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

  all_results = (reddit_data["results"] or []) + (x_data["results"] or [])

  print("State Consolidation Node: All: ", all_results)

  for item in all_results:
      url = item.get("url", "")
      title = item.get("title", "No Title Available").strip()
      content = item.get("content", "").strip()

      if not url:
          continue

      category, source_name = parse_source(url)

      # 1. Build the clean structured payload for the UI cards
      frontend_citations.append({
          "category": category,
          "source_name": source_name,
          "title": title,
          "url": url,
          "content": content
      })

      # 2. Sort the markdown formatting strings so the LLM stays focused
      if category == "Social Media":
          social_markdown.append(f"- **[{source_name}]** {title}\n  *Snippet*: {content}\n")
      else:
          institutional_markdown.append(f"- **[{source_name}]** {title}\n  *Context*: {content}\n")

  # Combine the separate markdown blocks into a single string for your Analyst
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

#Node 6a:
def social_momentum_analyst(state: AgentState) -> dict:
  print("Social Momentum Analyst Node: State: ", state.standardized_social_dump)
  if not state.standardized_social_dump:
    return {
        "messages" : [
            AIMessage(content= "Insufficient social data for this stock ticker")
        ],
        "social_momentum_analysis": {
            "momentum_score": 0.0,
            "sentiment_label": "Neutral (No Data)",
            "executive_summary": "No social media or news data was available for analysis."
        }
    }

  structured_llm = model.with_structured_output(SocialMomentumAnalysis)

  # 2. Attach .with_retry() to the structured runnable second
  social_llm = structured_llm.with_retry(
      stop_after_attempt=5,
      wait_exponential_jitter=True
  )

  formatted_prompt = SOCIAL_MOMENTUM_ANALYST_PROMPT.format(
      consolidated_markdown_data = state.standardized_social_dump)

  print(f"Formatted Prompt: {formatted_prompt}")

  analysis_result = None

  try:
    analysis_result = social_llm.invoke(formatted_prompt)
  except Exception as e:
    print(f"Error in Social Momentum Analyst LLM instance: {e}")
  finally:
    if analysis_result:
      analysis_result = analysis_result.model_dump_json(indent=2)
    else:
        analysis_result = json.dumps({
            "status": "ERROR",
            "summary": "Analysis unavailable due to upstream API error.",
            "sentiment_score": 0.0
        }, indent=2)

  return {
      "messages": [
          AIMessage(content="Analysis data ready to be displayed.")
      ],
      "social_momentum_analysis": analysis_result
  }

#Node 6b:
def quantitative_valuation_analyst(state: AgentState) -> dict:
  print("Quantitative Valuation Analyst Node: State: ", state.standardized_fundamentals)

  if not state.standardized_fundamentals:
    return {
        "messages" : [
            AIMessage(content= "Insufficient fundamental data for this stock ticker")
        ],
        "quantitative_valuation_analysis": {
            "momentum_score": 0.0,
            "sentiment_label": "Neutral (No Data)",
            "executive_summary": "No fundamental data was available for analysis."
        }
    }

  final_md = state.standardized_fundamentals['price_history'] + "\n\n" + state.standardized_fundamentals['financial_statements'] + "\n\n" + state.standardized_fundamentals['key_ratios']

  structured_llm = model.with_structured_output(QuantitativeValuationAnalysis)

  # 2. Attach .with_retry() to the structured runnable second
  quant_llm = structured_llm.with_retry(
      stop_after_attempt=5,
      wait_exponential_jitter=True
  )

  formatted_prompt = QUANTITATIVE_VALUATION_PROMPT.format(fundamental_data_markdown=final_md)

  print(f"Formatted Prompt Quant: {formatted_prompt}")

  analysis_result = None

  try:
    analysis_result = quant_llm.invoke(formatted_prompt)
  except Exception as e:
    print(f"Error in Quantitative Valuation Analyst LLM instance: {e}")
  finally:
    if analysis_result:
      analysis_result = analysis_result.model_dump_json(indent=2)
    else:
        analysis_result = json.dumps({
            "status": "ERROR",
            "summary": "Analysis unavailable due to upstream API error.",
            "sentiment_score": 0.0
        }, indent=2)

  return {
      "messages": [
          AIMessage(content="Quantitative analysis data ready to be displayed.")
      ],
      "quantitative_valuation_analysis": analysis_result
  }


#Node 7:
def orchestrator(state: AgentState) -> dict:
  print("Orchestrator/Risk Critic Agent Node: State: ", state)
  if not state.quantitative_valuation_analysis or not state.social_momentum_analysis:
    return {
        "messages": [AIMessage(content="Insufficient data for analysis.")],
        "dissonance_score": 0,
        "executive_summary": "Insufficient data for analysis."
    }
  quant_report = state.quantitative_valuation_analysis
  social_report = state.social_momentum_analysis

  # Format the prompt
  formatted_prompt = ORCHESTRATOR_PROMPT.format(
      quant_analysis=quant_report,
      social_analysis=social_report
  )

  # Force structured output execution
  structured_llm = model_with_tools.with_structured_output(OrchestratorOutput)

  response = None
  orchestrator_summary = None
  dissonance_score = None

  try:
    response = structured_llm.invoke(formatted_prompt)
  except Exception as e:
    print(f"Error in Orchestrator LLM instance: {e}")
  finally:
    if response:
      orchestrator_summary = getattr(response,"executive_summary","NOT_FOUND")
      dissonance_score = getattr(response, "dissonance_score",0)
    else:
      orchestrator_summary = "No data available for analysis."
      dissonance_score = 0

  print(f"Orchestrator Evaluation Complete. Dissonance Score: {dissonance_score}/10")

  return {
      "orchestrator_summary": orchestrator_summary,
      "dissonance_score": dissonance_score
  }

#Node 8:
def contradict_router(state: AgentState) -> dict:
  print("Contradictory Agent Node Router: State: ", state)
  score = state.dissonance_score
  recal_count = state.recalibration_count or 0

  if not score:
    return "no"
  elif score >= 7 and recal_count > 1 :
    return "yes"
  else:
    return "no"

#Node 9:
def adjust_confidence_weights(state: AgentState) -> dict:
  print("Adjust Confidence Weights Node: State: ", state)

  dissonance = state.dissonance_score or 0.5
  current_recalibrations = state.recalibration_count or 0

  dissonance_penalty = (dissonance / 10.0) * 0.4

  new_social_weight = max(0.1, round(0.5 - dissonance_penalty, 2))
  new_quant_weight = round(1.0 - new_social_weight, 2)

  print(f"⚠️ High Dissonance ({dissonance}/10) Detected!")
  print(f"🔄 Recalibrated Weights -> Quantitative: {new_quant_weight} | Social: {new_social_weight}")

  # 2. Return updated weights & bump iteration count
  return {
      "quant_weight": new_quant_weight,
      "social_weight": new_social_weight,
      "recalibration_count": current_recalibrations + 1
  }

#Node 10:
def action_payload(state: AgentState) -> dict:
  print("Action Payload Node: ")

  ticker = state.user_choice.ticker or "NOT_FOUND"
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

  # Enforce structured output from LLM
  structured_llm = model_with_tools.with_structured_output(InvestmentActionPayload)

  response = None
  payload_dict= None

  try:
    response = structured_llm.invoke(formatted_prompt)
  except Exception as e:
    print(f"Error in Action Payload LLM instance: {e}")
  finally:
    if not response:
      payload_dict = {
          "ticker": ticker,
          "action": "HOLD",
          "confidence_score": 0.5,
          "risk_level": "LOW",
          "reasoning_summary": "No data available for analysis.",
          "key_catalysts": [],
          "invalidation_rules": [],
          "weights_applied": {
              "quantitative": quant_weight,
              "social": social_weight
          }
      }
    else:
      # Convert Pydantic object to dictionary and append applied weights
      payload_dict = response.model_dump()
      payload_dict["weights_applied"] = {
          "quantitative": quant_weight,
          "social": social_weight
      }

  print(f"✅ Action Payload Generated: {payload_dict['action']} for {payload_dict['ticker']} (Confidence: {payload_dict['confidence_score']})")

  return {
      "final_action_payload": payload_dict
  }
  
#Node 11:
def send_action_json(state: AgentState) -> dict:
  print("Send Action Node: ")

  payload = state.final_action_payload or {}

  if not payload:
      print("❌ Error: No payload found in state to send.")
      return {
          "payload_sent": False,
          "api_response_status": 500,
          "payload": ""
      }

  formatted_json = None

  # 1. Ensure clean JSON string conversion
  if hasattr(payload, "model_dump_json"):
    formatted_json = payload.model_dump_json(indent=2)
  elif hasattr(payload, "model_dump"):
      formatted_json = json.dumps(payload.model_dump(), indent=2)
  else:
      formatted_json = json.dumps(payload, indent=2)

  # 2. Output
  print("🚀 Transmitting JSON Payload to API Endpoint:")
  print(formatted_json)

  return {
      "payload_sent": True,
      "payload": formatted_json,
      "api_response_status": 200
  }