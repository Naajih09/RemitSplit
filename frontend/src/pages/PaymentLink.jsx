import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function PaymentLink({ theme }) {
  const isLight = theme === "light";
  const { accountRef } = useParams();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchAccount() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/public/split/${accountRef}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to fetch split payment details");
        }
        setAccount({
          ...data.payment,
          ...data.wallet,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchAccount();
  }, [accountRef]);

  function formatCurrency(value) {
    const amount = Number(value ?? 0);
    if (Number.isNaN(amount)) return "₦0.00";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
    }).format(amount);
  }

  return (
    <div className={`min-h-screen ${isLight ? "bg-[#FEF7D2] text-[#111827]" : "bg-[#080808] text-white"}`}>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className={`rounded-[28px] border p-8 ${isLight ? "border-[#D4A574] bg-[#FFF7D0]" : "border-[#222222] bg-[#111111]"}`}>
          <h1 className={`text-3xl font-semibold ${isLight ? "text-[#111827]" : "text-white"}`}>Pay Split</h1>
          <p className={`mt-3 text-sm ${isLight ? "text-[#7A5F0D]" : "text-[#A8A8A8]"}`}>
            Use this page to pay into the split via the dedicated virtual account.
          </p>

          {loading ? (
            <p className="mt-6 text-sm">Loading payment details...</p>
          ) : error ? (
            <div className={`mt-6 rounded-3xl border px-4 py-3 ${isLight ? "border-[#D4A574] bg-[#FFF4B8] text-[#111827]" : "border-[#3D1212] bg-[#300B0B] text-[#FFB3B3]"}`}>
              {error}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className={`rounded-3xl border p-5 ${isLight ? "border-slate-200 bg-slate-50" : "border-[#222222] bg-[#121212]"}`}>
                <p className="text-sm uppercase tracking-[0.24em] text-[#FFD600]">Virtual Account</p>
                <p className={`mt-3 text-lg font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>{accountRef}</p>
                <p className={`mt-2 text-sm ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`}>
                  Send payment to the virtual account below to contribute to the split.
                </p>
              </div>

              <div className={`rounded-3xl border p-5 ${isLight ? "border-slate-200 bg-slate-50" : "border-[#222222] bg-[#121212]"}`}>
                <p className="text-sm text-[#A8A8A8]">Expected Amount</p>
                <p className={`mt-3 text-2xl font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>{formatCurrency(account.expectedAmount)}</p>
              </div>

              <div className={`rounded-3xl border p-5 ${isLight ? "border-slate-200 bg-slate-50" : "border-[#222222] bg-[#121212]"}`}>
                <p className="text-sm text-[#A8A8A8]">Account Name</p>
                <p className={`mt-3 text-lg font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>{account.accountName}</p>
                <p className={`mt-2 text-sm ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`}>Account ref: {account.accountRef}</p>
                {account.accountNumber && (
                  <p className={`mt-2 text-sm ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`}>Account number: {account.accountNumber}</p>
                )}
                {account.expiryDate && (
                  <p className={`mt-2 text-sm ${isLight ? "text-slate-600" : "text-[#A8A8A8]"}`}>Expires: {new Date(account.expiryDate).toLocaleDateString() ?? account.expiryDate}</p>
                )}
              </div>

              <div className={`rounded-3xl border p-5 ${isLight ? "border-slate-200 bg-slate-50" : "border-[#222222] bg-[#121212]"}`}>
                <p className="text-sm text-[#A8A8A8]">Split Progress</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Collected</span>
                    <span>{formatCurrency(account.current_balance ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Target</span>
                    <span>{formatCurrency(account.target_amount ?? account.expectedAmount ?? 0)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#FFD600]"
                      style={{ width: `${Math.min(100, ((Number(account.current_balance ?? 0) / Number(account.target_amount ?? account.expectedAmount ?? 1)) * 100) || 0)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className={`rounded-3xl border p-5 ${isLight ? "border-slate-200 bg-slate-50" : "border-[#222222] bg-[#121212]"}`}>
                <p className="text-sm text-[#A8A8A8]">Payment Instructions</p>
                <ul className="mt-3 space-y-2 text-sm leading-6">
                  <li>1. Copy the account number above.</li>
                  <li>2. Pay from your bank app or USSD.</li>
                  <li>3. Use the amount shown to complete the split.</li>
                  <li>4. Return to this page if you need to confirm the account details.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentLink;
