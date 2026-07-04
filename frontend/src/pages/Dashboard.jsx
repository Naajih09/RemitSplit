import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";

function WovenDivider({ className = "" }) {
  return (
    <div className={`inline-flex items-center ${className}`}>
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FFD600] -mr-2.5" />
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FFD600]/50 -mr-2.5" />
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FFD600]/30" />
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
  completed: "bg-[#FFD600]/20 text-[#FFD600]",
};

function Dashboard({ theme, toggleTheme }) {
  const isLight = theme === "light";
  const navigate = useNavigate();

  // Wallet creation state
  const [walletName, setWalletName] = useState("");
  const [mode, setMode] = useState("remit");
  const [targetAmount, setTargetAmount] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryAccountNumber, setBeneficiaryAccountNumber] = useState("");
  const [contributorsCount, setContributorsCount] = useState("");

  // Wallet display state
  const [wallet, setWallet] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [contributorUserId, setContributorUserId] = useState("");

  // FX Quote state
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("GBP");
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Loading/feedback state
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
    setQuote(null);

    try {
      if (!walletName.trim()) throw new Error("Wallet name is required");

      if (mode === "split") {
        if (!targetAmount || Number(targetAmount) <= 0)
          throw new Error("Target amount is required for split wallets");
        if (contributorsCount && Number(contributorsCount) < 1)
          throw new Error("Contributors count must be at least 1");
      }

      if (mode === "remit") {
        if (!beneficiaryName.trim())
          throw new Error("Beneficiary name is required for remit mode");
        if (!beneficiaryAccountNumber.trim())
          throw new Error("Beneficiary account number is required for remit mode");
      }

      const body = {
        name: walletName.trim(),
        type: mode === "split" ? "split" : "wallet",
        target_amount: mode === "split" ? Number(targetAmount) : null,
        beneficiary_bank_details:
          mode === "remit"
            ? { name: beneficiaryName, account_number: beneficiaryAccountNumber }
            : null,
      };

      const data = await apiRequest("/wallets", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setWallet({
        ...data.wallet,
        virtualAccount: data.virtualAccount || null,
        plannedContributors: contributorsCount ? Number(contributorsCount) : null,
      });
      setContributors([]);
      setContributorUserId("");
      setActionMessage(data.reused ? "Existing wallet loaded." : "Wallet created successfully.");
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
      setWallet((current) => ({ ...current, ...data.wallet }));
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
      if (!contributorUserId.trim())
        throw new Error("Contributor user ID is required");
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

  const handleGetQuote = async () => {
    if (!wallet?.name || !quoteAmount) return;
    setError("");
    setQuoteLoading(true);
    setQuote(null);
    try {
      const data = await apiRequest("/contribute/quote", {
        method: "POST",
        body: JSON.stringify({
          walletName: wallet.name,
          amount: Number(quoteAmount),
          currency: quoteCurrency,
        }),
      });
      setQuote(data.quote);
    } catch (err) {
      setError(err.message);
    } finally {
      setQuoteLoading(false);
    }
  };

  const cardClass = `rounded-[32px] border p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] ${
    isLight ? "border-[#D4A574] bg-[#FFF7D0]" : "border-[#222222] bg-[#111111]"
  }`;

  const inputClass = `w-full rounded-3xl border px-4 py-3 outline-none transition ${
    isLight
      ? "border-[#D4A574] bg-[#FFF8D2] text-[#111827] placeholder:text-[#B38A2D] focus:ring-2 focus:ring-[#FFD600]/80 focus:border-[#FFD600]"
      : "border-[#333333] bg-[#121212] text-white placeholder:text-[#6F6F6F] focus:ring-2 focus:ring-white/20 focus:border-white/40"
  }`;

  const labelClass = `block text-sm font-medium mb-1 ${
    isLight ? "text-[#7A5F0D]" : "text-[#D9D9D9]"
  }`;

  const primaryBtn = `rounded-3xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
    isLight
      ? "bg-[#111827] text-white hover:bg-[#0f172a]"
      : "bg-[#FFD600] text-[#101010] hover:bg-[#E6C900]"
  }`;

  const secondaryBtn = `rounded-3xl px-4 py-2 font-medium transition disabled:opacity-60 ${
    isLight
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "bg-white text-[#101010] hover:bg-[#F0F0F0]"
  }`;

  const miniCardClass = `rounded-3xl border p-4 sm:p-5 ${
    isLight ? "border-slate-200 bg-slate-50" : "border-[#222222] bg-[#121212]"
  }`;

  const labelMuted = `text-sm font-medium ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`;
  const valueBold = `mt-2 text-lg font-semibold ${isLight ? "text-slate-900" : "text-white"}`;

  return (
    <div className={`min-h-screen ${isLight ? "bg-[#FEF7D2] text-[#111827]" : "bg-[#080808] text-white"}`}>
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8">

        {/* Header */}
        <header className={`mb-6 flex flex-col gap-2 rounded-[28px] border p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between ${
          isLight
            ? "border-[#D4A574] bg-[#FFF7D0] shadow-[0_20px_50px_rgba(255,214,0,0.12)]"
            : "border-[#232323] bg-[#0D0D0D] shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        }`}>
          <div>
            <p className={`text-sm uppercase tracking-[0.24em] ${isLight ? "text-[#8C7135]" : "text-[#B8B8B8]"}`}>RemitSplit</p>
            <h1 className={`mt-1 text-3xl sm:text-4xl font-display font-semibold ${isLight ? "text-[#111827]" : "text-white"}`}>
              Your Contribution Wallet
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
              className={`rounded-full border p-2 sm:p-3 text-lg transition ${
                isLight
                  ? "border-[#D4A574] bg-[#FFF3A7] text-[#111827] hover:bg-[#FFE77E]"
                  : "border-[#FFD600] bg-[#111111] text-[#FFD600] hover:bg-[#1E1E1E]"
              }`}
            >
              {isLight ? "🌙" : "☀️"}
            </button>
            <button
              onClick={handleLogout}
              className={`rounded-3xl border px-4 py-2 sm:px-5 sm:py-3 text-sm font-semibold transition ${
                isLight
                  ? "border-[#D4A574] bg-[#FFF3A7] text-[#111827] hover:bg-[#FFE77E]"
                  : "border-[#333333] bg-transparent text-[#F5F5F5] hover:bg-[#111111] hover:text-[#FFD600]"
              }`}
            >
              Log Out
            </button>
          </div>
        </header>

        <main className="space-y-6">

          {/* Create / Open Wallet */}
          <section className={cardClass}>
            <div className="mb-4">
              <p className={`text-sm uppercase tracking-[0.3em] ${isLight ? "text-[#8C7135]" : "text-[#A0A8A0]"}`}>Wallet Control</p>
              <h2 className={`mt-2 text-2xl font-display font-semibold ${isLight ? "text-[#111827]" : "text-white"}`}>
                Create or find a wallet
              </h2>
              <p className={`mt-2 text-sm leading-6 ${isLight ? "text-[#7A5F0D]" : "text-[#C0C0C0]"}`}>
                {mode === "remit"
                  ? "Create a shared family wallet for regular diaspora contributions, or open an existing one."
                  : "Create a one-off split collection with a target amount and contributor count."}
              </p>
            </div>

            {error && (
              <div className={`mb-4 rounded-3xl border px-4 py-3 text-sm ${
                isLight ? "border-[#D4A574] bg-[#FFF4B8] text-[#111827]" : "border-[#3D1212] bg-[#300B0B] text-[#FFB3B3]"
              }`}>{error}</div>
            )}

            {actionMessage && (
              <div className={`mb-4 rounded-3xl border px-4 py-3 text-sm ${
                isLight ? "border-[#D4A574] bg-[#FFF4B8] text-[#111827]" : "border-white/10 bg-white/5 text-white"
              }`}>{actionMessage}</div>
            )}

            <form onSubmit={handleCreateOrOpenWallet} className="grid gap-4">
              <div>
                <label className={labelClass}>Wallet Name</label>
                <input
                  type="text"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  className={inputClass}
                  placeholder={mode === "remit" ? "e.g. Mama's Support Fund" : "e.g. Eid Contribution"}
                />
              </div>

              {/* Mode toggle */}
              <div className="flex flex-wrap gap-2">
                {["remit", "split"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      mode === m
                        ? isLight ? "bg-[#111827] text-white" : "bg-[#FFD600] text-[#101010]"
                        : isLight ? "bg-[#FFF3A7] text-[#7A5F0D] hover:bg-[#FFE77E]" : "bg-[#111111] text-[#FFD600] hover:bg-[#1E1E1E]"
                    }`}
                  >
                    {m === "remit" ? "Remit Mode" : "Split Mode"}
                  </button>
                ))}
              </div>

              <div className={`rounded-3xl border p-4 ${isLight ? "border-[#D4A574] bg-[#FFF8D2]" : "border-[#333333] bg-[#0D0D0D]"}`}>
                <p className="text-sm font-semibold">
                  {mode === "remit"
                    ? "Remit Mode: Family wallet with a fixed beneficiary"
                    : "Split Mode: One-off group collection with a target amount"}
                </p>
              </div>

              {mode === "split" && (
                <>
                  <div>
                    <label className={labelClass}>Target Amount (₦)</label>
                    <input type="number" min="0" step="0.01" value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      className={inputClass} placeholder="e.g. 50000" />
                  </div>
                  <div>
                    <label className={labelClass}>Contributors Count</label>
                    <input type="number" min="1" value={contributorsCount}
                      onChange={(e) => setContributorsCount(e.target.value)}
                      className={inputClass} placeholder="e.g. 5" />
                  </div>
                </>
              )}

              {mode === "remit" && (
                <>
                  <div>
                    <label className={labelClass}>Beneficiary Name</label>
                    <input type="text" value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      className={inputClass} placeholder="e.g. Mama Aisha" />
                  </div>
                  <div>
                    <label className={labelClass}>Beneficiary Account Number</label>
                    <input type="text" value={beneficiaryAccountNumber}
                      onChange={(e) => setBeneficiaryAccountNumber(e.target.value)}
                      className={inputClass} placeholder="e.g. 1234567890" />
                  </div>
                </>
              )}

              <button type="submit" disabled={loading} className={`w-full ${primaryBtn}`}>
                {loading ? "Please wait..." : mode === "remit" ? "Create / Open Remit Wallet" : "Create / Open Split"}
              </button>
            </form>
          </section>

          {wallet && (
            <>
              {/* Wallet Summary */}
              <section className={cardClass}>
                <div className="mb-4">
                  <h2 className={`text-xl font-display ${isLight ? "text-[#111827]" : "text-white"}`}>
                    {wallet.type === "split" ? "Split Summary" : "Remit Wallet Summary"}
                  </h2>
                  <p className={`text-sm mt-1 ${isLight ? "text-[#7A5F0D]" : "text-[#A8A8A8]"}`}>
                    {wallet.type === "split"
                      ? "This split collects contributions toward a target amount and can be shared with multiple payers."
                      : "This remit wallet is a shared family contribution account with a fixed beneficiary."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={miniCardClass}>
                    <p className={labelMuted}>Mode</p>
                    <p className={valueBold}>{wallet.type === "split" ? "Split" : "Remit"}</p>
                  </div>
                  <div className={miniCardClass}>
                    <p className={labelMuted}>Virtual Account Ref</p>
                    <p className={valueBold}>{wallet.account_ref || "-"}</p>
                  </div>
                  {wallet.type === "split" && (
                    <div className={miniCardClass}>
                      <p className={labelMuted}>Target Amount</p>
                      <p className={valueBold}>{formatCurrency(wallet.target_amount)}</p>
                    </div>
                  )}
                  {wallet.type !== "split" && wallet.beneficiary_bank_details && (
                    <>
                      <div className={miniCardClass}>
                        <p className={labelMuted}>Beneficiary</p>
                        <p className={valueBold}>{wallet.beneficiary_bank_details.name}</p>
                      </div>
                      <div className={miniCardClass}>
                        <p className={labelMuted}>Account Number</p>
                        <p className={valueBold}>{wallet.beneficiary_bank_details.account_number}</p>
                      </div>
                    </>
                  )}
                  {wallet.type === "split" && wallet.account_ref && (
                    <div className={`${miniCardClass} sm:col-span-2`}>
                      <p className={labelMuted}>Shareable Payment Link</p>
                      <p className={`mt-2 text-sm break-all ${isLight ? "text-slate-900" : "text-white"}`}>
                        {`${window.location.origin}/pay/${wallet.account_ref}`}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/pay/${wallet.account_ref}`);
                          setActionMessage("Payment link copied to clipboard.");
                        }}
                        className={`mt-3 ${primaryBtn}`}
                      >
                        Copy Link
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* FX Quote — only for remit wallets */}
              {wallet.type !== "split" && (
                <section className={cardClass}>
                  <div className="mb-4">
                    <p className={`text-sm uppercase tracking-[0.3em] ${isLight ? "text-[#8C7135]" : "text-[#A0A8A0]"}`}>REMIT MODE</p>
                    <h2 className={`mt-2 text-2xl font-display font-semibold ${isLight ? "text-[#111827]" : "text-white"}`}>
                      Send a Contribution
                    </h2>
                    <p className={`mt-2 text-sm ${isLight ? "text-[#7A5F0D]" : "text-[#A8A8A8]"}`}>
                      Lock today's exchange rate before sending funds to this wallet.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className={labelClass}>Amount</label>
                      <input
                        type="number"
                        min="1"
                        value={quoteAmount}
                        onChange={(e) => setQuoteAmount(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. 100"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Currency</label>
                      <select
                        value={quoteCurrency}
                        onChange={(e) => setQuoteCurrency(e.target.value)}
                        className={inputClass}
                      >
                        <option value="GBP">GBP — British Pound</option>
                        <option value="EUR">EUR — Euro</option>
                        <option value="CAD">CAD — Canadian Dollar</option>
                        <option value="USD">USD — US Dollar</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={quoteLoading || !quoteAmount}
                        onClick={handleGetQuote}
                        className={`w-full ${primaryBtn}`}
                      >
                        {quoteLoading ? "Fetching rate..." : "Get Quote"}
                      </button>
                    </div>
                  </div>

                  {quote && (
                    <div className={`mt-5 rounded-3xl border p-5 ${
                      isLight ? "border-[#D4A574] bg-white" : "border-[#FFD600]/30 bg-[#0D0D0D]"
                    }`}>
                      <p className={`text-xs uppercase tracking-widest ${isLight ? "text-[#8C7135]" : "text-[#FFD600]"}`}>
                        Rate locked — valid for 5 minutes
                      </p>
                      <p className={`mt-3 text-3xl font-bold ${isLight ? "text-[#111827]" : "text-white"}`}>
                        {quoteCurrency} {quoteAmount} → {formatCurrency(quote.toAmount)}
                      </p>
                      <div className={`mt-3 flex flex-wrap gap-4 text-sm ${isLight ? "text-[#7A5F0D]" : "text-[#A8A8A8]"}`}>
                        <span>Rate: 1 {quoteCurrency} = ₦{Number(quote.toAmount / quoteAmount).toLocaleString()}</span>
                        <span>Fee: {quote.feeExpression}</span>
                        <span className={`text-xs ${isLight ? "text-[#B38A2D]" : "text-[#666666]"}`}>
                          Rate ID: {quote.exchangeRateId}
                        </span>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Wallet Balance */}
              <section className={cardClass}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div>
                    <h2 className={`text-xl font-display ${isLight ? "text-[#111827]" : "text-white"}`}>Wallet Balance</h2>
                    <p className={`text-sm mt-1 ${isLight ? "text-[#7A5F0D]" : "text-[#A8A8A8]"}`}>
                      Review the current balance and status.
                    </p>
                  </div>
                  <button onClick={handleRefreshBalance} disabled={balanceLoading} className={secondaryBtn}>
                    {balanceLoading ? "Refreshing..." : "Refresh Balance"}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={miniCardClass}>
                    <p className={labelMuted}>Wallet Name</p>
                    <p className={valueBold}>{wallet.name}</p>
                  </div>
                  <div className={miniCardClass}>
                    <p className={labelMuted}>Current Balance</p>
                    <p className={valueBold}>{formatCurrency(wallet.current_balance)}</p>
                  </div>
                  {wallet.target_amount != null && (
                    <div className={miniCardClass}>
                      <p className={labelMuted}>Target Amount</p>
                      <p className={valueBold}>{formatCurrency(wallet.target_amount)}</p>
                    </div>
                  )}
                  <div className={miniCardClass}>
                    <p className={labelMuted}>Status</p>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                      isLight ? "bg-slate-100 text-slate-900" : statusStyles[wallet.status] ?? "bg-[#2A2A2A] text-[#E0E0E0]"
                    }`}>
                      {wallet.status ?? "unknown"}
                    </span>
                  </div>
                </div>
              </section>

              {/* Contributors */}
              <section className={cardClass}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <WovenDivider />
                    <div>
                      <h2 className={`text-xl font-display ${isLight ? "text-[#111827]" : "text-white"}`}>Contributors</h2>
                      <p className={`text-sm mt-1 ${isLight ? "text-[#7A5F0D]" : "text-[#A8A8A8]"}`}>
                        Manage who can contribute to this wallet.
                      </p>
                    </div>
                  </div>
                  <button onClick={handleLoadContributors} disabled={contributorsLoading} className={secondaryBtn}>
                    {contributorsLoading ? "Loading..." : "Load Contributors"}
                  </button>
                </div>

                {contributors.length > 0 ? (
                  <div className="space-y-3 mb-6">
                    {contributors.map((contributor) => (
                      <div
                        key={contributor.id ?? `${contributor.user_id}-${contributor.created_at}`}
                        className={miniCardClass}
                      >
                        <p className={labelMuted}>User ID</p>
                        <p className={`mt-1 text-sm break-all ${isLight ? "text-slate-900" : "text-white"}`}>
                          {contributor.user_id}
                        </p>
                        <p className={`text-xs mt-2 ${isLight ? "text-slate-500" : "text-[#A0A0A0]"}`}>
                          Added on {new Date(contributor.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-sm mb-6 ${isLight ? "text-[#7A5F0D]" : "text-[#A8A8A8]"}`}>
                    No contributors loaded yet. Click "Load Contributors" to fetch.
                  </p>
                )}

                <form onSubmit={handleAddContributor} className="grid gap-4 sm:grid-cols-[1fr_auto]">
                  <div>
                    <label className={labelClass}>Contributor User ID</label>
                    <input
                      type="text"
                      value={contributorUserId}
                      onChange={(e) => setContributorUserId(e.target.value)}
                      className={inputClass}
                      placeholder="Enter user ID"
                    />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" disabled={loading} className={primaryBtn}>
                      {loading ? "Adding..." : "Add Contributor"}
                    </button>
                  </div>
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