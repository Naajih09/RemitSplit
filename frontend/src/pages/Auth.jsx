import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup, login } from "../lib/api";

function WovenDivider({ className = "" }) {
  return (
    <div className={`mt-3 inline-flex items-center ${className}`}>
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FFD600] -mr-2.5" />
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F2C024] -mr-2.5" />
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#B38612]" />
    </div>
  );
}

function Auth({ theme, toggleTheme }) {
  const isLight = theme === "light";
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`min-h-screen px-3 py-6 sm:px-4 sm:py-10 ${isLight ? "bg-[#FEF7D2] text-[#111827]" : "bg-[#050505] text-white"}`}>
      <div className={`mx-auto w-full max-w-md overflow-hidden rounded-[20px] sm:rounded-[32px] border px-0 ${isLight ? "border-[#D4A574] bg-[#fff5c6] shadow-[0_24px_60px_rgba(255,214,0,0.12)]" : "border-[#1E1E1E] bg-[#0B0B0B] shadow-[0_28px_80px_rgba(0,0,0,0.45)]"}`}>
        <div className={`px-6 py-8 sm:px-8 sm:py-10 text-center ${isLight ? "bg-[#FFF2A5]" : "bg-[#111111]"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-left">
              <h1 className={`text-3xl sm:text-4xl font-display font-semibold tracking-tight ${isLight ? "text-[#111827]" : "text-white"}`}>RemitSplit</h1>
              <p className={`mt-3 max-w-sm text-sm leading-6 ${isLight ? "text-[#7A5F0D]" : "text-[#C1C1C1]"}`}>A sleek contribution wallet experience with a bold, clean theme.</p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
              className={`rounded-full border p-2 sm:p-3 text-lg transition ${isLight ? "border-[#D4A574] bg-[#FFF3A7] text-[#111827] hover:bg-[#FFE77E]" : "border-[#FFD600] bg-[#111111] text-[#FFD600] hover:bg-[#1E1E1E]"}`}
            >
              {isLight ? "🌙" : "☀"}
            </button>
          </div>
        </div>

        <div className={`flex rounded-b-[20px] sm:rounded-b-[32px] p-1 mb-4 sm:mb-6 border ${isLight ? "bg-[#FFF3A7] border-[#D4A574]" : "bg-[#090909] border-[#222222]"}`}>
          <button
            onClick={() => setMode("login")}
            className={`flex-1 rounded-2xl px-3 py-2 sm:px-4 sm:py-3 text-sm font-semibold transition ${
              mode === "login"
                ? isLight
                  ? "bg-[#111827] text-white"
                  : "bg-[#FFD600] text-[#101010]"
                : isLight
                ? "text-[#8C7135] hover:text-[#5F4818]"
                : "text-[#C9C9C9] hover:text-white"
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-2xl px-3 py-2 sm:px-4 sm:py-3 text-sm font-semibold transition ${
              mode === "signup"
                ? isLight
                  ? "bg-[#111827] text-white"
                  : "bg-[#FFD600] text-[#101010]"
                : isLight
                ? "text-[#8C7135] hover:text-[#5F4818]"
                : "text-[#C9C9C9] hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${isLight ? "text-slate-700" : "text-[#D9D9D9]"}`}>Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full rounded-3xl border px-3 py-2 sm:px-4 sm:py-3 ${isLight ? "border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400" : "border-[#222222] bg-[#090909] text-white placeholder:text-[#5A5A5A]"} focus:outline-none focus:ring-2 focus:ring-[#FFD600]/80 focus:border-[#FFD600]`}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isLight ? "text-slate-700" : "text-[#D9D9D9]"}`}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-3xl border px-3 py-2 sm:px-4 sm:py-3 ${isLight ? "border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400" : "border-[#222222] bg-[#090909] text-white placeholder:text-[#5A5A5A]"} focus:outline-none focus:ring-2 focus:ring-[#FFD600]/80 focus:border-[#FFD600]`}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className={`rounded-3xl border px-4 py-3 text-sm ${isLight ? "border-slate-200 bg-slate-100 text-slate-900" : "border-[#3D1616] bg-[#380F0F] text-[#FFB3B3]"}`}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-3xl px-4 py-2 sm:px-5 sm:py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${isLight ? "bg-[#111827] text-white hover:bg-[#0f172a]" : "bg-[#FFD600] text-[#101010] hover:bg-[#E6C900]"}`}
          >
            {loading ? "Please wait..." : mode === "login" ? "Log In" : "Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Auth;