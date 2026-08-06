"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useEffect } from "react";
import { createClient } from "@/src/lib/supabase";
import { useRouter } from "next/navigation";
import {
  FinalReportCard,
  FinalReportData,
} from "@/src/components/FinalReportCard";
import {
  AgentGraph,
  NodeStatus,
  ChoiceOption,
} from "@/src/components/AgentGraph";
import { useTheme } from "next-themes";
import Link from "next/link";
import {
  TrendingUp,
  Sun,
  Moon,
  Plus,
  ChevronDown,
  ChevronRight,
  User,
  Settings,
  LogOut,
  Send,
  HelpCircle,
  Menu,
  X,
  FileText,
  MessageSquare,
  ArrowDown,
} from "lucide-react";
import {
  UserThreads,
  getCookie,
  ChatMessage,
  LoadingSpinner,
  ThreadWithColor,
  Thread,
} from "../profile/page";
import { convertSegmentPathToStaticExportFilename } from "next/dist/shared/lib/segment-cache/segment-value-encoding";

const GRAPH_NODES: Record<string, string> = {
  stock_search: "1. Extract Ticker",
  ask_human: "2. Human Validation",

  india_fundamental: "3. Market Analysis",
  india_X_reddit: "4. Social Buzz",
  us_fundamental: "3. Market Analysis",
  us_X_reddit: "4. Social Buzz",

  state_consolidation: "5. Aggregating Data",
  social_momentum_analyst: "6. Social Momentum Analyst",

  quantitative_valuation_analyst: "7. Quantitative Valuation Analyst",

  orchestrator: "8. Aggregating Results",

  action_payload: "9. Generating Verdict",
};

