import React from "react";
import {
  Globe,
  Newspaper,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Scale,
  BrainCircuit,
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Activity,
  Layers,
} from "lucide-react";

// Custom X (Twitter) Icon
const XIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Custom Reddit Icon
const RedditIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701z" />
  </svg>
);

export interface Citation {
  category?: "Social Media" | "Institutional/News";
  source_name:
    | "Reddit"
    | "X (Twitter)"
    | "Web Result"
    | "MoneyControl"
    | "NSE India"
    | string;
  title: string;
  url: string;
  content?: string;
}

export interface FinalReportData {
  ticker?: string;
  action?: "BUY" | "SELL" | "HOLD";
  confidence_score?: number;
  risk_level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dissonance_score?: number;
  weights_applied?: {
    quant?: number;
    social?: number;
    quant_weight?: number;
    social_weight?: number;
    [key: string]: any;
  };
  reasoning_summary?: string;
  orchestrator_summary?: string;
  key_catalysts?: string[];
  quantitative_valuation_analysis?: {
    ticker?: string;
    multiples?: {
      pb_ratio?: number;
      pe_ratio?: number;
      ev_ebitda?: number;
      peg_ratio?: number;
      debt_to_equity?: number;
      roe_percentage?: number;
      [key: string]: any;
    };
    intrinsic_model?: {
      valuation_status?: string;
      upside_downside_pct?: number | null;
      current_market_price?: number;
      has_margin_of_safety?: boolean;
      estimated_intrinsic_value?: number | null;
    };
    key_strengths?: string[];
    key_concerns?: string[];
    valuation_summary?: string;
  };
  social_momentum_analysis?: {
    risk_flags?: string[];
    sample_counts?: {
      x_count?: number;
      news_count?: number;
      reddit_count?: number;
      [key: string]: any;
    };
    momentum_score?: number;
    sentiment_label?: string;
    executive_summary?: string;
    key_bearish_drivers?: string[];
    key_bullish_drivers?: string[];
  };
  invalidation_rules?: string[];
  source_citations?: Citation[];
}

interface FinalReportCardProps {
  data: FinalReportData;
}

