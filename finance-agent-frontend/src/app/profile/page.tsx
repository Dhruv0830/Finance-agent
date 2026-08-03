"use client";
import { Search, Clock } from "lucide-react";
import React, { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase"; // Adjust path to your client
import { SupabaseClient, User } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setLoading(false);
    }

    getUser();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#07090E] flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs transition-colors duration-200">
        Loading profile...
      </div>
    );
  }

  const metadata = user?.user_metadata || {};
  const displayName =
    metadata.full_name ||
    metadata.name ||
    metadata.user_name ||
    user?.email?.split("@")[0] ||
    "User";
  const avatarUrl = metadata.avatar_url || metadata.picture;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090E] text-slate-800 dark:text-slate-100 p-6 flex justify-center font-sans antialiased transition-colors duration-200">
      <div className="w-full max-w-xl space-y-6">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/analyse"
            className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Account Profile
          </h1>
        </div>

        {/* Profile Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0E131F] p-6 space-y-6 shadow-sm dark:shadow-2xl transition-colors duration-200">
          {/* Avatar Section */}
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500/30"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-emerald-500 text-slate-950 font-bold text-lg flex items-center justify-center border-2 border-emerald-400/30">
                {initials}
              </div>
            )}
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {displayName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connected via {user?.app_metadata?.provider || "Email"}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 space-y-4">
            {/* Username Field */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Display Name
              </label>
              <input
                type="text"
                readOnly
                value={displayName}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#111723] px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Email Address
              </label>
              <input
                type="text"
                readOnly
                value={user?.email || "N/A"}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#111723] px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface Thread {
  thread_id: string;
  ticker: string;
  title: string;
  mode: "ANALYSE" | "CHAT";
  created_at: string;
  updated_at: string;
}

// Transformed object after adding the Tailwind color class string
export interface ThreadWithColor extends Thread {
  color: string;
}

export const getCookie = async (supabase: SupabaseClient): Promise<string> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token || "";
  return token;
};

export function UserThreads() {
  const [threads, setThreads] = useState<[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [filteredAnalyses, setFilteredAnalyses] = useState<ThreadWithColor[]>(
    [],
  );
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const TAILWIND_COLOR_PALETTE = [
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700",
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  ];

  useEffect(() => {
    async function getThreads() {
      try {
        setLoading(true);
        // const response = await fetch(
        //   `${process.env.NEXT_PUBLIC_API_URL}/threads`,
        //   {
        //     method: "GET",
        //     headers: {
        //       "Content-Type": "application/json",
        //     },
        //   },
        // );

        // =========================================================
        // PRODUCTION ROUTE
        // =========================================================

        const token = await getCookie(supabase); // Or retrieve from your Auth Context / Cookie
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/finance/threads`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          console.log(`Failed to fetch threads: ${response.statusText}`);
          return;
        }

        const data = await response.json();
        const thread_with_colours = data?.threads?.map(
          (thread: Thread, index: number): ThreadWithColor => ({
            ...thread,
            color:
              TAILWIND_COLOR_PALETTE[index % TAILWIND_COLOR_PALETTE.length],
          }),
        );
        setFilteredAnalyses(thread_with_colours || []);
        setThreads(thread_with_colours || []);
      } catch (err: any) {
        console.error("Error fetching threads:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    getThreads();
  }, []);

  const handleSearch = (query: string) => {
    if (!query) {
      setFilteredAnalyses(threads);
      return;
    }

    const searchArray = (threads || []).filter((item: ThreadWithColor) => {
      const q = query.toLowerCase();
      return (
        item?.title?.toLowerCase().includes(q) ||
        item?.ticker?.toLowerCase().includes(q)
      );
    });
    setFilteredAnalyses(searchArray);
  };

  function timeAgo(dateString: string) {
    if (!dateString) return "";

    const date: Date = new Date(dateString);
    const now: Date = new Date();
    const seconds: number = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";

    const intervals = [
      { label: "year", seconds: 31536000 },
      { label: "month", seconds: 2592000 },
      { label: "day", seconds: 86400 },
      { label: "hour", seconds: 3600 },
      { label: "minute", seconds: 60 },
    ];

    for (const interval of intervals) {
      const count = Math.floor(seconds / interval.seconds);
      if (count >= 1) {
        return `${count} ${interval.label}${count > 1 ? "s" : ""} ago`;
      }
    }

    return "just now";
  }

  return (
    <>
      {/* Search Box */}

      <div className="relative mb-6">
        <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 dark:text-slate-500" />
        <input
          onChange={(e) => handleSearch(e.target.value)}
          type="text"
          placeholder="Search conversations..."
          className="w-full bg-slate-100 dark:bg-[#111723] border border-slate-200 dark:border-slate-800/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      {/* Recent Conversations */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase px-1 mb-2">
          Recent
        </div>

        {filteredAnalyses.map((item: ThreadWithColor) => (
          <div
            key={item.thread_id}
            onClick={() => setActiveThread(item.thread_id)}
            className={`p-3 rounded-xl border cursor-pointer transition relative ${
              activeThread === item.thread_id
                ? "bg-slate-200 dark:bg-[#121A29] border-slate-300 dark:border-slate-700"
                : "bg-slate-50 dark:bg-[#0E131F]/60 border-slate-200 dark:border-slate-800/40 hover:bg-slate-100 dark:hover:bg-[#121826]"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {item.title}
              </h4>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${item.color}`}
              >
                {item.ticker}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 mb-1">
              <Clock className="w-3 h-3" />
              <span>{timeAgo(item.updated_at)}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {item.mode === "CHAT"
                ? `Chat with ${item.ticker} stock`
                : `Analysis pending for stock ${item.ticker}`}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
