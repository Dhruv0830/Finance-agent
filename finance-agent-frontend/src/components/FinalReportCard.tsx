import React from "react";
import {
  Globe,
  Newspaper,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  BarChart3,
  Scale,
  BrainCircuit,
  AlertTriangle,
  Flame,
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

export interface FinancialMetric {
  label: string;
  value: number;
}

export interface FinalReportData {
  ticker?: string;
  action?: "BUY" | "SELL" | "HOLD";
  confidence_score?: number;
  risk_level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dissonance_score?: number;
  quant_weight?: number;
  social_weight?: number;
  weights_applied?: {
    quant_weight?: number;
    social_weight?: number;
    [key: string]: any;
  };
  reasoning_summary?: string;
  orchestrator_summary?: string;
  key_catalysts?: string;
  quantitative_valuation_analysis?: string;
  social_momentum?: string[] | string;
  social_momentum_analysis?: string;
  invalidation_rules?: string[];
  financial_data?: FinancialMetric[];
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

  // Helper to resolve weights (from direct props or weights_applied object)
  const rawQuant =
    data.quant_weight ?? data.weights_applied?.quant_weight ?? 0.5;
  const rawSocial =
    data.social_weight ?? data.weights_applied?.social_weight ?? 0.5;
  const quantPct = rawQuant <= 1 ? Math.round(rawQuant * 100) : rawQuant;
  const socialPct = rawSocial <= 1 ? Math.round(rawSocial * 100) : rawSocial;

  // Maximum value for scaling the financial metric bar chart
  const maxFinVal = data.financial_data
    ? Math.max(...data.financial_data.map((d) => Math.abs(d.value)), 1)
    : 1;

  // Resolve combined text summaries
  const execSummary = data.orchestrator_summary || data.reasoning_summary;
  const quantAnalysis =
    data.quantitative_valuation_analysis || data.key_catalysts;
  const socialAnalysis =
    data.social_momentum_analysis ||
    (Array.isArray(data.social_momentum)
      ? data.social_momentum.join(" • ")
      : data.social_momentum);

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
              <span>{data.ticker || "ANALYSIS VERDICT"}</span>
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
              {data.action}{" "}
              {data.confidence_score ? `(${data.confidence_score}%)` : ""}
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
              {data.dissonance_score ?? 0}%
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                (data.dissonance_score ?? 0) > 50
                  ? "bg-rose-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(data.dissonance_score ?? 0, 100)}%` }}
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

      {/* Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quantAnalysis && (
          <div className="p-3.5 bg-slate-50 dark:bg-[#0A0F1D] border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Quantitative Valuation
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {quantAnalysis}
            </p>
          </div>
        )}

        {socialAnalysis && (
          <div className="p-3.5 bg-slate-50 dark:bg-[#0A0F1D] border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
            <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Social Sentiment & Buzz
            </span>
            {Array.isArray(data.social_momentum) ? (
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                {data.social_momentum.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {socialAnalysis}
              </p>
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

      {/* Financial Metrics Visual Graph */}
      {data.financial_data && data.financial_data.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />{" "}
            Financial Metrics Overview
          </h4>
          <div className="p-4 bg-slate-50 dark:bg-[#0A0F1D] border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            {data.financial_data.map((item, idx) => {
              const barWidthPct = Math.min(
                Math.round((Math.abs(item.value) / maxFinVal) * 100),
                100,
              );
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>{item.label}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${barWidthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
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
