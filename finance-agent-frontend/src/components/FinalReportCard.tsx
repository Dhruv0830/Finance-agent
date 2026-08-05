import React from "react";
import {
  Globe,
  Newspaper,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Sparkles,
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
  category: "Social Media" | "Institutional/News";
  source_name:
    | "Reddit"
    | "X (Twitter)"
    | "Web Result"
    | "MoneyControl"
    | "NSE India";
  title: string;
  url: string;
  content?: string;
}

export interface FinalReportData {
  ticker?: string;
  action?: "BUY" | "SELL" | "HOLD";
  confidence_score?: number;
  risk_level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasoning_summary?: string;
  key_catalysts?: string;
  social_momentum?: string[];
  invalidation_rules?: string[];
  weights_applied?: {};
  source_citations?: Citation[];
}

interface FinalReportCardProps {
  data: FinalReportData;
}

export const FinalReportCard: React.FC<FinalReportCardProps> = ({ data }) => {
  // console.log("This is the data", data);

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "X (Twitter)":
        return <XIcon className="w-3.5 h-3.5 text-slate-200" />;
      case "Reddit":
        return <RedditIcon className="w-3.5 h-3.5 text-orange-500" />;
      case "MoneyControl":
      case "NSE India":
        return <Newspaper className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-sky-400" />;
    }
  };

  const getVerdictStyle = (verdict?: string) => {
    switch (verdict?.toUpperCase()) {
      case "BUY":
        return "border-emerald-500/50 bg-emerald-500/10 text-emerald-400";
      case "SELL":
        return "border-rose-500/50 bg-rose-500/10 text-rose-400";
      default:
        return "border-amber-500/50 bg-amber-500/10 text-amber-400";
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto my-6 bg-white dark:bg-[#0E1523] border border-emerald-500/30 dark:border-emerald-500/40 rounded-2xl p-6 shadow-lg shadow-emerald-500/5 dark:shadow-[0_0_30px_rgba(16,185,129,0.12)] space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors">
      {/* Header Verdict Section */}
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

      {/* Summary Section */}
      {data.reasoning_summary && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />{" "}
            Executive Summary
          </h4>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#0A0F1D] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80">
            {data.reasoning_summary}
          </p>
        </div>
      )}

      {/* Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.key_catalysts && (
          <div className="p-3.5 bg-slate-50 dark:bg-[#0A0F1D] border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Quantitative Valuation
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {data.key_catalysts}
            </p>
          </div>
        )}

        {data.social_momentum && (
          <div className="p-3.5 bg-slate-50 dark:bg-[#0A0F1D] border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
            <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Social Sentiment & Buzz
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {data.social_momentum}
            </p>
          </div>
        )}
      </div>

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
