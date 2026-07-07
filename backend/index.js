require("dns").setDefaultResultOrder("ipv4first");
require("dotenv").config();
const cors = require("cors");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const REQUIRED_ENV_VARS = [
  "NOMBA_CLIENT_ID",
  "NOMBA_PRIVATE_KEY",
  "NOMBA_ACCOUNT_ID",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NOMBA_SUPABASE_SERVICE_KEY",
];

const missingVars = REQUIRED_ENV_VARS.filter((variable) => !process.env[variable]);
if (missingVars.length > 0) {
  console.error("Missing required environment variables:", missingVars.join(", "));
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);

const { createVirtualAccount, getAccessToken, fetchVirtualAccount, fetchBankCodes, lookupBankAccount, transferToBank, fetchExchangeRate, convertMoney } = require("./nomba");
const { supabase, supabaseAdmin } = require("./supabase");

const processedWebhookTransactions = new Set();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ success: false, error: "Too many requests, please try again later" });
  },
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ success: false, error: "Too many requests, please try again later" });
  },
});

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.use(generalRateLimit);

function parseJsonField(value) {
  if (!value || typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeBankDetails(details = {}) {
  const parsed = parseJsonField(details) || {};
  return {
    accountNumber: parsed.accountNumber || parsed.account_number || "",
    accountName: parsed.accountName || parsed.account_name || parsed.name || "",
    bankCode: parsed.bankCode || parsed.bank_code || "",
    bankName: parsed.bankName || parsed.bank_name || "",
  };
}

function validationError(res, error) {
  return res.status(400).json({ success: false, error });
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isPositiveNumber(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

function isTenDigitAccountNumber(value) {
  return typeof value === "string" && /^\d{10}$/.test(value.trim());
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateEmailPassword(res, email, password) {
  if (!isValidEmail(email)) {
    return validationError(res, "A valid email address is required");
  }

  if (typeof password !== "string" || password.length < 8) {
    return validationError(res, "Password must be at least 8 characters");
  }

  return null;
}

async function userCanAccessWallet(walletId, userId) {
  const { data: ownerWallet, error: ownerError } = await supabaseAdmin
    .from("wallets")
    .select("id")
    .eq("id", walletId)
    .eq("user_id", userId)
    .single();

  if (ownerWallet && !ownerError) return true;

  const { data: contributorRow, error: contributorError } = await supabaseAdmin
    .from("wallet_contributors")
    .select("id")
    .eq("wallet_id", walletId)
    .eq("user_id", userId)
    .single();

  return !!contributorRow && !contributorError;
}

async function getAccessibleWalletByName(walletName, userId) {
  const { data: ownerWallet, error: ownerError } = await supabaseAdmin
    .from("wallets")
    .select("*")
    .eq("name", walletName)
    .eq("user_id", userId)
    .single();

  if (ownerWallet && !ownerError) return ownerWallet;
  if (ownerError && ownerError.code !== "PGRST116") throw ownerError;

  const { data: possibleWallets, error: walletError } = await supabaseAdmin
    .from("wallets")
    .select("*")
    .eq("name", walletName);

  if (walletError) throw walletError;

  for (const wallet of possibleWallets || []) {
    if (await userCanAccessWallet(wallet.id, userId)) {
      return wallet;
    }
  }

  return null;
}

async function recordWalletTransaction(transaction) {
  try {
    const { error } = await supabaseAdmin
      .from("wallet_transactions")
      .insert([transaction]);

    if (error && error.code !== "42P01") {
      console.warn("Wallet transaction ledger insert skipped:", error.message);
    }
  } catch (error) {
    console.warn("Wallet transaction ledger unavailable:", error.message);
  }
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }

  req.userId = data.user.id;
  next();
}

app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
  res.json({
    name: "RemitSplit API",
    version: "1.0.0",
    status: "online",
    documentation: "https://github.com/naajih09/RemitSplit", 
    message: "Welcome to the RemitSplit backend! 🚀"
  });
});

app.post("/webhooks/nomba", async (req, res) => {
  try {
    const signature = req.headers["nomba-signature"];
    const timestamp = req.headers["nomba-timestamp"];
    const webhookSecret = process.env.NOMBA_WEBHOOK_SECRET;
    const payload = req.body;

    // For production-grade HMAC validation, prefer express.raw({ type: "application/json" })
    // so the signature is computed against the exact raw request body.
    const timestampMs = timestamp ? Date.parse(timestamp) : NaN;
    const timestampAgeSeconds = Number.isNaN(timestampMs)
      ? Infinity
      : Math.abs(Date.now() - timestampMs) / 1000;

    if (!timestamp || timestampAgeSeconds > 300) {
      console.warn("Webhook timestamp too old or missing");
      return res.status(200).json({ received: true, ignored: true });
    }

    if (!webhookSecret) {
      console.warn("NOMBA_WEBHOOK_SECRET not configured - skipping signature verification");
    } else {
      const sigEventType = payload?.event_type || "";
      const requestId = payload?.requestId || "";
      const userId = payload?.data?.merchant?.userId || "";
      const walletId = payload?.data?.merchant?.walletId || "";
      const transactionId = payload?.data?.transaction?.transactionId || "";
      const transactionType = payload?.data?.transaction?.type || "";
      const time = payload?.data?.transaction?.time || "";
      const responseCode = payload?.data?.transaction?.responseCode;
      const normalizedResponseCode = responseCode === null || responseCode === undefined ? "" : String(responseCode);
      const signString = `${sigEventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${time}:${normalizedResponseCode}:${timestamp}`;
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(signString)
        .digest("base64");

      if (!signature || expectedSignature.toLowerCase() !== String(signature).toLowerCase()) {
        console.warn("Webhook signature mismatch - ignoring");
        return res.status(200).json({ received: true });
      }
    }

    const eventType = payload?.event_type;
    if (eventType !== "payment_success") {
      console.log(`Ignoring unsupported event type: ${eventType}`);
      return res.status(200).json({ received: true });
    }

    const accountRef = payload?.data?.transaction?.aliasAccountReference;
    const amountPaid = payload?.data?.transaction?.transactionAmount;
    const transactionId = payload?.data?.transaction?.transactionId || payload?.requestId;
    const numericAmountPaid = typeof amountPaid === "string" ? parseFloat(amountPaid) : amountPaid;

    if (transactionId && processedWebhookTransactions.has(transactionId)) {
      console.log(`Duplicate webhook transaction ignored: ${transactionId}`);
      return res.status(200).json({ received: true, duplicate: true });
    }

    if (accountRef && !Number.isNaN(numericAmountPaid)) {
      if (!supabaseAdmin || typeof supabaseAdmin.from !== "function") {
        throw new Error("supabaseAdmin client is unavailable or invalid");
      }

      const { data: wallet, error: fetchError } = await supabaseAdmin
        .from("wallets")
        .select("id, current_balance, name, type, target_amount, status, beneficiary_bank_details")
        .eq("account_ref", accountRef)
        .single();

      if (fetchError) {
        console.error("Supabase fetch wallet error:", fetchError);
      } else if (wallet) {
        const updatedBalance = Number(wallet.current_balance || 0) + Number(numericAmountPaid);
        const { error: updateError } = await supabaseAdmin
          .from("wallets")
          .update({ current_balance: updatedBalance })
          .eq("id", wallet.id);

        if (updateError) {
          console.error("Supabase update wallet error:", updateError);
        } else {
          if (transactionId) processedWebhookTransactions.add(transactionId);

          await recordWalletTransaction({
            wallet_id: wallet.id,
            type: "credit",
            amount: Number(numericAmountPaid),
            currency: "NGN",
            provider: "nomba",
            provider_transaction_id: transactionId,
            status: "successful",
            metadata: payload,
          });

          // If this is a split wallet and the target is reached, attempt auto-payout
          try {
            const targetAmount = Number(wallet.target_amount || 0);
            if (wallet.type === "split" && updatedBalance >= targetAmount) {
              if (wallet.status === "completed") {
                console.log(`Split ${wallet.name} already completed, skipping duplicate payout`);
              } else {
                const beneficiary = normalizeBankDetails(wallet.beneficiary_bank_details);

                if (!beneficiary || !beneficiary.accountNumber || !beneficiary.bankCode || !beneficiary.accountName) {
                  console.error(`Cannot auto-payout split ${wallet.name}: missing beneficiary bank details`);
                } else {
                  try {
                    const merchantTxRef = `split-payout-${wallet.id}-${transactionId || Date.now()}`;
                    const transferResult = await transferToBank({
                      amount: updatedBalance,
                      accountNumber: beneficiary.accountNumber,
                      accountName: beneficiary.accountName,
                      bankCode: beneficiary.bankCode,
                      merchantTxRef,
                      senderName: "RemitSplit",
                      narration: `Split payout for ${wallet.name}`
                    });

                    // On success, mark wallet as completed
                    const { error: statusUpdateError } = await supabaseAdmin
                      .from("wallets")
                      .update({ status: "completed" })
                      .eq("id", wallet.id);

                    if (statusUpdateError) {
                      console.error(`Failed to update status to completed for ${wallet.name}:`, statusUpdateError);
                    } else {
                      await recordWalletTransaction({
                        wallet_id: wallet.id,
                        type: "debit",
                        amount: updatedBalance,
                        currency: "NGN",
                        provider: "nomba",
                        provider_transaction_id: merchantTxRef,
                        status: "successful",
                        metadata: transferResult,
                      });
                      console.log(`Split auto-payout successful for ${wallet.name}`, { transferResult });
                    }
                  } catch (payoutErr) {
                    console.error(`Split auto-payout failed for ${wallet.name}:`, payoutErr.response?.data || payoutErr.message || payoutErr);
                  }
                }
              }
            }
          } catch (err) {
            console.error(`Error handling split payout for ${wallet.name}:`, err);
          }
        }
      } else {
        console.log(`No wallet found for account_ref=${accountRef}`);
      }
    } else {
      console.log("Webhook missing accountRef or amount:", { accountRef, numericAmountPaid });
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
  }

  res.status(200).json({ received: true });
});

app.post("/auth/signup", authRateLimit, async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    const validation = validateEmailPassword(res, email, password);
    if (validation) return validation;
    if (!isNonEmptyString(fullName)) {
      return validationError(res, "Full name is required");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({ success: true, user: data.user, session: data.session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/auth/login", authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    const validation = validateEmailPassword(res, email, password);
    if (validation) return validation;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ success: false, error: error.message });
    }

    res.json({ success: true, user: data.user, session: data.session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/auth/refresh", authRateLimit, async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!isNonEmptyString(refresh_token)) {
      return validationError(res, "Refresh token is required");
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error || !data.session) {
      return res.status(401).json({ success: false, error: error?.message || "Invalid or expired token" });
    }

    res.json({ success: true, user: data.user, session: data.session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/wallets", requireAuth, async (req, res) => {
  try {
    const { name, type, target_amount, contributors_count, beneficiary_bank_details, organizer_bank_details, deadline } = req.body;
    if (!isNonEmptyString(name)) {
      return validationError(res, "Wallet name is required");
    }

    if (name.trim().length > 100) {
      return validationError(res, "Wallet name must be 100 characters or fewer");
    }

    if (type !== "wallet" && type !== "split") {
      return validationError(res, "Wallet type must be either wallet or split");
    }

    if (target_amount !== null && target_amount !== undefined && !isPositiveNumber(target_amount)) {
      return validationError(res, "Target amount must be a positive number");
    }

    if (beneficiary_bank_details !== null && beneficiary_bank_details !== undefined && !isPlainObject(beneficiary_bank_details)) {
      return validationError(res, "Beneficiary bank details must be an object");
    }

    const walletType = type === "split" ? "split" : "remit";
    const contributorsCount = Number(contributors_count || 1);

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Wallet name is required" });
    }

    if (walletType === "split") {
      if (!target_amount || Number(target_amount) <= 0) {
        return res.status(400).json({ success: false, error: "Target amount is required for split wallets" });
      }

      if (!Number.isInteger(contributorsCount) || contributorsCount < 1) {
        return res.status(400).json({ success: false, error: "Contributors count must be at least 1" });
      }

      const organizerBankDetails = normalizeBankDetails(organizer_bank_details);
      if (!organizerBankDetails.accountNumber || !organizerBankDetails.accountName || !organizerBankDetails.bankCode) {
        return res.status(400).json({ success: false, error: "Organizer account name, account number, and bank code are required for split payouts" });
      }
    }

    if (walletType === "remit") {
      if (!beneficiary_bank_details || !beneficiary_bank_details.name || !beneficiary_bank_details.account_number) {
        return res.status(400).json({ success: false, error: "Beneficiary name and account number are required for remit wallets" });
      }
    }

    const { data: existingWallet, error: fetchError } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("name", name)
      .eq("type", walletType)
      .eq("user_id", req.userId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Supabase fetch existing wallet error:", fetchError);
      return res.status(500).json({ success: false, error: fetchError.message });
    }

    if (existingWallet) {
      console.log(`Reusing existing wallet for name=${name} type=${walletType}`);
      return res.json({ success: true, wallet: existingWallet, reused: true });
    }

    const accountRef = `${walletType === "split" ? "split" : "wallet"}-${Date.now()}`;
    const expectedAmount = walletType === "split"
      ? (Number(target_amount) / contributorsCount).toFixed(2)
      : "0.00";
    const accountPayload = {
      accountRef,
      accountName: name || accountRef,
      expectedAmount
    };

    if (walletType === "split") {
      const expiryDate = deadline ? new Date(deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      accountPayload.expiryDate = expiryDate.toISOString().slice(0, 19).replace("T", " ");
    }

    const virtualAccount = await createVirtualAccount(accountPayload);

    const payoutDetails = walletType === "remit"
      ? {
          name: beneficiary_bank_details.name,
          account_number: beneficiary_bank_details.account_number,
        }
      : normalizeBankDetails(organizer_bank_details);

    const { data: wallet, error: insertError } = await supabaseAdmin
      .from("wallets")
      .insert([
        {
          account_ref: accountRef,
          name,
          type: walletType,
          target_amount: walletType === "split" ? Number(target_amount) : null,
          current_balance: 0,
          beneficiary_bank_details: payoutDetails,
          status: "active",
          user_id: req.userId
        }
      ])
      .select("*")
      .single();

    if (insertError) {
      console.error("Supabase insert wallet error:", insertError);
      return res.status(500).json({ success: false, error: insertError.message });
    }

    res.json({ success: true, wallet, virtualAccount, reused: false });
  } catch (error) {
    console.error("Create wallet error:", error);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.get("/wallets", requireAuth, async (req, res) => {
  try {
    const { data: ownedWallets, error: ownedError } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (ownedError) {
      console.error("Supabase fetch owned wallets error:", ownedError);
      return res.status(500).json({ success: false, error: ownedError.message });
    }

    const { data: contributorRows, error: contributorError } = await supabaseAdmin
      .from("wallet_contributors")
      .select("wallet_id")
      .eq("user_id", req.userId);

    if (contributorError && contributorError.code !== "42P01") {
      console.error("Supabase fetch contributor wallets error:", contributorError);
      return res.status(500).json({ success: false, error: contributorError.message });
    }

    const contributorWalletIds = [...new Set((contributorRows || []).map((row) => row.wallet_id).filter(Boolean))];
    let sharedWallets = [];

    if (contributorWalletIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .in("id", contributorWalletIds);

      if (error) {
        console.error("Supabase fetch shared wallets error:", error);
        return res.status(500).json({ success: false, error: error.message });
      }

      sharedWallets = data || [];
    }

    res.json({ success: true, wallets: [...(ownedWallets || []), ...sharedWallets] });
  } catch (error) {
    console.error("List wallets error:", error);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.get("/banks", async (req, res) => {
  try {
    const banks = await fetchBankCodes();
    res.json({ success: true, banks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.get("/exchange-rate", async (req, res) => {
  try {
    const { from, to } = req.query;
    const rates = await fetchExchangeRate({ from, to });
    res.json({ success: true, rates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.post("/convert", async (req, res) => {
  try {
    const { amount, currency, destinationCurrency } = req.body;
    if (!isPositiveNumber(amount)) {
      return validationError(res, "Amount must be a positive number");
    }

    if (!isNonEmptyString(currency)) {
      return validationError(res, "Currency is required");
    }

    if (!isNonEmptyString(destinationCurrency)) {
      return validationError(res, "Destination currency is required");
    }

    const conversion = await convertMoney({ amount, currency, destinationCurrency });
    res.json({ success: true, conversion });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.post("/verify-account", async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;
    if (!isTenDigitAccountNumber(accountNumber)) {
      return validationError(res, "Account number must be exactly 10 digits");
    }

    if (!isNonEmptyString(bankCode)) {
      return validationError(res, "Bank code is required");
    }

    const account = await lookupBankAccount({ accountNumber, bankCode });
    res.json({ success: true, account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.post("/withdraw", requireAuth, async (req, res) => {
  try {
    const { walletName, amount, accountNumber, accountName, bankCode } = req.body;
    if (!isNonEmptyString(walletName)) {
      return validationError(res, "Wallet name is required");
    }

    if (!isPositiveNumber(amount)) {
      return validationError(res, "Amount must be a positive number");
    }

    if (!isTenDigitAccountNumber(accountNumber)) {
      return validationError(res, "Account number must be exactly 10 digits");
    }

    if (!isNonEmptyString(bankCode)) {
      return validationError(res, "Bank code is required");
    }

    const { data: wallet, error: fetchError } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("name", walletName)
      .eq("user_id", req.userId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return res.status(404).json({ success: false, error: "Wallet not found or withdrawal access denied" });
      }

      console.error("Supabase fetch wallet for withdrawal error:", fetchError);
      return res.status(500).json({ success: false, error: fetchError.message });
    }

    const parsedAmount = Number(amount);
    const currentBalance = Number(wallet.current_balance || 0);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, error: "Invalid amount" });
    }

    if (parsedAmount > currentBalance) {
      return res.status(400).json({ success: false, error: "Insufficient balance" });
    }

    if (!accountNumber || !accountName || !bankCode) {
      return res.status(400).json({ success: false, error: "Account number, account name, and bank code are required" });
    }

    const verifiedAccount = await lookupBankAccount({ accountNumber, bankCode });
    const verifiedName = verifiedAccount?.accountName || verifiedAccount?.account_name || accountName;
    const merchantTxRef = `withdraw-${wallet.id}-${Date.now()}`;
    const transferResult = await transferToBank({
      amount: parsedAmount,
      accountNumber,
      accountName: verifiedName,
      bankCode,
      merchantTxRef,
      senderName: "RemitSplit",
      narration: `Withdrawal from ${walletName}`
    });

    const updatedBalance = currentBalance - parsedAmount;
    const { error: updateError } = await supabaseAdmin
      .from("wallets")
      .update({ current_balance: updatedBalance })
      .eq("id", wallet.id);

    if (updateError) {
      console.error("Supabase update wallet balance error:", updateError);
      return res.status(500).json({ success: false, error: updateError.message });
    }

    await recordWalletTransaction({
      wallet_id: wallet.id,
      type: "debit",
      amount: parsedAmount,
      currency: "NGN",
      provider: "nomba",
      provider_transaction_id: merchantTxRef,
      status: "successful",
      metadata: transferResult,
    });

    res.json({ success: true, transfer: transferResult, newBalance: updatedBalance });
  } catch (error) {
    console.error("Withdrawal error:", error);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.post("/contribute/quote", requireAuth, async (req, res) => {
  try {
    const { walletName, amount, currency } = req.body;
    const allowedCurrencies = ["GBP", "EUR", "CAD", "USD"];

    if (!isNonEmptyString(walletName)) {
      return validationError(res, "Wallet name is required");
    }

    if (!isPositiveNumber(amount)) {
      return validationError(res, "Amount must be a positive number");
    }

    if (!allowedCurrencies.includes(currency)) {
      return validationError(res, "Currency must be one of GBP, EUR, CAD, USD");
    }

    let wallet;
    try {
      wallet = await getAccessibleWalletByName(walletName, req.userId);
    } catch (fetchError) {
      console.error("Supabase fetch wallet for quote error:", fetchError);
      return res.status(500).json({ success: false, error: fetchError.message });
    }

    if (!wallet) {
      return res.status(404).json({ success: false, error: "Wallet not found" });
    }

    const conversion = await convertMoney({
      amount,
      currency,
      destinationCurrency: "NGN"
    });

    res.json({
      success: true,
      wallet: { name: wallet.name, account_ref: wallet.account_ref },
      quote: conversion
    });
  } catch (error) {
    console.error("Contribute quote error:", error);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.post("/wallets/:walletId/contributors", requireAuth, async (req, res) => {
  try {
    const { contributorUserId } = req.body;
    const walletId = req.params.walletId;
    if (!isNonEmptyString(contributorUserId)) {
      return validationError(res, "Contributor user ID is required");
    }

    const { data: wallet, error: ownerError } = await supabaseAdmin
      .from("wallets")
      .select("id")
      .eq("id", walletId)
      .eq("user_id", req.userId)
      .single();

    if (ownerError || !wallet) {
      return res.status(403).json({ success: false, error: "Only the wallet owner can add contributors" });
    }

    const { data: contributor, error: insertError } = await supabaseAdmin
      .from("wallet_contributors")
      .insert([
        {
          wallet_id: walletId,
          user_id: contributorUserId,
          added_by: req.userId
        }
      ])
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return res.status(200).json({ success: true, message: "Contributor already has access" });
      }

      console.error("Supabase insert contributor error:", insertError);
      return res.status(500).json({ success: false, error: insertError.message });
    }

    res.json({ success: true, contributor });
  } catch (error) {
    console.error("Add contributor error:", error);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.get("/wallets/:walletId/balance", requireAuth, async (req, res) => {
  try {
    const walletId = req.params.walletId;

    if (!(await userCanAccessWallet(walletId, req.userId))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const { data: wallet, error } = await supabaseAdmin
      .from("wallets")
      .select("id, account_ref, name, type, current_balance, target_amount, status, beneficiary_bank_details")
      .eq("id", walletId)
      .single();

    if (error || !wallet) {
      return res.status(404).json({ success: false, error: "Wallet not found or access denied" });
    }

    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        account_ref: wallet.account_ref,
        name: wallet.name,
        type: wallet.type,
        current_balance: wallet.current_balance,
        target_amount: wallet.target_amount,
        status: wallet.status,
        beneficiary_bank_details: wallet.beneficiary_bank_details,
      }
    });
  } catch (error) {
    console.error("Fetch wallet balance error:", error);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.get("/wallets/:walletId/contributors", requireAuth, async (req, res) => {
  try {
    const walletId = req.params.walletId;

    const { data: ownerWallet, error: ownerError } = await supabaseAdmin
      .from("wallets")
      .select("id")
      .eq("id", walletId)
      .eq("user_id", req.userId)
      .single();

    let authorized = !!ownerWallet && !ownerError;

    if (!authorized) {
      const { data: contributorRow, error: contributorError } = await supabaseAdmin
        .from("wallet_contributors")
        .select("id")
        .eq("wallet_id", walletId)
        .eq("user_id", req.userId)
        .single();

      authorized = !!contributorRow && !contributorError;
    }

    if (!authorized) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const { data: contributors, error } = await supabaseAdmin
      .from("wallet_contributors")
      .select("*")
      .eq("wallet_id", walletId);

    if (error) {
      console.error("Fetch wallet contributors error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, contributors });
  } catch (error) {
    console.error("Wallet contributors error:", error);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.get("/wallets/:walletId/transactions", requireAuth, async (req, res) => {
  try {
    const walletId = req.params.walletId;

    if (!(await userCanAccessWallet(walletId, req.userId))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const { data: transactions, error } = await supabaseAdmin
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", walletId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      if (error.code === "42P01") {
        return res.json({ success: true, transactions: [] });
      }

      console.error("Fetch wallet transactions error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, transactions: transactions || [] });
  } catch (error) {
    console.error("Wallet transactions error:", error);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.get("/public/split/:accountRef", async (req, res) => {
  try {
    const accountRef = req.params.accountRef;
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("id, name, type, target_amount, current_balance, status")
      .eq("account_ref", accountRef)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ success: false, error: "Split payment page not found" });
    }

    if (wallet.type !== "split") {
      return res.status(404).json({ success: false, error: "Split payment page not found" });
    }

    const account = await fetchVirtualAccount(accountRef);

    res.json({
      success: true,
      payment: {
        accountRef,
        accountName: account.accountName || wallet.name,
        expectedAmount: account.expectedAmount ?? String(wallet.target_amount || "0.00"),
        expiryDate: account.expiryDate || null,
        accountNumber: account.bankAccountNumber || account.accountNumber || null,
      },
      wallet: {
        id: wallet.id,
        name: wallet.name,
        current_balance: wallet.current_balance,
        target_amount: wallet.target_amount,
        status: wallet.status,
      },
    });
  } catch (error) {
    console.error("Fetch split payment details error:", error);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
const nombaMode = process.env.NOMBA_BASE_URL === "https://api.nomba.com" ? "live" : "sandbox";
console.log(`Using Nomba base URL: ${process.env.NOMBA_BASE_URL || "https://sandbox.nomba.com"} (${nombaMode})`);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
