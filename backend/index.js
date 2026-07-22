require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { supabase, supabaseAdmin } = require("./supabase");
const nomba = require("./nomba");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ─── Raw body parser for webhooks (MUST come before JSON parser) ───────────
app.use("/webhooks/nomba", express.raw({ type: "application/json" }));

// ─── JSON body parser for everything else ───────────────────────────────────
app.use(express.json());

// ─── Authentication middleware ──────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = data.user;
  next();
}

// ─── Auth routes ────────────────────────────────────────────────────────────
app.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const { data, error } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || "" } },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      user: data.user,
      session: data.session,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(200).json({
      user: data.user,
      session: data.session,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/auth/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(200).json({
      session: data.session,
      user: data.user,
    });
  } catch (err) {
    console.error("Refresh error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Wallet routes ──────────────────────────────────────────────────────────
async function generateAccountRef() {
  const { data: existing } = await supabase
    .from("wallets")
    .select("account_ref")
    .order("created_at", { ascending: false })
    .limit(1);

  const lastRef = existing?.[0]?.account_ref || "RSP-00000000";
  const num = parseInt(lastRef.split("-")[1], 10) + 1;
  return `RSP-${String(num).padStart(8, "0")}`;
}

app.post("/wallets", requireAuth, async (req, res) => {
  try {
    const { name, type, target_amount, contributors_count, beneficiary_bank_details, organizer_bank_details } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required" });
    }

    if (!["wallet", "split"].includes(type)) {
      return res.status(400).json({ error: "Type must be 'wallet' or 'split'" });
    }

    // Check for existing wallet with same name and type
    const { data: existingWallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", req.user.id)
      .eq("name", name.trim())
      .eq("type", type === "split" ? "split" : "remit")
      .maybeSingle();

    if (existingWallet) {
      return res.status(200).json({
        wallet: existingWallet,
        reused: true,
      });
    }

    const accountRef = await generateAccountRef();
    const walletType = type === "split" ? "split" : "remit";

    // Create virtual account via Nomba
    let virtualAccount = null;
    try {
      virtualAccount = await nomba.createVirtualAccount({
        accountRef,
        accountName: name.trim(),
        expectedAmount: target_amount || undefined,
      });
    } catch (nombaErr) {
      console.warn("Nomba virtual account creation failed, proceeding without it:", nombaErr.message);
    }

    const walletData = {
      user_id: req.user.id,
      account_ref: accountRef,
      name: name.trim(),
      type: walletType,
      target_amount: type === "split" ? target_amount : null,
      current_balance: 0,
      virtual_account_number: virtualAccount?.accountNumber || null,
      virtual_account_payload: virtualAccount || null,
      beneficiary_bank_details: type === "split" ? organizer_bank_details : beneficiary_bank_details,
      status: "active",
    };

    const { data, error } = await supabase
      .from("wallets")
      .insert(walletData)
      .select()
      .single();

    if (error) {
      console.error("Wallet insert error:", error);
      return res.status(500).json({ error: "Failed to create wallet" });
    }

    return res.status(201).json({
      wallet: data,
      virtualAccount,
    });
  } catch (err) {
    console.error("Create wallet error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/wallets", requireAuth, async (req, res) => {
  try {
    const { data: owned } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    const { data: contributed } = await supabase
      .from("wallet_contributors")
      .select("wallet_id")
      .eq("user_id", req.user.id);

    let contributedWallets = [];
    if (contributed?.length) {
      const walletIds = contributed.map((c) => c.wallet_id);
      const { data: cw } = await supabase
        .from("wallets")
        .select("*")
        .in("id", walletIds)
        .order("created_at", { ascending: false });
      contributedWallets = cw || [];
    }

    // Merge, deduplicate by id
    const walletMap = new Map();
    [...(owned || []), ...contributedWallets].forEach((w) => walletMap.set(w.id, w));
    const wallets = Array.from(walletMap.values());

    return res.status(200).json({ wallets });
  } catch (err) {
    console.error("Get wallets error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/wallets/:id", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Check access
    if (data.user_id !== req.user.id) {
      const { data: contributor } = await supabase
        .from("wallet_contributors")
        .select("id")
        .eq("wallet_id", data.id)
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (!contributor) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    return res.status(200).json({ wallet: data });
  } catch (err) {
    console.error("Get wallet error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/wallets/:id/balance", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Try to fetch latest from Nomba
    let nombaAccount = null;
    if (data.account_ref) {
      try {
        nombaAccount = await nomba.fetchVirtualAccount(data.account_ref);
      } catch (nombaErr) {
        console.warn("Nomba fetch failed, using local balance:", nombaErr.message);
      }
    }

    const wallet = {
      ...data,
      current_balance: nombaAccount?.balance ?? data.current_balance,
    };

    // Update local balance if Nomba returned a newer value
    if (nombaAccount?.balance != null && Number(nombaAccount.balance) !== Number(data.current_balance)) {
      await supabase
        .from("wallets")
        .update({ current_balance: nombaAccount.balance })
        .eq("id", data.id);
    }

    return res.status(200).json({ wallet });
  } catch (err) {
    console.error("Get balance error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/wallets/:id/contributors", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("wallet_contributors")
      .select("*, users:user_id(email)")
      .eq("wallet_id", req.params.id);

    if (error) {
      return res.status(500).json({ error: "Failed to fetch contributors" });
    }

    return res.status(200).json({ contributors: data || [] });
  } catch (err) {
    console.error("Get contributors error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/wallets/:id/contributors", requireAuth, async (req, res) => {
  try {
    const { contributorUserId } = req.body;

    if (!contributorUserId) {
      return res.status(400).json({ error: "contributorUserId is required" });
    }

    const { data, error } = await supabase
      .from("wallet_contributors")
      .insert({
        wallet_id: req.params.id,
        user_id: contributorUserId,
        added_by: req.user.id,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ contributor: data });
  } catch (err) {
    console.error("Add contributor error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/wallets/:id/transactions", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", req.params.id)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }

    return res.status(200).json({ transactions: data || [] });
  } catch (err) {
    console.error("Get transactions error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Quote route ────────────────────────────────────────────────────────────
app.post("/contribute/quote", requireAuth, async (req, res) => {
  try {
    const { walletName, amount, currency } = req.body;

    if (!walletName || !amount || !currency) {
      return res.status(400).json({ error: "walletName, amount, and currency are required" });
    }

    // Fetch exchange rate from Nomba
    const rates = await nomba.fetchExchangeRate({ from: currency, to: "NGN" });

    if (!rates?.length) {
      return res.status(502).json({ error: "No exchange rate available from Nomba" });
    }

    const rate = rates[0];
    const rateValue = Number(rate.rate);
    const toAmount = Number(amount) * rateValue;

    const quote = {
      fromAmount: Number(amount),
      fromCurrency: currency,
      toAmount: Math.round(toAmount * 100) / 100,
      toCurrency: "NGN",
      rate: rateValue,
      feeExpression: `${rate.feePercent || 0}% + ₦${rate.feeFlat || 0}`,
      exchangeRateId: rate.exchangeRateId || `rate-${Date.now()}`,
    };

    return res.status(200).json({ quote });
  } catch (err) {
    console.error("Get quote error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Withdraw route ─────────────────────────────────────────────────────────
app.post("/withdraw", requireAuth, async (req, res) => {
  try {
    const { walletName, amount, accountName, accountNumber, bankCode } = req.body;

    if (!walletName || !amount || !accountName || !accountNumber || !bankCode) {
      return res.status(400).json({ error: "All withdrawal fields are required" });
    }

    // Find wallet
    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", req.user.id)
      .eq("name", walletName)
      .single();

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    if (Number(amount) > Number(wallet.current_balance)) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Initiate transfer via Nomba
    const merchantTxRef = `WTH-${wallet.id}-${Date.now()}`;

    const transferResult = await nomba.transferToBank({
      amount: Number(amount),
      accountNumber,
      accountName,
      bankCode,
      merchantTxRef,
      senderName: req.user.email || "RemitSplit User",
      narration: `Withdrawal from ${wallet.name}`,
    });

    // Record debit transaction
    await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "debit",
      amount: Number(amount),
      currency: "NGN",
      provider: "nomba",
      provider_transaction_id: merchantTxRef,
      status: "successful",
      metadata: { transferResult },
    });

    // Update balance
    const newBalance = Number(wallet.current_balance) - Number(amount);
    await supabase
      .from("wallets")
      .update({ current_balance: newBalance })
      .eq("id", wallet.id);

    return res.status(200).json({
      newBalance,
      transfer: transferResult,
    });
  } catch (err) {
    console.error("Withdraw error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Public split payment page ──────────────────────────────────────────────
app.get("/public/split/:accountRef", async (req, res) => {
  try {
    const { accountRef } = req.params;

    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("account_ref", accountRef)
      .single();

    if (!wallet) {
      return res.status(404).json({ error: "Split not found" });
    }

    // Try to fetch virtual account details from Nomba
    let payment = null;
    try {
      const nombaAccount = await nomba.fetchVirtualAccount(accountRef);
      payment = {
        accountNumber: nombaAccount.accountNumber,
        accountName: nombaAccount.accountName,
        expectedAmount: nombaAccount.expectedAmount || wallet.target_amount,
        expiryDate: nombaAccount.expiryDate,
        bankName: "Nombank MFB",
      };
    } catch (nombaErr) {
      // Fall back to local data
      payment = {
        accountNumber: wallet.virtual_account_number || wallet.account_ref,
        accountName: wallet.name,
        expectedAmount: wallet.target_amount,
        bankName: "Nombank MFB",
      };
    }

    return res.status(200).json({
      payment,
      wallet: {
        name: wallet.name,
        current_balance: wallet.current_balance,
        target_amount: wallet.target_amount,
        status: wallet.status,
      },
    });
  } catch (err) {
    console.error("Public split error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Nomba webhook handler ──────────────────────────────────────────────────
function verifyNombaSignature(req, bodyString) {
  const signature = req.headers["nomba-signature"];
  const timestamp = req.headers["nomba-timestamp"];

  if (!signature || !timestamp) {
    return false;
  }

  const payload = JSON.parse(bodyString);
  const { event_type, requestId, data: webhookData } = payload;

  // Build the signature string per Nomba convention
  const transaction = webhookData?.transaction || {};
  const merchant = webhookData?.merchant || {};

  const signString = [
    event_type || "",
    requestId || "",
    merchant.userId || "",
    merchant.walletId || "",
    transaction.transactionId || "",
    transaction.type || "",
    transaction.time || "",
    webhookData?.customer?.responseCode || "",
    timestamp,
  ].join(":");

  const expectedSignature = crypto
    .createHmac("sha256", process.env.NOMBA_WEBHOOK_SECRET || "")
    .update(signString)
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

app.post("/webhooks/nomba", async (req, res) => {
  const bodyString = req.body.toString("utf8");

  try {
    // Verify signature
    if (!verifyNombaSignature(req, bodyString)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const payload = JSON.parse(bodyString);
    const { event_type, data: webhookData } = payload;

    if (event_type !== "payment_success") {
      return res.status(200).json({ status: "ignored" });
    }

    const transaction = webhookData?.transaction || {};
    const transactionId = transaction.transactionId;
    const amount = Number(transaction.transactionAmount || 0);
    const accountRef = transaction.aliasAccountReference || webhookData?.merchant?.walletId;

    if (!transactionId || !accountRef || amount <= 0) {
      return res.status(200).json({ status: "ignored", reason: "missing fields" });
    }

    // Deduplicate: check if this transaction was already processed
    const { data: existing } = await supabase
      .from("wallet_transactions")
      .select("id")
      .eq("provider_transaction_id", transactionId)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ status: "duplicate", transactionId });
    }

    // Find the wallet by account_ref
    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("account_ref", accountRef)
      .maybeSingle();

    if (!wallet) {
      return res.status(200).json({ status: "ignored", reason: "wallet not found" });
    }

    // Insert credit transaction
    await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "credit",
      amount,
      currency: "NGN",
      provider: "nomba",
      provider_transaction_id: transactionId,
      status: "successful",
      metadata: {
        senderName: webhookData?.customer?.senderName || "",
        bankName: webhookData?.customer?.bankName || "",
        senderAccount: webhookData?.customer?.accountNumber || "",
      },
    });

    // Update wallet balance
    const newBalance = Number(wallet.current_balance) + amount;
    const updates = { current_balance: newBalance };

    // Auto-complete split if target reached
    if (wallet.type === "split" && wallet.target_amount && newBalance >= Number(wallet.target_amount)) {
      updates.status = "completed";

      // Auto-payout to organizer if bank details exist
      const orgBank = wallet.beneficiary_bank_details;
      if (orgBank) {
        const org = orgBank;
        try {
          await nomba.transferToBank({
            amount: newBalance,
            accountNumber: org.accountNumber,
            accountName: org.accountName,
            bankCode: org.bankCode,
            merchantTxRef: `SPLIT-PAYOUT-${wallet.id}-${Date.now()}`,
            senderName: "RemitSplit",
            narration: `Split payout for ${wallet.name}`,
          });
        } catch (payoutErr) {
          console.error("Auto-payout failed:", payoutErr.message);
        }
      }
    }

    await supabase.from("wallets").update(updates).eq("id", wallet.id);

    return res.status(200).json({ status: "processed", transactionId });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(200).json({ status: "error", message: err.message });
  }
});

// ─── Health check ───────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  return res.status(200).json({ status: "ok" });
});

// ─── Start server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`RemitSplit backend running on http://localhost:${PORT}`);
});
