import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";

function LoadingSpinner() {
  return (
    <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
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
  active: "bg-[#00C896]/15 text-[#00C896]",
  completed: "bg-[#FFD600]/15 text-[#FFD600]",
};

function Dashboard() {
  const navigate = useNavigate();

  // Wallet creation state
  const [walletName, setWalletName] = useState("");
  const [mode, setMode] = useState("remit");
  const [targetAmount, setTargetAmount] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryAccountNumber, setBeneficiaryAccountNumber] = useState("");
  const [contributorsCount, setContributorsCount] = useState("");
  const [organizerAccountName, setOrganizerAccountName] = useState("");
  const [organizerAccountNumber, setOrganizerAccountNumber] = useState("");
  const [organizerBankCode, setOrganizerBankCode] = useState("");

  // Wallet display state
  const [wallet, setWallet] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [contributorUserId, setContributorUserId] = useState("");
  const [transactions, setTransactions] = useState([]);

  // FX Quote state
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("GBP");
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAccountName, setWithdrawAccountName] = useState("");
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
  const [withdrawBankCode, setWithdrawBankCode] = useState("");

  // Loading/feedback state
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [contributorsLoading, setContributorsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
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
        if (!organizerAccountName.trim() || !organizerAccountNumber.trim() || !organizerBankCode.trim())
          throw new Error("Organizer payout account name, account number, and bank code are required");
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
        contributors_count: mode === "split" ? Number(contributorsCount || 1) : null,
        beneficiary_bank_details:
          mode === "remit"
            ? { name: beneficiaryName, account_number: beneficiaryAccountNumber }
            : null,
        organizer_bank_details:
          mode === "split"
            ? {
                accountName: organizerAccountName,
                accountNumber: organizerAccountNumber,
                bankCode: organizerBankCode,
              }
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
      setTransactions([]);
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

  const handleWithdraw = async (event) => {
    event.preventDefault();
    if (!wallet?.name) return;
    setError("");
    setActionMessage("");
    setWithdrawLoading(true);
    try {
      if (!withdrawAmount || Number(withdrawAmount) <= 0)
        throw new Error("Withdrawal amount is required");
      if (!withdrawAccountName.trim() || !withdrawAccountNumber.trim() || !withdrawBankCode.trim())
        throw new Error("Withdrawal account name, account number, and bank code are required");

      const data = await apiRequest("/withdraw", {
        method: "POST",
        body: JSON.stringify({
          walletName: wallet.name,
          amount: Number(withdrawAmount),
          accountName: withdrawAccountName.trim(),
          accountNumber: withdrawAccountNumber.trim(),
          bankCode: withdrawBankCode.trim(),
        }),
      });

      setWallet((current) => ({ ...current, current_balance: data.newBalance }));
      setWithdrawAmount("");
      setActionMessage("Withdrawal requested successfully.");
      handleLoadTransactions();
    } catch (err) {
      setError(err.message);
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleLoadTransactions = async () => {
    if (!wallet?.id) return;
    setError("");
    setTransactionsLoading(true);
    try {
      const data = await apiRequest(`/wallets/${wallet.id}/transactions`);
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-[#222222] bg-[#1A1A1A] px-4 py-3.5 text-white outline-none transition placeholder:text-[#444444] focus:border-[#FFD600] focus:ring-0";
  const labelClass =
    "mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-[#A0A0A0]";
  const primaryBtn =
    "inline-flex items-center justify-center gap-3 rounded-2xl bg-[#FFD600] px-5 py-4 text-sm font-black text-[#0A0A0A] transition hover:bg-[#E6C900] disabled:cursor-not-allowed disabled:opacity-70";
  const secondaryBtn =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-[#333333] px-4 py-2 text-sm font-bold text-[#A0A0A0] transition hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-60";
  const outlineYellowBtn =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-[#FFD600] px-4 py-3 text-sm font-bold text-[#FFD600] transition hover:bg-[#FFD600] hover:text-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-60";
  const progressPercent = wallet
    ? Math.min(
        100,
        ((Number(wallet.current_balance ?? 0) / Number(wallet.target_amount ?? 1)) * 100) || 0,
      )
    : 0;
  const shareableLink =
    wallet?.type === "split" && wallet?.account_ref
      ? `${window.location.origin}/pay/${wallet.account_ref}`
      : "";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-20 border-b border-[#1A1A1A] bg-[#0A0A0A]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="font-display text-2xl font-semibold tracking-tight">
            RemitSplit<span className="text-[#FFD600]">.</span>
          </div>

          <div className="flex w-full rounded-full border border-[#222222] bg-[#111111] p-1 md:w-auto">
            {["remit", "split"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full px-6 py-2 text-sm font-black transition md:flex-none ${
                  mode === m
                    ? "bg-[#FFD600] text-[#0A0A0A]"
                    : "text-[#A0A0A0] hover:text-white"
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Dark mode enabled"
              className="grid h-10 w-10 place-items-center rounded-full border border-[#333333] text-[#FFD600]"
            >
              ●
            </button>
            <button
              onClick={handleLogout}
              className="rounded-full border border-[#333333] px-4 py-2 text-sm font-bold text-[#A0A0A0] transition hover:border-white hover:text-white"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[800px] space-y-6 px-5 py-6 sm:px-6">
        <section className="rounded-[32px] border border-[#222222] bg-[#111111] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-[#A0A0A0]">
            New Wallet
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Create or open a wallet
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#A0A0A0]">
            {mode === "remit"
              ? "Build a shared family remittance wallet with a beneficiary ready for settlement."
              : "Create a focused collection link for friends, family, or community contributors."}
          </p>

          {(error || actionMessage) && (
            <div className="mt-5 space-y-3">
              {error && (
                <div className="rounded-xl border border-[#FF4444]/30 bg-[#FF4444]/10 px-4 py-3 text-sm text-[#FF4444]">
                  {error}
                </div>
              )}
              {actionMessage && (
                <div className="rounded-xl border border-[#00C896]/25 bg-[#00C896]/10 px-4 py-3 text-sm text-[#00C896]">
                  {actionMessage}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleCreateOrOpenWallet} className="mt-6 grid gap-5">
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

            <div className="rounded-3xl border border-[#222222] bg-[#0A0A0A] p-4 text-sm leading-6 text-[#A0A0A0]">
              <span className="font-bold text-white">
                {mode === "remit" ? "Remit Mode" : "Split Mode"}:
              </span>{" "}
              {mode === "remit"
                ? "Family wallet with locked rates and a fixed beneficiary."
                : "One-off group collection with a target and shareable payment link."}
            </div>

            {mode === "split" && (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Target Amount (₦)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 50000"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Contributors Count</label>
                    <input
                      type="number"
                      min="1"
                      value={contributorsCount}
                      onChange={(e) => setContributorsCount(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 5"
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-[#222222] bg-[#0A0A0A] p-4">
                  <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-[#FFD600]">
                    Organizer Payout Account
                  </p>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <div>
                      <label className={labelClass}>Account Name</label>
                      <input
                        type="text"
                        value={organizerAccountName}
                        onChange={(e) => setOrganizerAccountName(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Aisha Bello"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Account Number</label>
                      <input
                        type="text"
                        value={organizerAccountNumber}
                        onChange={(e) => setOrganizerAccountNumber(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. 1234567890"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Bank Code</label>
                      <input
                        type="text"
                        value={organizerBankCode}
                        onChange={(e) => setOrganizerBankCode(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. 044"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {mode === "remit" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Beneficiary Name</label>
                  <input
                    type="text"
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Mama Aisha"
                  />
                </div>
                <div>
                  <label className={labelClass}>Beneficiary Account Number</label>
                  <input
                    type="text"
                    value={beneficiaryAccountNumber}
                    onChange={(e) => setBeneficiaryAccountNumber(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 1234567890"
                  />
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className={primaryBtn}>
              {loading && <LoadingSpinner />}
              {loading
                ? "Please wait..."
                : mode === "remit"
                  ? "Create / Open Remit Wallet"
                  : "Create / Open Split"}
            </button>
          </form>
        </section>

        {wallet && (
          <>
            <section className="rounded-[32px] border border-[#FFD600]/20 bg-gradient-to-br from-[#111111] to-[#141414] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-[#FFD600]">
                    Active Wallet
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-3xl font-semibold tracking-tight text-white">
                      {wallet.name}
                    </h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                        statusStyles[wallet.status] ?? "bg-white/10 text-white"
                      }`}
                    >
                      {wallet.status ?? "unknown"}
                    </span>
                  </div>
                </div>

                <button onClick={handleRefreshBalance} disabled={balanceLoading} className={secondaryBtn}>
                  {balanceLoading && <LoadingSpinner />}
                  {balanceLoading ? "Refreshing..." : "Refresh Balance"}
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-[#222222] bg-[#0A0A0A] p-5">
                  <p className="text-sm font-medium text-[#A0A0A0]">Current Balance</p>
                  <p className="mt-3 font-display text-3xl font-semibold text-white">
                    {formatCurrency(wallet.current_balance)}
                  </p>
                </div>

                {wallet.type === "split" ? (
                  <div className="rounded-3xl border border-[#222222] bg-[#0A0A0A] p-5">
                    <p className="text-sm font-medium text-[#A0A0A0]">Target Amount</p>
                    <p className="mt-3 font-display text-3xl font-semibold text-white">
                      {formatCurrency(wallet.target_amount)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-[#222222] bg-[#0A0A0A] p-5">
                    <p className="text-sm font-medium text-[#A0A0A0]">Beneficiary</p>
                    <p className="mt-3 text-lg font-bold text-white">
                      {wallet.beneficiary_bank_details?.name ?? "-"}
                    </p>
                    <p className="mt-2 text-sm text-[#A0A0A0]">
                      {wallet.beneficiary_bank_details?.account_number ?? wallet.account_ref ?? "-"}
                    </p>
                  </div>
                )}
              </div>

              {wallet.type === "split" && (
                <div className="mt-6 space-y-5">
                  <div>
                    <div className="mb-2 flex justify-between text-sm text-[#A0A0A0]">
                      <span>Split progress</span>
                      <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#222222]">
                      <div
                        className="h-2 rounded-full bg-[#FFD600]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {shareableLink && (
                    <div>
                      <p className={labelClass}>Shareable Link</p>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <div className="min-w-0 rounded-xl border border-[#333333] bg-[#0A0A0A] px-4 py-3 font-mono text-sm text-[#A0A0A0]">
                          <p className="truncate">{shareableLink}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(shareableLink);
                            setActionMessage("Payment link copied to clipboard.");
                          }}
                          className={outlineYellowBtn}
                        >
                          Copy Link
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {wallet.type !== "split" && (
              <section className="rounded-[32px] border border-[#222222] bg-[#111111] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-7">
                <p className="text-xs font-black uppercase tracking-[0.26em] text-[#FFD600]">
                  Send A Contribution
                </p>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">
                  Get today's rate
                </h2>

                <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
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
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                      <option value="CAD">CAD</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={quoteLoading || !quoteAmount}
                      onClick={handleGetQuote}
                      className={`${primaryBtn} w-full sm:w-auto`}
                    >
                      {quoteLoading && <LoadingSpinner />}
                      {quoteLoading ? "Fetching..." : "Get Quote"}
                    </button>
                  </div>
                </div>

                {quote && (
                  <div className="mt-6 rounded-2xl border border-[#FFD600]/30 bg-[#0A0A0A] p-5">
                    <p className="font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
                      {quoteCurrency} {quoteAmount} → {formatCurrency(quote.toAmount)}
                    </p>
                    <p className="mt-4 text-sm text-[#A0A0A0]">
                      1 {quoteCurrency} = ₦
                      {Number(quote.toAmount / quoteAmount).toLocaleString()} · Fee:{" "}
                      {quote.feeExpression} · Rate locked 5 min
                    </p>
                    <p className="mt-3 text-xs text-[#555555]">
                      Rate ID: {quote.exchangeRateId}
                    </p>
                  </div>
                )}
              </section>
            )}

            {wallet.type !== "split" && (
              <section className="rounded-[32px] border border-[#222222] bg-[#111111] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-7">
                <p className="text-xs font-black uppercase tracking-[0.26em] text-[#FFD600]">
                  Beneficiary Withdrawal
                </p>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">
                  Send funds home
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#A0A0A0]">
                  Withdraw from the current wallet balance after Nomba verifies the beneficiary account.
                </p>

                <form onSubmit={handleWithdraw} className="mt-6 grid gap-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Amount (₦)</label>
                      <input
                        type="number"
                        min="1"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. 25000"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Bank Code</label>
                      <input
                        type="text"
                        value={withdrawBankCode}
                        onChange={(e) => setWithdrawBankCode(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. 044"
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Account Name</label>
                      <input
                        type="text"
                        value={withdrawAccountName}
                        onChange={(e) => setWithdrawAccountName(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Mama Aisha"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Account Number</label>
                      <input
                        type="text"
                        value={withdrawAccountNumber}
                        onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. 1234567890"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={withdrawLoading} className={primaryBtn}>
                    {withdrawLoading && <LoadingSpinner />}
                    {withdrawLoading ? "Requesting..." : "Request Withdrawal"}
                  </button>
                </form>
              </section>
            )}

            <section className="rounded-[32px] border border-[#222222] bg-[#111111] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-[#A0A0A0]">
                    Ledger
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
                    Transaction history
                  </h2>
                </div>
                <button onClick={handleLoadTransactions} disabled={transactionsLoading} className={secondaryBtn}>
                  {transactionsLoading && <LoadingSpinner />}
                  {transactionsLoading ? "Loading..." : "Load History"}
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {transactions.length > 0 ? (
                  transactions.map((transaction) => (
                    <div
                      key={transaction.id ?? transaction.provider_transaction_id}
                      className="grid gap-3 rounded-2xl border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-3 sm:grid-cols-[1fr_auto]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm text-white">
                          {transaction.provider_transaction_id ?? "manual-ledger-entry"}
                        </p>
                        <p className="mt-1 text-xs text-[#A0A0A0]">
                          {transaction.created_at
                            ? new Date(transaction.created_at).toLocaleString()
                            : "Timestamp pending"}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className={transaction.type === "debit" ? "font-bold text-[#FF4444]" : "font-bold text-[#00C896]"}>
                          {transaction.type === "debit" ? "-" : "+"}
                          {formatCurrency(transaction.amount)}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#555555]">
                          {transaction.status ?? "successful"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-3 text-sm text-[#A0A0A0]">
                    No transactions loaded yet. Incoming webhooks and withdrawals appear here when the ledger table is available.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[32px] border border-[#222222] bg-[#111111] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-[#A0A0A0]">
                    Contributors
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
                    Wallet contributors
                  </h2>
                </div>
                <button onClick={handleLoadContributors} disabled={contributorsLoading} className={secondaryBtn}>
                  {contributorsLoading && <LoadingSpinner />}
                  {contributorsLoading ? "Loading..." : "Load Contributors"}
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {contributors.length > 0 ? (
                  contributors.map((contributor) => (
                    <div
                      key={contributor.id ?? `${contributor.user_id}-${contributor.created_at}`}
                      className="rounded-2xl border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-3"
                    >
                      <p className="truncate font-mono text-sm text-white">
                        {contributor.user_id}
                      </p>
                      <p className="mt-1 text-xs text-[#A0A0A0]">
                        Added on {new Date(contributor.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-3 text-sm text-[#A0A0A0]">
                    No contributors loaded yet. Click "Load Contributors" to fetch.
                  </p>
                )}
              </div>

              <form onSubmit={handleAddContributor} className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
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
                  <button type="submit" disabled={loading} className={`${outlineYellowBtn} w-full`}>
                    {loading && <LoadingSpinner />}
                    {loading ? "Adding..." : "Add Contributor"}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
