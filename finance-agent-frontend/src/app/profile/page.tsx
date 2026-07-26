"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase"; // Adjust path to your client
import { User } from "@supabase/supabase-js";
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