export const FinalReportCard: React.FC<FinalReportCardProps> = ({ data }) => {
  const getSourceIcon = (type: string) => {
    switch (type) {
      case "X (Twitter)":
        return (
          <XIcon className="w-3.5 h-3.5 text-slate-800 dark:text-slate-200" />
        );
      case "Reddit":
        return <RedditIcon className="w-3.5 h-3.5 text-orange-500" />;
      case "MoneyControl":
      case "NSE India":
        return (
          <Newspaper className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        );
      default:
        return <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />;
    }
  };

  const getVerdictStyle = (verdict?: string) => {
    switch (verdict?.toUpperCase()) {
      case "BUY":
        return "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
      case "SELL":
        return "border-rose-500/50 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400";
      default:
        return "border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400";
    }
  };

  const getRiskStyle = (risk?: string) => {
    switch (risk?.toUpperCase()) {
      case "LOW":
        return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
      case "MEDIUM":
        return "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800";
      case "HIGH":
      case "CRITICAL":
        return "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700";
    }
  };

  // Helper to resolve weights
  const rawQuant =
    data.weights_applied?.quant ?? data.weights_applied?.quant_weight ?? 0.5;
  const rawSocial =
    data.weights_applied?.social ?? data.weights_applied?.social_weight ?? 0.5;
  const rawConfidence = data.confidence_score ?? 0.1;
  const quantPct = rawQuant <= 1 ? Math.round(rawQuant * 100) : rawQuant;
  const socialPct = rawSocial <= 1 ? Math.round(rawSocial * 100) : rawSocial;
  const confidencePct =
    rawConfidence <= 1 ? Math.round(rawConfidence * 100) : rawConfidence;

  // Summaries
  const execSummary = data.orchestrator_summary || data.reasoning_summary;
  const quantNode = data.quantitative_valuation_analysis;
  const socialNode = data.social_momentum_analysis;

  return (
    <div className="w-full max-w-3xl mx-auto my-6 bg-white dark:bg-[#0E1523] border border-emerald-500/30 dark:border-emerald-500/40 rounded-2xl p-6 shadow-lg shadow-emerald-500/5 dark:shadow-[0_0_30px_rgba(16,185,129,0.12)] space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors">
      {/* Header Verdict & Risk Section */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>
                {data.ticker || quantNode?.ticker || "ANALYSIS VERDICT"}
              </span>
              <span className="text-xs text-slate-500 font-mono font-normal">
                Final Intelligence Synthesis
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Aggregated from Fundamental & Social Intelligence Nodes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data.risk_level && (
            <span
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold tracking-wider ${getRiskStyle(
                data.risk_level,
              )}`}
            >
              RISK: {data.risk_level}
            </span>
          )}

          {data.action && (
            <div
              className={`px-4 py-2 rounded-xl border text-sm font-extrabold tracking-wider ${getVerdictStyle(
                data.action,
              )}`}
            >
              {data.action} {confidencePct ? `(${confidencePct}%)` : ""}
            </div>
          )}
        </div>
      </div>

      {/* Intelligence Weights & Dissonance Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-[#0A0F1D] border border-slate-200 dark:border-slate-800 rounded-xl">
        {/* Dissonance Score */}
        <div className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-amber-500" /> Dissonance
            </span>
            <span className="font-mono text-slate-900 dark:text-slate-200">
              {data.dissonance_score ?? 0}/10
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                (data.dissonance_score ?? 0) > 4
                  ? "bg-rose-500"
                  : "bg-emerald-500"
              }`}
              style={{
                width: `${Math.min(((data.dissonance_score ?? 0) / 10) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Quant Weight */}
        <div className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Quant
              Weight
            </span>
            <span className="font-mono text-slate-900 dark:text-slate-200">
              {quantPct}%
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${quantPct}%` }}
            />
          </div>
        </div>

        {/* Social Weight */}
        <div className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-500" /> Social Weight
            </span>
            <span className="font-mono text-slate-900 dark:text-slate-200">
              {socialPct}%
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all duration-500"
              style={{ width: `${socialPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Executive / Orchestrator Summary */}
      {execSummary && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
            {data.orchestrator_summary ? (
              <BrainCircuit className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
            Executive Summary & Orchestration
          </h4>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#0A0F1D] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80">
            {execSummary}
          </p>
        </div>
      )}

      {/* Key Catalysts (Top Highlights) */}
      {data.key_catalysts && data.key_catalysts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" /> Core Catalysts
          </h4>
          <div className="p-3.5 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
            <ul className="text-xs text-slate-800 dark:text-slate-300 space-y-1.5 list-disc list-inside">
              {data.key_catalysts.map((catalyst, idx) => (
                <li key={idx}>{catalyst}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* DETAILED NODE ANALYSES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quantitative Valuation Node Card */}
        {quantNode && (
          <div className="p-4 bg-slate-50 dark:bg-[#0A0F1D] border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Quantitative Valuation
              </span>
              {quantNode.intrinsic_model?.valuation_status && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {quantNode.intrinsic_model.valuation_status}
                </span>
              )}
            </div>

            {/* Valuation Multiples Grid */}
            {quantNode.multiples && (
              <div className="grid grid-cols-3 gap-2 py-1">
                <div className="p-1.5 bg-white dark:bg-[#0E1523] border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">P/E</span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    {quantNode.multiples.pe_ratio ?? "N/A"}
                  </span>
                </div>
                <div className="p-1.5 bg-white dark:bg-[#0E1523] border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">P/B</span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    {quantNode.multiples.pb_ratio ?? "N/A"}
                  </span>
                </div>
                <div className="p-1.5 bg-white dark:bg-[#0E1523] border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">PEG</span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    {quantNode.multiples.peg_ratio ?? "N/A"}
                  </span>
                </div>
                <div className="p-1.5 bg-white dark:bg-[#0E1523] border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">
                    EV/EBITDA
                  </span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    {quantNode.multiples.ev_ebitda ?? "N/A"}
                  </span>
                </div>
                <div className="p-1.5 bg-white dark:bg-[#0E1523] border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">ROE</span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    {quantNode.multiples.roe_percentage
                      ? `${quantNode.multiples.roe_percentage}%`
                      : "N/A"}
                  </span>
                </div>
                <div className="p-1.5 bg-white dark:bg-[#0E1523] border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">D/E</span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    {quantNode.multiples.debt_to_equity ?? "N/A"}
                  </span>
                </div>
              </div>
            )}

            {/* Key Strengths & Concerns */}
            {quantNode.key_concerns && quantNode.key_concerns.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                  Key Risks
                </span>
                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                  {quantNode.key_concerns.map((concern, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <XCircle className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                      <span>{concern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {quantNode.key_strengths && quantNode.key_strengths.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                  Strengths
                </span>
                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                  {quantNode.key_strengths.map((strength, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {quantNode.valuation_summary && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800/60 leading-relaxed">
                {quantNode.valuation_summary}
              </p>
            )}
          </div>
        )}

        {/* Social Momentum Node Card */}
        {socialNode && (
          <div className="p-4 bg-slate-50 dark:bg-[#0A0F1D] border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Social Momentum
              </span>
              <div className="flex items-center gap-1.5">
                {socialNode.sentiment_label && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300">
                    {socialNode.sentiment_label}
                  </span>
                )}
                {socialNode.momentum_score !== undefined && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Score: {socialNode.momentum_score}
                  </span>
                )}
              </div>
            </div>

            {/* Sample Distribution */}
            {socialNode.sample_counts && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0E1523] p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                <Layers className="w-3 h-3 text-slate-400" />
                <span>News: {socialNode.sample_counts.news_count ?? 0}</span> |
                <span>
                  Reddit: {socialNode.sample_counts.reddit_count ?? 0}
                </span>{" "}
                |<span>X: {socialNode.sample_counts.x_count ?? 0}</span>
              </div>
            )}

            {/* Executive Summary */}
            {socialNode.executive_summary && (
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {socialNode.executive_summary}
              </p>
            )}

            {/* Bearish Drivers */}
            {socialNode.key_bearish_drivers &&
              socialNode.key_bearish_drivers.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                    Bearish Drivers
                  </span>
                  <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                    {socialNode.key_bearish_drivers.map((driver, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <TrendingDown className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                        <span>{driver}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Bullish Drivers */}
            {socialNode.key_bullish_drivers &&
              socialNode.key_bullish_drivers.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                    Bullish Drivers
                  </span>
                  <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                    {socialNode.key_bullish_drivers.map((driver, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{driver}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Invalidation Rules */}
      {data.invalidation_rules && data.invalidation_rules.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Thesis
            Invalidation Rules
          </h4>
          <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl">
            <ul className="text-xs text-rose-900 dark:text-rose-300 space-y-1.5 list-disc list-inside">
              {data.invalidation_rules.map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Citations & Sources */}
      {data.source_citations && data.source_citations.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Verified Citations & Sources
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {data.source_citations.map((cite, idx) => (
              <a
                key={idx}
                href={cite.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 dark:bg-[#0A0F1D] dark:hover:bg-[#121A2D] border border-slate-200 dark:border-slate-800/80 dark:hover:border-slate-700 rounded-xl transition-all duration-200 group shadow-2xs hover:shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="p-2 bg-white dark:bg-[#0E1523] border border-slate-200 dark:border-slate-800 rounded-lg shrink-0">
                    {getSourceIcon(cite.source_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {cite.title}
                    </p>
                    {cite.content && (
                      <p className="text-[10px] text-slate-500 truncate">
                        {cite.content}
                      </p>
                    )}
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
