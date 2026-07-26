// src/app/analyse/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/src/lib/supabase";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Plus,
  Search,
  Clock,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Send,
  HelpCircle,
  Menu,
  X,
} from "lucide-react";

const demoRecentAnalyses = [
  {
    id: "1",
    title: "NVDA earnings outlook",
    time: "1h ago",
    snippet: "Bullish momentum heading into Q2...",
    ticker: "NVDA",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  {
    id: "2",
    title: "AAPL vs MSFT comparison",
    time: "1d ago",
    snippet: "Both showing resilience but...",
    ticker: "AAPL",
    color: "bg-slate-800 text-slate-400 border-slate-700",
  },
  {
    id: "3",
    title: "SPY macro analysis",
    time: "2d ago",
    snippet: "Macro headwinds persist, watch...",
    ticker: "SPY",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
];

interface RecentAnalysis {
  id: string;
  title: string;
  time: string;
  snippet: string;
  ticker: string;
  color: string;
}

export default function AnalyseDashboard() {
  const [user, setUser] = useState<any>(null);
  const [prompt, setPrompt] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(true); // Open like in the image
  const [showSideBar, setShowSideBar] = useState(true);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [recentAnalyses, setRecentAnalyses] =
    useState<RecentAnalysis[]>(demoRecentAnalyses);
  const [filteredAnalyses, setFilteredAnalyses] =
    useState<RecentAnalysis[]>(demoRecentAnalyses);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
      else setUser(user);
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleSearch = (query: string) => {
    if (!query) {
      setFilteredAnalyses(recentAnalyses);
    }
    const searchArray: RecentAnalysis[] = (recentAnalyses || []).filter(
      (item) => {
        const q = query.toLowerCase();
        return (
          item?.title?.toLowerCase().includes(q) ||
          item?.snippet?.toLowerCase().includes(q) ||
          item?.ticker?.toLowerCase().includes(q)
        );
      },
    );
    setFilteredAnalyses(searchArray);
  };

  const handleStartNewAnalysis = () => {
    alert("Stock sent for analysis");
  };

  const handlePromptClick = (text: string) => {
    setPrompt(text);
  };

  return (
    <div className="flex h-screen bg-[#07090E] text-slate-100 font-sans antialiased overflow-hidden">
      {/* LEFT SIDEBAR */}
      {showSideBar && (
        <aside className="w-75 bg-[#0A0E17] border-r border-slate-800/60 flex flex-col justify-between p-4 relative shrink-0">
          <div>
            {/* Logo Bar */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="font-bold text-lg text-white tracking-tight">
                  FinAgent
                </span>
              </div>
              <button
                className="text-slate-500 hover:text-slate-300"
                onClick={() => setShowSideBar(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Analysis Button */}
            <button className="w-full bg-[#102019] hover:bg-[#142B21] border border-emerald-500/30 text-emerald-400 rounded-xl py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition mb-4 shadow-sm">
              <Plus className="w-4 h-4" />
              New Analysis
            </button>

            {/* Search Box */}
            <div className="relative mb-6">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                onChange={(e) => handleSearch(e.target.value)}
                type="text"
                placeholder="Search conversations..."
                className="w-full bg-[#111723] border border-slate-800/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Recent Conversations */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase px-1 mb-2">
                Recent
              </div>

              {filteredAnalyses.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setActiveThread(item.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition relative ${
                    activeThread === item.id
                      ? "bg-[#121A29] border-slate-700"
                      : "bg-[#0E131F]/60 border-slate-800/40 hover:bg-[#121826]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-xs font-semibold text-slate-200 truncate">
                      {item.title}
                    </h4>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${item.color}`}
                    >
                      {item.ticker}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                    <Clock className="w-3 h-3" />
                    <span>{item.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {item.snippet}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* User Profile Area with Popup Menu */}
          <div className="relative border-t border-slate-800/60 pt-3">
            {/* Profile Menu Overlay (Matches Image) */}
            {showProfileMenu && (
              <div className="absolute bottom-16 left-0 right-0 bg-[#0E131F] border border-slate-800 rounded-2xl p-2 shadow-2xl space-y-1 z-20 backdrop-blur-md">
                <button className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800/50 rounded-xl transition text-left">
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="font-medium">Profile</div>
                    <div className="text-[10px] text-slate-500">
                      Account settings
                    </div>
                  </div>
                </button>

                <button className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800/50 rounded-xl transition text-left">
                  <Settings className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="font-medium">Preferences</div>
                    <div className="text-[10px] text-slate-500">
                      Customize your workspace
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-xl transition text-left mt-1 border-t border-slate-800/50"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-semibold">Sign out</span>
                </button>
              </div>
            )}

            {/* User Button */}
            <div
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/40 cursor-pointer transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center">
                  {user?.user_metadata?.full_name?.[0]?.toUpperCase() || "G"}
                  {/* change with user profile photo or empty photo */}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200 leading-tight">
                    {user?.user_metadata?.full_name || "Guest User"}
                  </p>
                  <p className="text-[10px] text-slate-500">Pro Plan</p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </div>
          </div>
        </aside>
      )}

      {/* MAIN WORKSPACE AREA */}
      <main className="flex-1 flex flex-col h-full bg-[#07090E] relative overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-800/40 flex items-center justify-between px-6 bg-[#07090E]">
          <div className="flex items-center gap-3">
            <Menu
              className="w-5 h-5 text-slate-400"
              onClick={() => setShowSideBar(true)}
            />
            <div className="flex items-center gap-2">
              <div className="p-1 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-white">FinAgent</span>
              <span className="text-slate-600 text-sm">|</span>
              <span className="text-xs text-slate-400 font-mono">
                Market Analysis • AI
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </div>
        </header>

        {/* Central Workspace Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto">
          {/* Main Logo Card */}
          <div className="p-4 bg-[#0E1523] border border-slate-800/80 rounded-2xl text-emerald-400 mb-6 shadow-2xl">
            <TrendingUp className="w-10 h-10" />
          </div>

          <h1 className="text-2xl font-bold text-slate-100 mb-3 tracking-tight">
            Finance Agent
          </h1>

          <p className="text-xs text-slate-400 mb-8 max-w-lg leading-relaxed">
            Ask me to analyze any stock, build a portfolio thesis, assess risk,
            or explain market dynamics — powered by 5 specialized AI agents
            working in concert.
          </p>

          {/* Quick Prompt Pill Buttons */}
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
                className="bg-[#0E131F] hover:bg-[#131A2B] border border-slate-800 text-slate-300 rounded-full px-4 py-2 text-xs transition duration-200"
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Input Area */}
        <div className="p-6 bg-[#07090E] relative">
          <div className="max-w-3xl mx-auto">
            <div className="relative bg-[#0E131F] border border-slate-800 rounded-2xl p-2.5 focus-within:border-emerald-500/60 transition shadow-2xl">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  // Check if user pressed 'Enter' without holding 'Shift'
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault(); // Prevent adding a new line
                    handleStartNewAnalysis(); // Trigger your submit/analysis function
                  }
                }}
                placeholder="Build a thesis for TSLA"
                rows={1}
                className="w-full bg-transparent px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none overflow-y-auto"
              />
              <button
                onClick={handleStartNewAnalysis}
                className={`absolute right-2.5 top-2.5 p-2 rounded-xl transition ${
                  prompt.trim()
                    ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    : "bg-emerald-500/20 text-emerald-400/50"
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 px-1 font-mono">
              <span>
                Press Enter to send · Shift+Enter for new line · Not financial
                advice
              </span>
              <button className="text-slate-500 hover:text-slate-300">
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
