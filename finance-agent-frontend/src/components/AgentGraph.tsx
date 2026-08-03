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
      className="w-full max-w-2xl mx-auto space-y-3 py-4 pb-32 transition-all duration-300"
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
            {index > 0 && (
              <div
                className={`w-0.5 h-4 transition-colors duration-500 ${
                  isCompleted || isRunning || isHITL
                    ? "bg-linear-to-b from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    : "bg-slate-800"
                }`}
              />
            )}

            <div
              className={`w-full rounded-xl border text-xs transition-all duration-300 overflow-hidden ${
                isTerminal && (isRunning || isCompleted)
                  ? "border-emerald-400 bg-emerald-500/15 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
                  : isHITL
                    ? "border-emerald-400/80 bg-emerald-950/30 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/30"
                    : isRunning
                      ? "border-emerald-500/60 bg-[#0E1523] text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                      : isCompleted
                        ? "border-emerald-500/30 bg-[#0E1523]/90 text-emerald-400/90"
                        : isError
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                          : "border-slate-800/80 bg-[#0E1523]/40 text-slate-500"
              }`}
            >
              <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-2.5 truncate">
                  {isHITL ? (
                    <UserCheck className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
                  ) : isTerminal && (isRunning || isCompleted) ? (
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
                  ) : isRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isError ? (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <Activity className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className="font-semibold text-xs tracking-wide">
                    {node.label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-300">
                    {node.name}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold opacity-85 ${
                      isHITL ? "text-emerald-400 animate-pulse" : ""
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

              {isHITL && choices && choices.length > 0 && (
                <div className="border-t border-emerald-500/30 bg-[#080E1A] p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-emerald-300 font-medium flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Human Validation Required: Select analysis parameters
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {choices.length} options available
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {choices.map((choice, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onSelectChoice?.(choice)}
                        className="flex flex-col items-start p-2.5 bg-emerald-950/40 hover:bg-emerald-500/20 border border-emerald-500/40 hover:border-emerald-400 rounded-lg text-left group transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:shadow-emerald-500/10"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-emerald-300 group-hover:text-emerald-200">
                            {choice.ticker}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-mono uppercase">
                            {choice.market}
                          </span>
                        </div>

                        <div className="flex items-center justify-between w-full mt-2 pt-1.5 border-t border-emerald-500/20">
                          <span className="text-[10px] text-slate-400 font-mono">
                            Lookback:{" "}
                            <strong className="text-slate-200 font-semibold">
                              {choice.lookback_days}d
                            </strong>
                          </span>
                          <ArrowRight className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {node.nodeStreamText && !isTerminal && (
                <div className="border-t border-slate-800/80 bg-[#060911] p-3 text-xs font-mono text-slate-300 max-h-48 overflow-y-auto">
                  <div className="flex items-center gap-2 text-emerald-400/80 pb-1.5 mb-1.5 border-b border-slate-800/80 text-[10px]">
                    <Terminal className="w-3 h-3" />
                    <span>Node Output Log</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono leading-relaxed text-slate-300">
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
