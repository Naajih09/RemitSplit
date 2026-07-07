import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup, login } from "../lib/api";

function LoadingSpinner() {
  return (
    <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
  );
}

function Auth() {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password, fullName);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-2xl border border-[#222222] bg-[#1A1A1A] px-4 py-3.5 text-white outline-none transition placeholder:text-[#444444] focus:border-[#FFD600] focus:ring-0";
  const labelClass =
    "mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-[#A0A0A0]";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white lg:grid lg:grid-cols-[40%_60%]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#FFD600] px-10 py-12 text-[#0A0A0A] lg:flex lg:flex-col lg:justify-between xl:px-14">
        <div className="absolute right-[-120px] top-[-120px] h-80 w-80 rounded-full border-[36px] border-[#0A0A0A]/10" />
        <div className="absolute bottom-28 left-[-80px] h-56 w-56 rotate-45 rounded-[48px] border-[28px] border-[#0A0A0A]/10" />

        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-[#0A0A0A]/70">
            RemitSplit
          </p>
          <h1 className="mt-10 max-w-md font-display text-6xl font-semibold leading-[0.95] tracking-tight xl:text-7xl">
            Send money home. Split it instantly.
          </h1>
          <p className="mt-6 max-w-sm text-lg font-medium leading-8 text-[#0A0A0A]/70">
            Powered by Nomba's payment infrastructure
          </p>
        </div>

        <div className="relative space-y-4">
          {[
            "🌍 Diaspora remittance with locked FX rates",
            "💰 Group splits with auto-payout",
            "⚡ Instant settlement",
          ].map((feature) => (
            <div
              key={feature}
              className="rounded-full border border-[#0A0A0A]/15 bg-[#0A0A0A]/10 px-5 py-3 text-sm font-bold backdrop-blur"
            >
              {feature}
            </div>
          ))}

          <div className="pt-8">
            <div className="inline-flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em] text-[#0A0A0A]/70">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-[#0A0A0A]/25 font-display text-base">
                X
              </span>
              Built on Nomba
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <div className="font-display text-4xl font-semibold tracking-tight text-white">
              RemitSplit<span className="text-[#FFD600]">.</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#A0A0A0] lg:hidden">
              Send money home, split collections, and settle instantly on Nomba rails.
            </p>
          </div>

          <div className="mb-8 flex border-b border-[#222222]">
            {[
              ["login", "Login"],
              ["signup", "Sign Up"],
            ].map(([tabMode, label]) => (
              <button
                key={tabMode}
                type="button"
                onClick={() => setMode(tabMode)}
                className={`relative px-1 pb-4 pr-8 text-sm font-bold transition ${
                  mode === tabMode ? "text-white" : "text-[#555555] hover:text-[#A0A0A0]"
                }`}
              >
                {label}
                {mode === tabMode && (
                  <span className="absolute bottom-[-1px] left-0 h-0.5 w-12 rounded-full bg-[#FFD600]" />
                )}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  placeholder="John Doe"
                />
              </div>
            )}

            <div>
              <label className={labelClass}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>

            {mode === "signup" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className={inputClass}
                    placeholder="+234 800 000 0000"
                  />
                </div>
                <div>
                  <label className={labelClass}>Country</label>
                  <input
                    type="text"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={inputClass}
                    placeholder="Nigeria"
                  />
                </div>
              </div>
            )}

            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            {mode === "signup" && (
              <div>
                <label className={labelClass}>Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
            )}

            {mode === "signup" && (
              <label className="flex items-start gap-3 rounded-2xl border border-[#222222] bg-[#111111] px-4 py-3 text-sm leading-6 text-[#A0A0A0]">
                <input
                  type="checkbox"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="mt-1 accent-[#FFD600]"
                />
                <span>I agree to the Terms of Service</span>
              </label>
            )}

            {error && (
              <p className="rounded-xl border border-[#FF4444]/30 bg-[#FF4444]/10 px-4 py-3 text-sm text-[#FF4444]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#FFD600] px-5 py-4 text-sm font-black text-[#0A0A0A] transition hover:bg-[#E6C900] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading && <LoadingSpinner />}
              {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
            </button>
          </form>

          <div className="mt-8 border-t border-[#222222] pt-5 text-center text-xs leading-5 text-[#555555]">
            By continuing, you agree to RemitSplit's terms
          </div>
        </div>
      </main>
    </div>
  );
}

export default Auth;
