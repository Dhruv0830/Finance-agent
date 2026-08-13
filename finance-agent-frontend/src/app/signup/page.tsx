// src/app/signup/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/src/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  ArrowRight,
  Lock,
  Mail,
  User,
  Sun,
  Moon,
} from "lucide-react";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Default to false initially
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Sync theme with localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    localStorage.setItem("theme", nextTheme ? "dark" : "light");
  };

  const supabase = createClient();
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      router.replace("/analyse");
      router.refresh();
    }
  };

  const handleOAuthSignIn = async (provider: "github" | "google") => {
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/analyse`,
        queryParams: {
          prompt: provider === "google" ? "select_account" : "consent",
        },
        scopes:
          provider === "github"
            ? "read:user user:email"
            : "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
      },
    });

    if (error) {
      setErrorMsg(error.message);
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 flex items-center justify-center p-4 relative ${
        isDarkMode
          ? "bg-[#07090E] text-slate-100"
          : "bg-slate-50 text-slate-800"
      }`}
    >
      {/* Theme Toggle Button */}
      <button
        type="button"
        onClick={toggleTheme}
        className={`absolute top-6 right-6 p-2.5 rounded-xl border transition-all duration-200 flex items-center gap-2 text-xs font-medium ${
          isDarkMode
            ? "bg-[#0D111A] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
            : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm"
        }`}
        aria-label="Toggle Theme"
      >
        {isDarkMode ? (
          <>
            <Sun className="w-4 h-4 text-amber-400" />
            <span>Light Mode</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-emerald-600" />
            <span>Dark Mode</span>
          </>
        )}
      </button>

      {/* Main Card */}
      <div
        className={`w-full max-w-md rounded-2xl p-8 shadow-2xl relative overflow-hidden transition-colors duration-300 border ${
          isDarkMode
            ? "bg-[#0D111A] border-slate-800/80 shadow-emerald-950/20"
            : "bg-white border-slate-200/80 shadow-slate-200/50"
        }`}
      >
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
          <span
            className={`text-2xl font-bold tracking-tight ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            FinAgent
          </span>
        </div>

        <h2
          className={`text-xl font-semibold text-center mb-1 ${
            isDarkMode ? "text-slate-100" : "text-slate-900"
          }`}
        >
          Create an account
        </h2>
        <p
          className={`text-xs text-center mb-6 ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Get started with multi-agent stock market research
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label
              className={`block text-xs font-medium mb-1.5 ${
                isDarkMode ? "text-slate-400" : "text-slate-600"
              }`}
            >
              Full Name
            </label>
            <div className="relative">
              <User
                className={`w-4 h-4 absolute left-3.5 top-3 ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className={`w-full rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-emerald-500/80 transition border ${
                  isDarkMode
                    ? "bg-[#121824] border-slate-800 text-slate-200 placeholder-slate-500"
                    : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white"
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-xs font-medium mb-1.5 ${
                isDarkMode ? "text-slate-400" : "text-slate-600"
              }`}
            >
              Email
            </label>
            <div className="relative">
              <Mail
                className={`w-4 h-4 absolute left-3.5 top-3 ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className={`w-full rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-emerald-500/80 transition border ${
                  isDarkMode
                    ? "bg-[#121824] border-slate-800 text-slate-200 placeholder-slate-500"
                    : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white"
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-xs font-medium mb-1.5 ${
                isDarkMode ? "text-slate-400" : "text-slate-600"
              }`}
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className={`w-4 h-4 absolute left-3.5 top-3 ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-emerald-500/80 transition border ${
                  isDarkMode
                    ? "bg-[#121824] border-slate-800 text-slate-200 placeholder-slate-500"
                    : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white"
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950/30 mt-2"
          >
            {loading ? "Creating account..." : "Create Account"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Social Auth Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div
              className={`w-full border-t ${
                isDarkMode ? "border-slate-800" : "border-slate-200"
              }`}
            ></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span
              className={`px-2 text-slate-500 ${
                isDarkMode ? "bg-[#0D111A]" : "bg-white"
              }`}
            >
              Or continue with
            </span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleOAuthSignIn("github")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition border ${
              isDarkMode
                ? "bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700/60"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
            }`}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </button>

          <button
            type="button"
            onClick={() => handleOAuthSignIn("google")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition border ${
              isDarkMode
                ? "bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700/60"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24a7.18 7.18 0 010-4.48V6.61H1.29a11.98 11.98 0 000 10.78l3.99-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"
              />
            </svg>
            Google
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-emerald-500 hover:underline font-medium"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
