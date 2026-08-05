import React, { useEffect, useRef } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserCheck,
  Activity,
  Terminal,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export interface ChoiceOption {
  ticker: string;
  lookback_days: number;
  market: string;
}

export interface NodeStatus {
  name: string;
  label: string;
  status: "idle" | "running" | "completed" | "error";
  nodeStreamText?: string;
}

interface AgentGraphProps {
  nodes: NodeStatus[];
  streamText?: string;
  isAnalyzing?: boolean;
  choices?: ChoiceOption[] | null;
  onSelectChoice?: (choice: ChoiceOption) => void;
}

export const AgentGraph: React.FC<AgentGraphProps> = ({
  nodes,
  choices,
  onSelectChoice,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isTerminalNode = (name: string) => name === "action_payload";

  useEffect(() => {
    const animationFrame = requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: "smooth",
        });
      } else {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
      }
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [nodes, choices]);

  return (
    // Added pb-32 to account for floating fixed chat bars at the screen bottom
    <div
      ref={containerRef}
      className="w-full max-w-2xl mx-auto space-y-3 py-4 pb-8 transition-all duration-300"
    >
      {nodes.map((node, index) => {
        const isRunning = node.status === "running";
        const isCompleted = node.status === "completed";
        const isError = node.status === "error";
        const isTerminal = isTerminalNode(node.name);

        const isHITL =
          node.name === "ask_human" && Boolean(choices && choices.length > 0);

        return (
          <div
            key={`${node.name}-${index}`}
            className="relative flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            {/* Connecting Line */}
            {index > 0 && (
              <div
                className={`w-0.5 h-4 transition-colors duration-500 ${
                  isCompleted || isRunning || isHITL
                    ? "bg-linear-to-b from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    : "bg-slate-200 dark:bg-slate-800"
                }`}
              />
            )}

            {/* Node Box */}
            <div
              className={`w-full rounded-xl border text-xs transition-all duration-300 overflow-hidden ${
                isTerminal && (isRunning || isCompleted)
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.2)]"
                  : isHITL
                    ? "border-emerald-500/80 bg-emerald-50/90 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/30"
                    : isRunning
                      ? "border-emerald-500 bg-emerald-50/60 text-emerald-900 dark:border-emerald-500/60 dark:bg-[#0E1523] dark:text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                      : isCompleted
                        ? "border-emerald-500/40 bg-white text-slate-800 dark:border-emerald-500/30 dark:bg-[#0E1523]/90 dark:text-emerald-400/90 shadow-xs"
                        : isError
                          ? "border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-400"
                          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800/80 dark:bg-[#0E1523]/40 dark:text-slate-500"
              }`}
            >
              {/* Header Row */}
              <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-2.5 truncate">
                  {isHITL ? (
                    <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
                  ) : isTerminal && (isRunning || isCompleted) ? (
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
                  ) : isRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : isError ? (
                    <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                  ) : (
                    <Activity className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0" />
                  )}
                  <span className="font-semibold text-xs tracking-wide">
                    {node.label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-900/80 dark:border-slate-800 dark:text-slate-300">
                    {node.name}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold opacity-90 ${
                      isHITL
                        ? "text-emerald-600 dark:text-emerald-400 animate-pulse"
                        : ""
                    }`}
                  >
                    {isHITL
                      ? "ACTION NEEDED"
                      : isTerminal
                        ? "FINAL VERDICT"
                        : node.status}
                  </span>
                </div>
              </div>

              {/* HITL Choices Block */}
              {isHITL && choices && choices.length > 0 && (
                <div className="border-t border-emerald-500/30 bg-emerald-50/70 dark:bg-[#080E1A] p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-emerald-900 dark:text-emerald-300 font-medium flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Human Validation Required: Select analysis parameters
                    </p>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {choices.length} options available
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {choices.map((choice, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onSelectChoice?.(choice)}
                        className="flex flex-col items-start p-2.5 bg-white hover:bg-emerald-100/60 border border-emerald-300 hover:border-emerald-500 dark:bg-emerald-950/40 dark:hover:bg-emerald-500/20 dark:border-emerald-500/40 dark:hover:border-emerald-400 rounded-lg text-left group transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:shadow-emerald-500/10"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 group-hover:text-emerald-950 dark:group-hover:text-emerald-200">
                            {choice.ticker}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-500/20 dark:border-emerald-500/30 dark:text-emerald-400 font-mono uppercase">
                            {choice.market}
                          </span>
                        </div>

                        <div className="flex items-center justify-between w-full mt-2 pt-1.5 border-t border-emerald-200 dark:border-emerald-500/20">
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                            Lookback:{" "}
                            <strong className="text-slate-900 dark:text-slate-200 font-semibold">
                              {choice.lookback_days}d
                            </strong>
                          </span>
                          <ArrowRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Stream Output Log */}
              {node.nodeStreamText && !isTerminal && (
                <div className="border-t border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-[#060911] p-3 text-xs font-mono text-slate-800 dark:text-slate-300 max-h-48 overflow-y-auto transition-colors duration-300">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 pb-1.5 mb-1.5 border-b border-slate-200 dark:border-slate-800 text-[10px] font-semibold">
                    <Terminal className="w-3 h-3" />
                    <span>Node Output Log</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono leading-relaxed text-slate-700 dark:text-slate-300">
                    {node.nodeStreamText}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