export default function AnalyseDashboard() {
  const [user, setUser] = useState<any>(null);
  const [prompt, setPrompt] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSideBar, setShowSideBar] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const supabase = createClient();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Workspace UI transitions
  const [hasStarted, setHasStarted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [finalReport, setFinalReport] = useState<FinalReportData | null>(null);
  const [isGraphExpanded, setIsGraphExpanded] = useState(true);
  const [isReportExpanded, setIsReportExpanded] = useState(true);
  const [showChatFloater, setShowChatFloater] = useState(false);

  // Endpoint Routing Mode: 'analyse' vs 'chat'
  const [activeEndpoint, setActiveEndpoint] = useState<"analyse" | "chat">(
    "analyse",
  );

  // State typed as ChoiceOption[]
  const [hitlChoices, setHitlChoices] = useState<ChoiceOption[] | null>(null);
  const [threadId, setThreadId] = useState<string>("");
  // Data State
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const [streamText, setStreamText] = useState("");

  const metadata = user?.user_metadata || {};
  const avatarUrl = metadata.avatar_url || metadata.picture || null;
  const displayName =
    metadata.full_name?.toUpperCase() ||
    metadata.name ||
    metadata.user_name ||
    metadata.preferred_username ||
    user?.email?.split("@")[0] ||
    "User";

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login");
      else setUser(user);
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const updateNodeState = (nodeName: string, chunkContent: string) => {
    const label = GRAPH_NODES[nodeName] || nodeName;

    setNodes((prevNodes: NodeStatus[]) => {
      const existingIndex = prevNodes.findIndex((n) => n.name === nodeName);

      // 1. NODE DOES NOT EXIST YET -> Append as new running node & complete active prior nodes
      if (existingIndex === -1) {
        return [
          ...prevNodes.map((n) =>
            n.status === "running" ? { ...n, status: "completed" as const } : n,
          ),
          {
            name: nodeName,
            label: label,
            status: "running",
            nodeStreamText: chunkContent,
          },
        ];
      }

      // 2. NODE ALREADY EXISTS -> Append live text output to this specific node
      return prevNodes.map((node, idx) => {
        if (idx === existingIndex) {
          return {
            ...node,
            status: "running",
            nodeStreamText: chunkContent,
          };
        }
        return node;
      });
    });
  };

  /**
   * Helper to trigger complete state & collapse graph only when final completion yield arrives
   */
  const handleCompleteEvent = () => {
    setIsGraphExpanded(false);
    setIsReportExpanded(true);
    setShowChatFloater(true);
  };

  /**
   * Processes stream chunks line by line
   */
  const processStreamReader = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    isResumeFlow: boolean = false,
  ) => {
    const decoder = new TextDecoder("utf-8");
    let accumulated = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      accumulated += chunk;
      setStreamText((prev) => prev + chunk);

      // Get thread id

      if (chunk.includes("thread_id")) {
        try {
          const threadIdMatch = chunk.match(/"thread_id"\s*:\s*"([^"]+)"/);
          if (threadIdMatch && threadIdMatch[1]) {
            const parsedChoices: string = threadIdMatch[1];
            setThreadId(parsedChoices);
          }
        } catch (e) {
          console.warn("Could not parse thread id JSON chunk:", e);
        }
      }

      // --- 1. Parse Choice / Human-in-the-Loop Options ---
      if (
        chunk.includes("options") ||
        chunk.includes("choices") ||
        chunk.includes("lookback_days")
      ) {
        try {
          const choicesMatch = chunk.match(
            /"(?:options|choices)"\s*:\s*(\[\s*\{[\s\S]*?\}\s*\])/,
          );
          if (choicesMatch && choicesMatch[1]) {
            const parsedChoices: ChoiceOption[] = JSON.parse(choicesMatch[1]);
            setHitlChoices(parsedChoices);
          }
        } catch (e) {
          console.warn("Could not parse choices JSON chunk:", e);
        }
      }

      // --- 2. Dynamic One-by-One Node Graph Execution ---
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;

        let detectedNode: string | null = null;
        let eventPayload = line;

        if (line.includes("event: complete")) {
          handleCompleteEvent();
        }

        try {
          const cleanLine = line.replace(/^data:\s*/, "").trim();

          const parsed = JSON.parse(cleanLine);
          if (parsed?.state?.final_action_payload) {
            console.log("parsed for action", parsed);
            // Extract the inner payload object (or fallback to parsed if it's top-level)
            const reportPayload = parsed.state.final_action_payload;
            setFinalReport(reportPayload);
          }

          // ONLY COLLAPSE GRAPH WHEN WE GET {"event": "complete", "data": ...}

          if (parsed.node && GRAPH_NODES[parsed.node]) {
            detectedNode = parsed.node;
            eventPayload = parsed.content || parsed.data || line;
          } else if (parsed.event && GRAPH_NODES[parsed.event]) {
            detectedNode = parsed.event;
            eventPayload =
              typeof parsed.data === "string"
                ? parsed.data
                : JSON.stringify(parsed.data);
          }
        } catch {
          // Fallback check for raw completion string in stream
          if (line.includes("event: complete") && line.includes("finished")) {
            handleCompleteEvent();
          }

          for (const nodeKey of Object.keys(GRAPH_NODES)) {
            if (line.includes(nodeKey)) {
              detectedNode = nodeKey;
              break;
            }
          }
        }

        if (detectedNode) {
          updateNodeState(detectedNode, eventPayload);
        } else if (isResumeFlow) {
          setNodes((prevNodes) =>
            prevNodes.map((n) =>
              n.status === "running"
                ? { ...n, nodeStreamText: (n.nodeStreamText || "") + line }
                : n,
            ),
          );
        }
      }
    }

    return accumulated;
  };

  /**
   * Primary Submit Handler
   */
  const handleSubmit = async (userPrompt?: string) => {
    const textToSend = userPrompt || prompt;
    if (!textToSend.trim() || isAnalyzing) return;

    setShowChatFloater(false);
    setHasStarted(true);
    setPrompt("");
    setIsAnalyzing(true);

    const isChat = activeEndpoint === "chat";
    const endpoint = isChat
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/finance/chat`
      : `${process.env.NEXT_PUBLIC_API_URL}/api/finance/analyse`;

    if (!isChat) {
      setStreamText("");
      setNodes([]);
      setFinalReport(null);
      setIsGraphExpanded(true); // Keep expanded when starting analysis
    }
    const assistantMsgId = (Date.now() + 1).toString();

    if (isChat) {
      const userMsgId = crypto.randomUUID();

      // 1. Optimistically append User Message + empty Assistant Message placeholder
      setChatMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "chat_user", content: textToSend.trim() },
        { id: assistantMsgId, role: "chat_agent", content: "" },
      ]);
    }

    try {
      const token = await getCookie(supabase);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: textToSend.trim(),
          thread_id: threadId,
        }),
      });

      if (!response.ok || !response.body) {
        console.log(`HTTP error! Status: ${response.status}`);
        return;
      }

      const reader = response.body.getReader();

      if (isChat) {
        // 2. Stream tokens directly into the chatMessages state
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Keep incomplete line chunk in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const rawData = line.replace("data: ", "").trim();
              if (rawData === "[DONE]") break;

              try {
                const parsed = JSON.parse(rawData);
                if (parsed.type === "token" && parsed.content) {
                  // Append token chunk to the target assistant message
                  setChatMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: msg.content + parsed.content }
                        : msg,
                    ),
                  );
                }
              } catch (e) {
                console.error("Error parsing JSON chunk:", e);
              }
            }
          }
        }
      } else {
        await processStreamReader(reader);
      }
    } catch (error) {
      console.log("Request failed:", error);
      if (!isChat) {
        setNodes((prev) =>
          prev.map((n) =>
            n.status === "running" ? { ...n, status: "error" as const } : n,
          ),
        );
      } else {
        // Mark assistant message with error notice if request failed
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content:
                    "Sorry, I encountered an error processing your request.",
                }
              : msg,
          ),
        );
      }
    } finally {
      if (!hitlChoices) {
        setIsAnalyzing(false);
      }
    }
  };
  /**
   * HITL Choice Resume Handler
   */
  const handleResumeChoice = async (selectedChoice: ChoiceOption) => {
    setHitlChoices(null);
    setIsAnalyzing(true);

    // Mark HITL node complete, graph STAYS EXPANDED until complete yield arrives
    setNodes((prev) =>
      prev.map((n) =>
        n.name === "ask_human_node"
          ? { ...n, status: "completed" as const }
          : n,
      ),
    );

    try {
      const token = await getCookie(supabase);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/resume`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_response: selectedChoice,
            thread_id: threadId,
          }),
        },
      );

      if (!response.ok || !response.body) {
        console.log(`HTTP error! Status: ${response.status}`);
        return;
      }

      const reader = response.body.getReader();
      const output = await processStreamReader(reader, true);

      setNodes((prev) =>
        prev.map((n) => ({ ...n, status: "completed" as const })),
      );

      setActiveEndpoint("chat");
    } catch (error) {
      console.log("Resume execution failed:", error);
      setNodes((prev) =>
        prev.map((n) =>
          n.status === "running" ? { ...n, status: "error" as const } : n,
        ),
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveChatConversation = () => {
    setHasStarted(false);
    setNodes([]);
    setThreadId("");
    setShowChatFloater(false);
    setFinalReport(null);
    setActiveEndpoint("analyse");
    setIsGraphExpanded(false);
  };

  const handlePromptClick = (text: string) => {
    setPrompt(text);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#07090E] text-slate-800 dark:text-slate-100 font-sans antialiased overflow-hidden transition-colors duration-200">
      {/* LEFT SIDEBAR */}
      {showSideBar && (
        <aside className="w-75 h-screen bg-white dark:bg-[#0A0E17] border-r border-slate-200 dark:border-slate-800/60 flex flex-col justify-between p-4 relative shrink-0 transition-colors duration-200 z-30">
          {/* Top Section (Fixed Header + Scrollable Threads) */}
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Logo Bar */}
            <div className="flex items-center justify-between mb-5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
                  FinAgent
                </span>
              </div>
              <button
                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                onClick={() => setShowSideBar(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Analysis Button */}
            <button
              onClick={() => {
                saveChatConversation();
              }}
              className="w-full bg-emerald-50 dark:bg-[#102019] hover:bg-emerald-100 dark:hover:bg-[#142B21] border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-xl py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition mb-4 shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Analysis
            </button>

            {/* Scrollable User Threads Container */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-1">
              <UserThreads
                setChatMessages={setChatMessages}
                setActiveEndpoint={setActiveEndpoint}
                setHasStarted={setHasStarted}
                threadId={threadId}
                setThreadId={setThreadId}
                setFinalReport={setFinalReport}
                setIsReportExpanded={setIsReportExpanded}
                setNodes={setNodes}
                setHitlChoices={setHitlChoices}
                setIsGraphExpanded={setIsGraphExpanded}
              />
            </div>
          </div>

          {/* User Profile Area (Fixed at bottom) */}
          <div className="relative border-t border-slate-200 dark:border-slate-800/60 pt-3 mt-3 shrink-0">
            {showProfileMenu && (
              <div className="absolute bottom-16 left-0 right-0 bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-2xl space-y-1 z-20 backdrop-blur-md">
                <Link
                  href="/profile"
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition text-left"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="font-medium">Profile</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">
                      Account settings
                    </div>
                  </div>
                </Link>

                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex w-full items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Theme</span>

                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 ml-auto">
                    {!mounted ? (
                      <div className="w-12 h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                    ) : theme === "dark" ? (
                      <>
                        <Moon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Dark</span>
                      </>
                    ) : (
                      <>
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Light</span>
                      </>
                    )}
                  </div>
                </button>

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition text-left mt-1 border-t border-slate-200 dark:border-slate-800/50"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-semibold">Sign out</span>
                </button>
              </div>
            )}

            <div
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/40 cursor-pointer transition"
            >
              <div className="flex items-center gap-2.5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-8 h-8 rounded-full object-cover border border-slate-300 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center">
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                    {displayName}
                  </p>
                  <p className="text-[10px] text-slate-500">{user?.email}</p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
          </div>
        </aside>
      )}

      {/* MAIN WORKSPACE AREA */}
      <main className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#07090E] relative overflow-hidden transition-colors duration-200">
        {/* Top Header */}
        <header className="h-14 border-b border-slate-200 dark:border-slate-800/40 flex items-center justify-between px-6 bg-white dark:bg-[#07090E] transition-colors duration-200 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Menu
              className="w-5 h-5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 cursor-pointer"
              onClick={() => setShowSideBar(true)}
            />
            <div className="flex items-center gap-2">
              <div className="p-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                FinAgent
              </span>
              <span className="text-slate-300 dark:text-slate-600 text-sm">
                |
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Market Analysis • AI
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            LIVE
          </div>
        </header>

        {/* Scrollable Main Content Area */}
        <div className="flex-1 overflow-y-auto w-full p-6 pb-40">
          <div className="max-w-3xl mx-auto space-y-6">
            {!hasStarted ? (
              <div className="flex flex-col items-center text-center py-12">
                <div className="p-4 bg-white dark:bg-[#0E1523] border border-slate-200 dark:border-slate-800/80 rounded-2xl text-emerald-600 dark:text-emerald-400 mb-6 shadow-xl dark:shadow-2xl">
                  <TrendingUp className="w-10 h-10" />
                </div>

                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3 tracking-tight">
                  Finance Agent
                </h1>

                <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 max-w-lg leading-relaxed">
                  Ask me to analyze any stock, build a portfolio thesis, assess
                  risk, or explain market dynamics — powered by 5 specialized AI
                  agents working in concert.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-xl">
                  {[
                    "Analyze NVDA earnings outlook",
                    "Compare AAPL vs MSFT risk",
                    "What's the macro outlook for SPY?",
                    "Build a thesis for TSLA",
                  ].map((text, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePromptClick(text)}
                      className="bg-white dark:bg-[#0E131F] hover:bg-slate-100 dark:hover:bg-[#131A2B] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-full px-4 py-2 text-xs transition duration-200 shadow-sm"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. AGENT GRAPH */}
                {nodes.length === 0 && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm rounded-xl">
                    <LoadingSpinner
                      isLoading={nodes.length === 0}
                      message="Fetching Conversation..."
                    />
                  </div>
                )}
                {nodes.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-800/80 rounded-xl bg-white dark:bg-[#0E1523]/60 overflow-hidden transition-all duration-300 shadow-sm">
                    <button
                      onClick={() => setIsGraphExpanded(!isGraphExpanded)}
                      className="w-full flex items-center justify-between p-3.5 bg-slate-100/80 dark:bg-slate-900/80 hover:bg-slate-200/80 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Agent Execution Workflow</span>
                        {!isAnalyzing && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-mono">
                            COMPLETE
                          </span>
                        )}
                      </div>
                      {isGraphExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {isGraphExpanded && (
                      <div className="p-4">
                        <AgentGraph
                          nodes={nodes}
                          streamText={streamText}
                          isAnalyzing={isAnalyzing}
                          choices={hitlChoices}
                          onSelectChoice={handleResumeChoice}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. FINAL REPORT CARD */}
                {finalReport && (
                  <div className="border border-emerald-500/30 rounded-xl bg-white dark:bg-[#09111E] overflow-hidden shadow-lg shadow-emerald-500/5 transition-all duration-300">
                    <button
                      onClick={() => setIsReportExpanded(!isReportExpanded)}
                      className="w-full flex items-center justify-between p-4 bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-xs font-semibold text-emerald-900 dark:text-emerald-300 border-b border-emerald-500/20 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-bold tracking-wide">
                          Final Analysis Report
                        </span>
                      </div>
                      {isReportExpanded ? (
                        <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </button>

                    {isReportExpanded && (
                      <div className="p-4 bg-white dark:bg-[#09111E]">
                        <FinalReportCard data={finalReport} />
                      </div>
                    )}
                  </div>
                )}

                {chatMessages.map((msg) => {
                  const isUser = msg.role === "chat_user";

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm transition-colors ${
                          isUser
                            ? "bg-emerald-600 text-white dark:bg-slate-900 dark:text-slate-100 dark:border dark:border-emerald-500/30 rounded-br-none"
                            : "bg-slate-100 text-slate-900 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-100 dark:border-slate-700/60 rounded-bl-none"
                        }`}
                      >
                        {/* Label Header */}
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                          {isUser ? "You" : "Agent"}
                        </div>

                        {/* Message Body */}
                        {isUser ? (
                          /* User Message: Plain text layout */
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>
                        ) : (
                          /* Agent Message: Styled Markdown layout */
                          <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed prose-p:my-1 prose-headings:my-2 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>

                            {/* Typewriter Cursor Indicator while streaming */}
                            {isAnalyzing &&
                              msg.id ===
                                chatMessages[chatMessages.length - 1]?.id && (
                                <span className="inline-block w-2 h-4 ml-1 bg-emerald-400 animate-pulse align-middle" />
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 3. CENTERED FIXED BOTTOM INPUT BAR */}
        <div className="fixed bottom-0 left-40 right-0 w-full bg-linear-to-t from-slate-50 via-slate-50/90 dark:from-[#07090E] dark:via-[#07090E]/90 to-transparent pt-4 pb-4 px-6 z-20 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-full max-w-3xl relative pointer-events-auto">
            {/* Animated Chat Prompt Popup */}
            {showChatFloater && (
              <div
                onClick={() => setShowChatFloater(false)}
                className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-emerald-500 text-slate-950 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-emerald-500/20 animate-bounce cursor-pointer z-30 whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Have questions about this report? Chat below!</span>
                <ArrowDown className="w-3.5 h-3.5" />
              </div>
            )}

            <div className="relative flex items-center bg-white dark:bg-[#0E1523] border border-slate-200 dark:border-slate-800/80 rounded-xl p-1 shadow-xl w-full">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onFocus={() => setShowChatFloater(false)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSubmit()
                }
                placeholder={
                  isAnalyzing
                    ? "Agents are analyzing stock data..."
                    : activeEndpoint === "chat"
                      ? "Ask follow-up questions about this analysis..."
                      : "Build a thesis for TSLA..."
                }
                disabled={isAnalyzing}
                className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none disabled:opacity-50"
              />

              <button
                onClick={() => handleSubmit()}
                disabled={isAnalyzing || !prompt.trim()}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shrink-0"
              >
                <Send className="w-4 h-4" />
                <span className="text-xs font-semibold px-1">
                  {activeEndpoint === "chat" ? "Chat" : "Send"}
                </span>
              </button>
            </div>

            <div className="flex justify-between items-center px-2 mt-1 text-[10px] text-slate-500 w-full">
              <span>Press Enter to send · Shift+Enter for new line</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
