import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";

function LoadingSpinner() {
  return (
    <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
  );
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 18v-5h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.1 9A7 7 0 0 1 18 6.3L20 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.9 15A7 7 0 0 1 6 17.7L4 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 17l5-5-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 12H3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 4h3a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
  archived: "bg-white/10 text-[#A0A0A0]",
};

function Dashboard() {
  const navigate = useNavigate();

  const [walletName, setWalletName] = useState("");
  const [mode, setMode] = useState("remit");
  const [targetAmount, setTargetAmount] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryAccountNumber, setBeneficiaryAccountNumber] = useState("");
  const [contributorsCount, setContributorsCount] = useState("");
  const [organizerAccountName, setOrganizerAccountName] = useState("");
  const [organizerAccountNumber, setOrganizerAccountNumber] = useState("");
  const [organizerBankCode, setOrganizerBankCode] = useState("");

  const [wallet, setWallet] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [contributors, setContributors] = useState([]);
  const [contributorUserId, setContributorUserId] = useState("");
  const [transactions, setTransactions] = useState([]);

  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("GBP");
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAccountName, setWithdrawAccountName] = useState("");
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
  const [withdrawBankCode, setWithdrawBankCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [contributorsLoading, setContributorsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [error, setError] = useState("");
  const [mobileTab, setMobileTab] = useState("home");

  const userName = localStorage.getItem("user_name") || "there";

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

  const remitWallets = wallets.filter((item) => item.type !== "split");
  const splitWallets = wallets.filter((item) => item.type === "split");
  const activeWallets = wallets.filter((item) => item.status === "active");
  const totalBalance = wallets.reduce((sum, item) => sum + Number(item.current_balance || 0), 0);
  const visibleWallets = mode === "split" ? splitWallets : remitWallets;
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
  const mobileSectionClass = (tab) => (mobileTab === tab ? "" : "hidden xl:block");

  const handleLoadWallets = useCallback(async () => {
    setWalletsLoading(true);
    setError("");
    try {
      const data = await apiRequest("/wallets");
      const nextWallets = data.wallets || [];
      setWallets(nextWallets);
      setWallet((current) => {
        if (current) return nextWallets.find((item) => item.id === current.id) || current;
        return (
          nextWallets.find((item) => (mode === "split" ? item.type === "split" : item.type !== "split")) ||
          nextWallets[0] ||
          null
        );
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setWalletsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    handleLoadWallets();
  }, [handleLoadWallets, navigate]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_name");
    navigate("/", { replace: true });
  };

  const selectWallet = (nextWallet) => {
    setWallet(nextWallet);
    setMode(nextWallet.type === "split" ? "split" : "remit");
    setMobileTab("activity");
    setContributors([]);
    setTransactions([]);
    setQuote(null);
    setError("");
    setActionMessage("");
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    const nextWallet = wallets.find((item) =>
      nextMode === "split" ? item.type === "split" : item.type !== "split",
    );
    setWallet(nextWallet || null);
    setContributors([]);
    setTransactions([]);
    setQuote(null);
    setError("");
    setActionMessage("");
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

      const nextWallet = {
        ...data.wallet,
        virtualAccount: data.virtualAccount || null,
        plannedContributors: contributorsCount ? Number(contributorsCount) : null,
      };

      setWallet(nextWallet);
      setWalletName("");
      setTargetAmount("");
      setContributorsCount("");
      setBeneficiaryName("");
      setBeneficiaryAccountNumber("");
      setOrganizerAccountName("");
      setOrganizerAccountNumber("");
      setOrganizerBankCode("");
      setContributors([]);
      setContributorUserId("");
      setTransactions([]);
      setMobileTab("activity");
      setActionMessage(data.reused ? "Existing wallet loaded." : "Wallet created successfully.");
      handleLoadWallets();
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
      setWallets((current) =>
        current.map((item) => (item.id === wallet.id ? { ...item, ...data.wallet } : item)),
      );
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
      setWallets((current) =>
        current.map((item) =>
          item.id === wallet.id ? { ...item, current_balance: data.newBalance } : item,
        ),
      );
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

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="sticky top-0 z-30 border-b border-[#1A1A1A] bg-[#0A0A0A]/95 px-4 py-3 backdrop-blur lg:h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-5">
        <div className="lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#FFD600] font-black text-[#0A0A0A]">
                {userName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs text-[#A0A0A0]">Welcome back</p>
                <div className="truncate font-display text-2xl font-semibold leading-none tracking-tight">
                  RemitSplit<span className="text-[#FFD600]">.</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleLoadWallets}
                disabled={walletsLoading}
                aria-label="Sync wallets"
                className="grid h-10 w-10 place-items-center rounded-full border border-[#333333] text-sm font-black text-[#FFD600] transition hover:border-[#FFD600]"
              >
                {walletsLoading ? <LoadingSpinner /> : <RefreshIcon />}
              </button>
              <button
                onClick={handleLogout}
                aria-label="Log out"
                className="grid h-10 w-10 place-items-center rounded-full border border-[#333333] text-xs font-black text-[#A0A0A0] transition hover:border-white hover:text-white"
              >
                <LogoutIcon />
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 rounded-full border border-[#222222] bg-[#111111] p-1">
            {[
              ["remit", "Remit"],
              ["split", "Split"],
            ].map(([itemMode, label]) => (
              <button
                key={itemMode}
                type="button"
                onClick={() => handleModeChange(itemMode)}
                className={`rounded-full px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.18em] transition ${
                  mode === itemMode
                    ? "bg-[#FFD600] text-[#0A0A0A]"
                    : "text-[#A0A0A0] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="font-display text-3xl font-semibold tracking-tight">
            RemitSplit<span className="text-[#FFD600]">.</span>
          </div>
          <p className="mt-2 text-xs uppercase tracking-[0.24em] text-[#555555]">
            Built on Nomba
          </p>
        </div>

        <nav className="mt-6 hidden gap-2 lg:grid lg:grid-cols-1">
          {[
            ["remit", "Remit", "Family wallet"],
            ["split", "Split", "Group collection"],
          ].map(([itemMode, label, description]) => (
            <button
              key={itemMode}
              type="button"
              onClick={() => handleModeChange(itemMode)}
              className={`rounded-3xl border px-4 py-4 text-left transition ${
                mode === itemMode
                  ? "border-[#FFD600]/40 bg-[#FFD600] text-[#0A0A0A]"
                  : "border-[#222222] bg-[#111111] text-white hover:border-[#FFD600]/40"
              }`}
            >
              <span className="block text-sm font-black uppercase tracking-[0.18em]">{label}</span>
              <span className={`mt-1 block text-xs ${mode === itemMode ? "text-[#0A0A0A]/70" : "text-[#A0A0A0]"}`}>
                {description}
              </span>
            </button>
          ))}
        </nav>

        <div className="mt-6 hidden rounded-[28px] border border-[#222222] bg-[#111111] p-4 lg:block">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#A0A0A0]">
            Portfolio
          </p>
          <p className="mt-3 font-display text-3xl font-semibold text-white">
            {formatCurrency(totalBalance)}
          </p>
          <p className="mt-2 text-sm text-[#A0A0A0]">
            Across {wallets.length} wallet{wallets.length === 1 ? "" : "s"}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="mt-6 hidden w-full rounded-full border border-[#333333] px-4 py-3 text-sm font-bold text-[#A0A0A0] transition hover:border-white hover:text-white lg:block"
        >
          Log Out
        </button>
      </aside>

      <main className="min-w-0 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pt-6 xl:pb-6">
        <section className={`rounded-[32px] border border-[#222222] bg-[#111111] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-7 ${mobileSectionClass("home")}`}>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-[#FFD600]">
                Welcome back
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Hi, {userName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A0A0A0]">
                Track every remit wallet and split collection from one workspace. Pick a mode,
                create a wallet, or open an existing one from your wallet tracker.
              </p>
            </div>

            <button onClick={handleLoadWallets} disabled={walletsLoading} className={secondaryBtn}>
              {walletsLoading && <LoadingSpinner />}
              {walletsLoading ? "Syncing..." : "Sync Wallets"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-[#222222] bg-[#0A0A0A] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#555555]">
                Total Balance
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-white">
                {formatCurrency(totalBalance)}
              </p>
            </div>
            <div className="rounded-3xl border border-[#222222] bg-[#0A0A0A] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#555555]">
                Active Wallets
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-white">
                {activeWallets.length}
              </p>
            </div>
            <div className="rounded-3xl border border-[#222222] bg-[#0A0A0A] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#555555]">
                Current Mode
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-white">
                {mode === "split" ? "Split" : "Remit"}
              </p>
            </div>
          </div>
        </section>

        {(error || actionMessage) && (
          <div className="mt-6 space-y-3">
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

        <div className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
          <section className="space-y-6">
            <div className={`rounded-[32px] border border-[#222222] bg-[#111111] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] ${mobileSectionClass("create")}`}>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-[#A0A0A0]">
                New {mode === "split" ? "Split" : "Wallet"}
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">
                {mode === "split" ? "Create a split" : "Create a remit wallet"}
              </h2>

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

                {mode === "split" && (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
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
                        Organizer Payout
                      </p>
                      <div className="grid gap-4">
                        <input
                          type="text"
                          value={organizerAccountName}
                          onChange={(e) => setOrganizerAccountName(e.target.value)}
                          className={inputClass}
                          placeholder="Account name"
                        />
                        <input
                          type="text"
                          value={organizerAccountNumber}
                          onChange={(e) => setOrganizerAccountNumber(e.target.value)}
                          className={inputClass}
                          placeholder="Account number"
                        />
                        <input
                          type="text"
                          value={organizerBankCode}
                          onChange={(e) => setOrganizerBankCode(e.target.value)}
                          className={inputClass}
                          placeholder="Bank code"
                        />
                      </div>
                    </div>
                  </>
                )}

                {mode === "remit" && (
                  <div className="grid gap-5">
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
            </div>

            <div className={`rounded-[32px] border border-[#222222] bg-[#111111] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] ${mobileSectionClass("wallets")}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-[#A0A0A0]">
                    Your Wallets
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                    {mode === "split" ? "Split tracker" : "Remit tracker"}
                  </h2>
                </div>
                <span className="rounded-full bg-[#FFD600]/10 px-3 py-1 text-xs font-black text-[#FFD600]">
                  {visibleWallets.length}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {visibleWallets.length > 0 ? (
                  visibleWallets.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectWallet(item)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        wallet?.id === item.id
                          ? "border-[#FFD600]/50 bg-[#FFD600]/10"
                          : "border-[#1E1E1E] bg-[#0A0A0A] hover:border-[#333333]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-white">{item.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#555555]">
                            {item.type === "split" ? "Split" : "Remit"} wallet
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                            statusStyles[item.status] ?? "bg-white/10 text-white"
                          }`}
                        >
                          {item.status ?? "unknown"}
                        </span>
                      </div>
                      <p className="mt-3 font-display text-xl font-semibold text-white">
                        {formatCurrency(item.current_balance)}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-5 text-sm leading-6 text-[#A0A0A0]">
                    No {mode === "split" ? "split" : "remit"} wallets yet. Create one above and it will appear here.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={`min-w-0 space-y-6 ${mobileSectionClass("activity")}`}>
            {wallet ? (
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
                        No transactions loaded yet. Incoming webhooks and withdrawals appear here.
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
            ) : (
              <section className="rounded-[32px] border border-[#222222] bg-[#111111] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
                <p className="text-xs font-black uppercase tracking-[0.26em] text-[#FFD600]">
                  No Wallet Selected
                </p>
                <h2 className="mt-3 font-display text-4xl font-semibold text-white">
                  Start with your first wallet
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#A0A0A0]">
                  Create a remit wallet or split collection from the left panel. Once created,
                  it will stay in your tracker for quick access.
                </p>
              </section>
            )}
          </section>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#222222] bg-[#0A0A0A]/95 px-3 pb-3 pt-2 backdrop-blur xl:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2 rounded-[28px] border border-[#222222] bg-[#111111] p-2 shadow-[0_-16px_50px_rgba(0,0,0,0.45)]">
          {[
            ["home", "Home", "⌂"],
            ["create", "Create", "+"],
            ["wallets", "Wallets", "▣"],
            ["activity", "Activity", "↗"],
          ].map(([tab, label, icon]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={`flex min-h-16 flex-col items-center justify-center rounded-2xl px-2 text-xs font-black transition ${
                mobileTab === tab
                  ? "bg-[#FFD600] text-[#0A0A0A]"
                  : "text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white"
              }`}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className="mt-1">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default Dashboard;
