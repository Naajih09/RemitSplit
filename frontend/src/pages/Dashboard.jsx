import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";

function WovenDivider({ className = "" }) {
  return (
    <div className={`inline-flex items-center ${className}`}>
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/80 -mr-2.5" />
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/50 -mr-2.5" />
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/30" />
    </div>
  );
}

function formatCurrency(value) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return "₦0.00";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(amount);
}

const statusStyles = {
  active: "bg-white/10 text-white",
  completed: "bg-white/10 text-white",
};

function Dashboard({ theme, toggleTheme }) {
  const isLight = theme === "light";
  const navigate = useNavigate();
  const [walletName, setWalletName] = useState("");
  const [walletType, setWalletType] = useState("wallet");
  const [targetAmount, setTargetAmount] = useState("");
  const [wallet, setWallet] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [contributorUserId, setContributorUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [contributorsLoading, setContributorsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    navigate("/", { replace: true });
  };

  const handleCreateOrOpenWallet = async (event) => {
    event.preventDefault();
    setError("");
    setActionMessage("");
    setLoading(true);

    try {
      if (!walletName.trim()) {
        throw new Error("Wallet name is required");
      }

      if (walletType === "split" && (!targetAmount || Number(targetAmount) <= 0)) {
        throw new Error("Target amount is required for split wallets");
      }

      const body = {
        name: walletName.trim(),
        type: walletType,
        target_amount: walletType === "split" ? Number(targetAmount) : null,
        beneficiary_bank_details: null,
      };

      const data = await apiRequest("/wallets", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setWallet(data.wallet);
      setContributors([]);
      setContributorUserId("");
      setActionMessage("Wallet loaded successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshBalance = async () => {
    if (!wallet?.id) return;
    setError("");
    setActionMessage("");
    setBalanceLoading(true);

    try {
      const data = await apiRequest(`/wallets/${wallet.id}/balance`);
      setWallet((current) => ({
        ...current,
        ...data.wallet,
      }));
      setActionMessage("Balance refreshed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleLoadContributors = async () => {
    if (!wallet?.id) return;
    setError("");
    setActionMessage("");
    setContributorsLoading(true);

    try {
      const data = await apiRequest(`/wallets/${wallet.id}/contributors`);
      setContributors(data.contributors || []);
      setActionMessage("Contributors loaded.");
    } catch (err) {
      setError(err.message);
    } finally {
      setContributorsLoading(false);
    }
  };

  const handleAddContributor = async (event) => {
    event.preventDefault();
    if (!wallet?.id) return;

    setError("");
    setActionMessage("");
    setLoading(true);

    try {
      if (!contributorUserId.trim()) {
        throw new Error("Contributor user ID is required");
      }

      await apiRequest(`/wallets/${wallet.id}/contributors`, {
        method: "POST",
        body: JSON.stringify({ contributorUserId: contributorUserId.trim() }),
      });

      setContributorUserId("");
      setActionMessage("Contributor added successfully.");
      handleLoadContributors();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isLight ? "bg-[#FEF7D2] text-[#111827]" : "bg-[#080808] text-white"}`}>
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8">
        <header className={`mb-4 sm:mb-6 flex flex-col gap-2 rounded-[16px] sm:rounded-[28px] border p-3 sm:p-5 sm:flex-row sm:items-center sm:justify-between ${isLight ? "border-[#D4A574] bg-[#FFF7D0] shadow-[0_20px_50px_rgba(255,214,0,0.12)]" : "border-[#232323] bg-[#0D0D0D] shadow-[0_30px_80px_rgba(0,0,0,0.45)]"}`}>
          <div>
            <p className={`text-sm uppercase tracking-[0.24em] ${isLight ? "text-[#8C7135]" : "text-[#B8B8B8]"}`}>RemitSplit</p>
            <h1 className={`mt-1 text-3xl sm:text-4xl font-display font-semibold ${isLight ? "text-[#111827]" : "text-white"}`}>Your Contribution Wallet</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
              className={`rounded-full border p-2 sm:p-3 text-lg transition ${isLight ? "border-[#D4A574] bg-[#FFF3A7] text-[#111827] hover:bg-[#FFE77E]" : "border-[#FFD600] bg-[#111111] text-[#FFD600] hover:bg-[#1E1E1E]"}`}
            >
              {isLight ? "🌙" : "☀"}
            </button>
            <button
              onClick={handleLogout}
              className={`rounded-3xl border px-4 py-2 sm:px-5 sm:py-3 text-sm font-semibold transition ${isLight ? "border-[#D4A574] bg-[#FFF3A7] text-[#111827] hover:bg-[#FFE77E]" : "border-[#333333] bg-transparent text-[#F5F5F5] hover:bg-[#111111] hover:text-[#FFD600]"}`}
            >
              Log Out
            </button>
          </div>
        </header>

        <main className="space-y-6">
          <section className={`rounded-[32px] border p-4 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] ${isLight ? "border-[#D4A574] bg-[#FFF7D0]" : "border-[#222222] bg-[#111111]"}`}>
            <div className="flex flex-col gap-4 pb-4 sm:pb-6">
              <div>
                <p className={`text-sm uppercase tracking-[0.3em] ${isLight ? "text-[#8C7135]" : "text-[#A0A8A0]"}`}>Wallet Control</p>
                <h2 className={`mt-2 text-2xl font-display font-semibold ${isLight ? "text-[#111827]" : "text-white"}`}>Create or find a wallet</h2>
                <p className={`mt-2 text-sm leading-6 ${isLight ? "text-[#7A5F0D]" : "text-[#C0C0C0]"}`}>
                  Enter a wallet name to reuse an existing wallet or open a new contribution wallet instantly.
                </p>
              </div>
            </div>

            {error && (
              <div className={`mb-4 rounded-3xl border px-4 py-3 text-sm ${isLight ? "border-[#D4A574] bg-[#FFF4B8] text-[#111827]" : "border-[#3D1212] bg-[#300B0B] text-[#FFB3B3]"}`}>
                {error}
              </div>
            )}

            {actionMessage && (
              <div className={`mb-4 rounded-3xl border px-4 py-3 text-sm ${isLight ? "border-[#D4A574] bg-[#FFF4B8] text-[#111827]" : "border-white/10 bg-white/5 text-white"}`}>
                {actionMessage}
              </div>
            )}

            <form onSubmit={handleCreateOrOpenWallet} className="grid gap-4">
              <div>
                    <label className={`block text-sm font-medium mb-1 ${isLight ? "text-[#7A5F0D]" : "text-[#D9D9D9]"}`}>Wallet Name</label>
                    <input
                      type="text"
                      value={walletName}
                      onChange={(event) => setWalletName(event.target.value)}
                      className={`w-full rounded-3xl border px-4 py-3 ${isLight ? "border-[#D4A574] bg-[#FFF8D2] text-[#111827] placeholder:text-[#B38A2D] focus:ring-2 focus:ring-[#FFD600]/80 focus:border-[#FFD600]" : "border-[#333333] bg-[#121212] text-white placeholder:text-[#6F6F6F] focus:ring-2 focus:ring-white/70 focus:border-white"}`}
                      placeholder="e.g. Family Wallet"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isLight ? "text-[#7A5F0D]" : "text-[#D9D9D9]"}`}>Type</label>
                    <select
                      value={walletType}
                      onChange={(event) => setWalletType(event.target.value)}
                      className={`w-full rounded-3xl border px-4 py-3 ${isLight ? "border-[#D4A574] bg-[#FFF8D2] text-[#111827] focus:ring-2 focus:ring-[#FFD600]/80 focus:border-[#FFD600]" : "border-[#333333] bg-[#121212] text-white focus:ring-2 focus:ring-white/70 focus:border-white"}`}
                    >
                      <option value="wallet">Wallet</option>
                      <option value="split">Split</option>
                    </select>
                  </div>

              {walletType === "split" && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isLight ? "text-[#7A5F0D]" : "text-[#D9D9D9]"}`}>Target Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={targetAmount}
                    onChange={(event) => setTargetAmount(event.target.value)}
                    className={`w-full rounded-3xl border px-4 py-3 ${isLight ? "border-[#D4A574] bg-[#FFF8D2] text-[#111827] placeholder:text-[#B38A2D] focus:ring-2 focus:ring-[#FFD600]/80 focus:border-[#FFD600]" : "border-[#333333] bg-[#121212] text-white placeholder:text-[#6F6F6F] focus:ring-2 focus:ring-white/70 focus:border-white"}`}
                    placeholder="e.g. 50000"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full rounded-3xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${isLight ? "bg-[#111827] text-white hover:bg-[#0f172a]" : "bg-[#FFD600] text-[#101010] hover:bg-[#E6C900]"}`}
              >
                {loading ? "Please wait..." : "Create / Open Wallet"}
              </button>
            </form>
          </section>

          {wallet && (
            <>
              <section className={`rounded-[32px] border p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] ${isLight ? "border-slate-200 bg-white" : "border-[#222222] bg-[#0D0D0D]"}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div>
                    <h2 className={`text-xl font-display ${isLight ? "text-slate-900" : "text-white"}`}>Wallet Details</h2>
                    <p className={`text-sm mt-1 ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`}>Review the selected wallet and refresh its balance.</p>
                  </div>
                  <button
                    onClick={handleRefreshBalance}
                    disabled={balanceLoading}
                    className={`rounded-3xl px-4 py-2 font-medium transition disabled:opacity-60 ${isLight ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-white text-[#101010] hover:bg-[#F0F0F0]"}`}
                  >
                    {balanceLoading ? "Refreshing..." : "Refresh Balance"}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={`rounded-3xl border p-4 sm:p-5 ${isLight ? "border-slate-200 bg-slate-50" : "border-[#222222] bg-[#111111]"}`}>
                    <p className={`text-sm font-medium ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`}>Wallet Name</p>
                    <p className={`mt-2 text-lg font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>{wallet.name}</p>
                  </div>

                  <div className={`rounded-3xl border p-4 sm:p-5 ${isLight ? "border-slate-200 bg-slate-50" : "border-[#222222] bg-[#121212]"}`}>
                    <p className={`text-sm font-medium ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`}>Current Balance</p>
                    <p className={`mt-2 text-lg font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
                      {formatCurrency(wallet.current_balance)}
                    </p>
                  </div>

                  {(walletType === "split" || wallet.target_amount != null) && (
                    <div className={`rounded-3xl border p-4 sm:p-5 ${isLight ? "border-slate-200 bg-slate-50" : "border-[#222222] bg-[#121212]"}`}>
                      <p className={`text-sm font-medium ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`}>Target Amount</p>
                      <p className={`mt-2 text-lg font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
                        {formatCurrency(wallet.target_amount)}
                      </p>
                    </div>
                  )}

                  <div className={`rounded-3xl border p-4 sm:p-5 ${isLight ? "border-slate-200 bg-slate-50" : "border-[#222222] bg-[#111111]"}`}>
                    <p className={`text-sm font-medium ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`}>Status</p>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${isLight ? "bg-slate-100 text-slate-900" : statusStyles[wallet.status] ?? "bg-[#2A2A2A] text-[#E0E0E0]"}`}
                    >
                      {wallet.status ?? "unknown"}
                    </span>
                  </div>
                </div>
              </section>

              <section className={`rounded-[32px] border p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] ${isLight ? "border-slate-200 bg-white" : "border-[#222222] bg-[#0D0D0D]"}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <WovenDivider className="text-[#FFD600]" />
                    <div>
                      <h2 className={`text-xl font-display ${isLight ? "text-slate-900" : "text-white"}`}>Contributors</h2>
                      <p className={`text-sm mt-1 ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`}>Manage who can contribute to this wallet.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLoadContributors}
                    disabled={contributorsLoading}
                    className={`rounded-3xl px-4 py-2 font-medium transition disabled:opacity-60 ${isLight ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-white text-[#101010] hover:bg-[#F0F0F0]"}`}
                  >
                    {contributorsLoading ? "Loading..." : "Load Contributors"}
                  </button>
                </div>

                {actionMessage && (
                  <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${isLight ? "bg-slate-100 text-slate-900" : "bg-[#0B3D2E]/8 text-[#0B3D2E]"}`}>
                    {actionMessage}
                  </div>
                )}
                {error && (
                  <div className={`mb-4 rounded-3xl border px-4 py-3 text-sm ${isLight ? "border-slate-200 bg-slate-100 text-slate-900" : "border-[#3D1212] bg-[#120B0B] text-[#FFB3B3]"}`}>
                    {error}
                  </div>
                )}

                {contributors.length > 0 ? (
                  <div className="space-y-3">
                    {contributors.map((contributor) => (
                      <div
                        key={contributor.id ?? `${contributor.user_id}-${contributor.created_at}`}
                        className={`rounded-3xl border p-4 ${isLight ? "border-slate-200 bg-slate-50" : "border-[#222222] bg-[#121212]"}`}
                      >
                        <p className={`text-sm font-medium ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`}>User ID</p>
                        <p className={`mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>{contributor.user_id}</p>
                        <p className={`text-sm mt-2 ${isLight ? "text-slate-600" : "text-[#A0A0A0]"}`}>
                          Added on {new Date(contributor.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-sm ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`}>No contributors loaded yet.</p>
                )}

                <form onSubmit={handleAddContributor} className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isLight ? "text-slate-700" : "text-[#D9D9D9]"}`}>
                      Contributor User ID
                    </label>
                    <input
                      type="text"
                      value={contributorUserId}
                      onChange={(event) => setContributorUserId(event.target.value)}
                      className={`w-full rounded-3xl border px-4 py-3 ${isLight ? "border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-slate-400" : "border-[#222222] bg-[#101010] text-white placeholder:text-[#6F6F6F] focus:ring-2 focus:ring-[#FFD600]/70 focus:border-[#FFD600]"}`}
                      placeholder="Enter user ID"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`rounded-xl px-4 py-3 font-medium transition disabled:opacity-60 ${isLight ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-[#111111] text-[#FFD600] hover:bg-[#000000]"}`}
                  >
                    {loading ? "Adding..." : "Add Contributor"}
                  </button>
                </form>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
