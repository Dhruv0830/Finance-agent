from pydantic import BaseModel, Field
from typing import Annotated, Literal, Optional, List, Dict, Any
from langchain.messages import AnyMessage
from langgraph.graph.message import add_messages


class AgentInput(BaseModel):
    ticker: str = Field(description="The stock ticker symbol extracted from the query, e.g., NVDA, RELIANCE, or 'NOT_FOUND' if completely invalid")
    market: Literal["US", "INDIA", "NOT_FOUND"] = Field(
        description="Select 'INDIA' or 'US' only if certain. If the ticker is ambiguous, unfamiliar, or a short-form like TMPV, select 'NOT_FOUND'."
    )
    lookback_days: int = Field(default=7, description="Number of historical days to analyze. Default to 7 if not specified.")


class CitationMetadata(BaseModel):
    category: str # 'Social Media' or 'Institutional/News'
    source_name: str # 'Reddit', 'X', 'NSE India', 'MoneyControl', etc.
    title: str
    url: str
    content: str


class AgentState(BaseModel):
    # 1. State lists with LangGraph reducers MUST use Annotated inside the Pydantic structure
    messages: Annotated[List[AnyMessage], add_messages] = Field(default_factory=list)

    # --- HITL State Fields ---
    company_name: Optional[str] = None
    search_options: Optional[List[AgentInput]] = None  # To hold options like [{"exchange": "NSE", "symbol": "TATAMOTORS"}]
    user_choice: Optional[AgentInput] = None

    #fundamental and social data
    fundamental_raw: Optional[dict] = None
    social_raw: Optional[Dict[str,dict]] = None

    standardized_fundamentals: Optional[dict] = None
    standardized_social_dump: Optional[str] = None

    #Sources for frontend
    source_citations: Optional[List[CitationMetadata]] = None

    #Social Momentum Analysis Model
    social_momentum_analysis: Optional[dict] = None
    quantitative_valuation_analysis: Optional[dict] = None

    #Orchestrator Outputs
    orchestrator_summary: Optional[str] = None # Combined executive report
    dissonance_score: Optional[int] = None     # Numeric score (1-10) for routing logic
    social_weight: Optional[float] = None      # Adjusted dynamically if dissonance is high
    quant_weight: Optional[float] = None
    recalibration_count: Optional[int] = None

    #Action Payload
    final_action_payload: Optional[Dict[str, Any]] = None

    # #Terminal status tracker
    # payload_sent: Optional[bool] = None
    # payload: Optional[str] = None
    # api_response_status: Optional[str] = None



class StructuredCompanyListings(BaseModel):
    company_name: str = Field(description="Extract the primary official name of the corporation")
    listings: List[AgentInput] = Field(description="Extract the latest official stock listings")
    
    
class SocialMomentumAnalysis(BaseModel):
    momentum_score: float = Field(
        description="Sentiment index score ranging from -1.0 (Extreme Bearish) to +1.0 (Extreme Bullish)."
    )
    sentiment_label: str = Field(
        description="Categorical sentiment label (e.g., 'Bullish', 'Neutral / Mixed', 'Bearish')."
    )
    sample_counts: dict = Field(
        description="Count of relevant posts processed (e.g., {'reddit_count': 2, 'x_count': 1})."
    )
    key_bullish_drivers: List[str] = Field(
        description="List of positive catalysts mentioned by retail investors or news feeds."
    )
    key_bearish_drivers: List[str] = Field(
        description="List of negative catalysts or valuation concerns raised in discussions."
    )
    risk_flags: List[str] = Field(
        description="Specific warning signs (e.g., 'Speculative AGM Hype', 'Flat Revenue Growth')."
    )
    executive_summary: str = Field(
        description="A 5 point qualitative synthesis of the overall retail and market sentiment."
    )


class ValuationMultiples(BaseModel):
    pe_ratio: Optional[float] = Field(description="Price-to-Earnings Ratio")
    pb_ratio: Optional[float] = Field(description="Price-to-Book Ratio")
    ev_ebitda: Optional[float] = Field(description="Enterprise Value to EBITDA Ratio")
    peg_ratio: Optional[float] = Field(description="Price/Earnings-to-Growth Ratio")
    roe_percentage: Optional[float] = Field(description="Return on Equity (%)")
    debt_to_equity: Optional[float] = Field(description="Debt-to-Equity Ratio")


class IntrinsicValuationModel(BaseModel):
    current_market_price: float = Field(description="Current Stock Price (CMP)")
    estimated_intrinsic_value: Optional[float] = Field(description="Estimated Intrinsic Value per share")
    upside_downside_pct: Optional[float] = Field(description="Percentage difference between Intrinsic Value and CMP")
    valuation_status: str = Field(
        description="Classification: 'Significantly Undervalued', 'Fairly Valued', or 'Overvalued'"
    )
    has_margin_of_safety: bool = Field(description="True if upside > 15%")


class QuantitativeValuationAnalysis(BaseModel):
    ticker: str = Field(description="Stock Ticker Symbol")
    multiples: ValuationMultiples
    intrinsic_model: IntrinsicValuationModel
    key_strengths: List[str] = Field(description="Positive financial/fundamental highlights (e.g., high ROE, low debt)")
    key_concerns: List[str] = Field(description="Financial red flags or expensive metrics (e.g., stagnant revenue, high PE)")
    valuation_summary: str = Field(description="A 15 point quantitative summary of the stock's valuation")
    

class OrchestratorOutput(BaseModel):
    executive_summary: str = Field(description="Synthesized investment summary evaluating both reports.")
    dissonance_score: int = Field(description="Score from 1 to 10 indicating conflict between social hype and valuation.")
    key_risks: List[str] = Field(description="Bullet points highlighting core risks detected.")

    
class InvestmentActionPayload(BaseModel):
    ticker: str = Field(description="The ticker symbol evaluated (e.g. RELIANCE.NS, NVDA)")
    action: str = Field(description="Recommended execution stance: BUY, SELL, or HOLD")
    confidence_score: float = Field(description="Overall decision confidence from 0.00 to 1.00")
    risk_level: str = Field(description="Assessed risk level: LOW, MEDIUM, HIGH, or CRITICAL")
    reasoning_summary: str = Field(description="Concise 2-3 sentence executive explanation for the recommendation")
    key_catalysts: List[str] = Field(description="Primary positive or negative growth drivers identified")
    invalidation_rules: List[str] = Field(description="Conditions under which this recommendation becomes invalid")