import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function PaymentLink() {
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

  const targetAmount = Number(account?.target_amount ?? account?.expectedAmount ?? 0);
  const currentAmount = Number(account?.current_balance ?? 0);
  const progressPercent = Math.min(100, ((currentAmount / Number(targetAmount || 1)) * 100) || 0);
  const displayAccountNumber = account?.accountNumber ?? accountRef;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-5 py-10 text-white">
      <div className="w-full max-w-[480px] rounded-[40px] border border-[#222222] bg-[#111111] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)] sm:p-8">
        {loading ? (
          <div className="py-16 text-center">
            <div className="mx-auto h-12 w-12 rounded-full border-2 border-[#FFD600] border-t-transparent animate-spin" />
            <p className="mt-5 text-sm text-[#A0A0A0]">Loading payment details...</p>
          </div>
        ) : error ? (
          <div className="py-14 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#FF4444]/30 bg-[#FF4444]/10 text-xl text-[#FF4444]">
              !
            </div>
            <h1 className="mt-5 font-display text-2xl font-semibold text-white">
              Payment link unavailable
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#A0A0A0]">{error}</p>
          </div>
        ) : (
          <>
            <div>
              <span className="inline-flex rounded-full border border-[#FFD600]/30 bg-[#FFD600]/10 px-3 py-1 text-xs font-bold text-[#FFD600]">
                RemitSplit · Powered by Nomba
              </span>
              <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-white">
                Pay into Split
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#A0A0A0]">
                {account?.name ?? account?.accountName ?? "Shared contribution wallet"}
              </p>
            </div>

            <div className="mt-6 rounded-2xl border-2 border-[#FFD600] bg-[#0A0A0A] p-5">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#FFD600]">
                Virtual Account Number
              </p>
              <p className="mt-4 break-all text-4xl font-black tracking-widest text-white">
                {displayAccountNumber}
              </p>
              <p className="mt-3 text-sm font-medium text-[#A0A0A0]">Nombank MFB</p>
            </div>

            <div className="mt-5 divide-y divide-[#222222] rounded-3xl border border-[#222222] bg-[#0A0A0A] px-5">
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-sm text-[#A0A0A0]">Expected amount</span>
                <span className="font-display text-2xl font-semibold text-white">
                  {formatCurrency(account.expectedAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-sm text-[#A0A0A0]">Expiry date</span>
                <span className="text-sm font-bold text-white">
                  {account.expiryDate
                    ? new Date(account.expiryDate).toLocaleDateString()
                    : "No expiry set"}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-white">Split Progress</p>
                <p className="text-sm text-[#A0A0A0]">{Math.round(progressPercent)}%</p>
              </div>
              <div className="mb-3 flex items-center justify-between text-xs text-[#A0A0A0]">
                <span>{formatCurrency(currentAmount)}</span>
                <span>{formatCurrency(targetAmount)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#222222]">
                <div
                  className="h-2 rounded-full bg-[#FFD600]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-7">
              <p className="text-sm font-bold text-white">Payment Instructions</p>
              <ol className="mt-4 space-y-3">
                {[
                  "Copy the virtual account number above.",
                  "Open your bank app, USSD, or transfer channel.",
                  "Send the expected amount to Nombank MFB.",
                  "Keep your receipt while the split updates automatically.",
                ].map((instruction, index) => (
                  <li key={instruction} className="flex gap-3 text-sm leading-6 text-[#A0A0A0]">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FFD600] text-xs font-black text-[#0A0A0A]">
                      {index + 1}
                    </span>
                    <span>{instruction}</span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentLink;
