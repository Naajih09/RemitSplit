require("dns").setDefaultResultOrder("ipv4first");
require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const app = express();

const { createVirtualAccount, getAccessToken, fetchVirtualAccount, fetchBankCodes, lookupBankAccount, transferToBank, fetchExchangeRate, convertMoney } = require("./nomba");
const supabase = require("./supabase");

app.use(express.json());

app.get("/", (req, res) => {
  res.send("RemitSplit backend is live 🚀");
});

app.post("/webhooks/nomba", async (req, res) => {
  try {
    const signature = req.headers["nomba-signature"];
    const timestamp = req.headers["nomba-timestamp"];
    const webhookSecret = process.env.NOMBA_WEBHOOK_SECRET;
    const payload = req.body;

    if (!webhookSecret) {
      console.warn("NOMBA_WEBHOOK_SECRET not configured - skipping signature verification");
    } else {
      const eventType = payload?.event_type || "";
      const requestId = payload?.requestId || "";
      const userId = payload?.data?.merchant?.userId || "";
      const walletId = payload?.data?.merchant?.walletId || "";
      const transactionId = payload?.data?.transaction?.transactionId || "";
      const transactionType = payload?.data?.transaction?.type || "";
      const time = payload?.data?.transaction?.time || "";
      const responseCode = payload?.data?.transaction?.responseCode;
      const normalizedResponseCode = responseCode === null || responseCode === undefined ? "" : String(responseCode);
      const signString = `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${time}:${normalizedResponseCode}:${timestamp}`;
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
    const numericAmountPaid = typeof amountPaid === "string" ? parseFloat(amountPaid) : amountPaid;

    if (accountRef && !Number.isNaN(numericAmountPaid)) {
      const { data: wallet, error: fetchError } = await supabase
        .from("wallets")
        .select("id, current_balance, name, type, target_amount, status, beneficiary_bank_details")
        .eq("account_ref", accountRef)
        .single();

      if (fetchError) {
        console.error("Supabase fetch wallet error:", fetchError);
      } else if (wallet) {
        const updatedBalance = Number(wallet.current_balance || 0) + Number(numericAmountPaid);
        const { error: updateError } = await supabase
          .from("wallets")
          .update({ current_balance: updatedBalance })
          .eq("id", wallet.id);

        if (updateError) {
          console.error("Supabase update wallet error:", updateError);
        } else {
          // If this is a split wallet and the target is reached, attempt auto-payout
          try {
            const targetAmount = Number(wallet.target_amount || 0);
            if (wallet.type === "split" && updatedBalance >= targetAmount) {
              if (wallet.status === "completed") {
                console.log(`Split ${wallet.name} already completed, skipping duplicate payout`);
              } else {
                // Parse beneficiary details which may be returned as object or string
                let beneficiary = wallet.beneficiary_bank_details;
                try {
                  if (typeof beneficiary === "string" && beneficiary.trim() !== "") {
                    beneficiary = JSON.parse(beneficiary);
                  }
                } catch (parseErr) {
                  console.error(`Cannot parse beneficiary_bank_details for ${wallet.name}:`, parseErr.message || parseErr);
                  beneficiary = null;
                }

                if (!beneficiary || !beneficiary.accountNumber || !beneficiary.bankCode || !beneficiary.accountName) {
                  console.error(`Cannot auto-payout split ${wallet.name}: missing beneficiary bank details`);
                } else {
                  try {
                    const merchantTxRef = `split-payout-${wallet.id}-${Date.now()}`;
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
                    const { error: statusUpdateError } = await supabase
                      .from("wallets")
                      .update({ status: "completed" })
                      .eq("id", wallet.id);

                    if (statusUpdateError) {
                      console.error(`Failed to update status to completed for ${wallet.name}:`, statusUpdateError);
                    } else {
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

app.get("/test-auth", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/wallets", async (req, res) => {
  try {
    const { name, type, target_amount, beneficiary_bank_details } = req.body;

    if (name) {
      const { data: existingWallet, error: fetchError } = await supabase
        .from("wallets")
        .select("*")
        .eq("name", name)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Supabase fetch existing wallet error:", fetchError);
        return res.status(500).json({ success: false, error: fetchError.message });
      }

      if (existingWallet) {
        console.log(`Reusing existing wallet for name=${name}`);
        return res.json({ success: true, wallet: existingWallet, reused: true });
      }
    }

    const accountRef = `${type === "split" ? "split" : "wallet"}-${Date.now()}`;
    const expectedAmount = target_amount ? String(target_amount) : "0.00";
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    const virtualAccount = await createVirtualAccount({
      accountRef,
      accountName: name || accountRef,
      expectedAmount,
      expiryDate
    });

    const { data: wallet, error: insertError } = await supabase
      .from("wallets")
      .insert([
        {
          account_ref: accountRef,
          name,
          type,
          target_amount,
          current_balance: 0,
          beneficiary_bank_details,
          status: "active"
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
    const conversion = await convertMoney({ amount, currency, destinationCurrency });
    res.json({ success: true, conversion });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.post("/verify-account", async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;
    const account = await lookupBankAccount({ accountNumber, bankCode });
    res.json({ success: true, account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.post("/withdraw", async (req, res) => {
  try {
    const { walletName, amount, accountNumber, accountName, bankCode } = req.body;

    const { data: wallet, error: fetchError } = await supabase
      .from("wallets")
      .select("*")
      .eq("name", walletName)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return res.status(404).json({ success: false, error: "Wallet not found" });
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

    const merchantTxRef = `withdraw-${Date.now()}`;
    const transferResult = await transferToBank({
      amount: parsedAmount,
      accountNumber,
      accountName,
      bankCode,
      merchantTxRef,
      senderName: "RemitSplit",
      narration: `Withdrawal from ${walletName}`
    });

    const updatedBalance = currentBalance - parsedAmount;
    const { error: updateError } = await supabase
      .from("wallets")
      .update({ current_balance: updatedBalance })
      .eq("id", wallet.id);

    if (updateError) {
      console.error("Supabase update wallet balance error:", updateError);
      return res.status(500).json({ success: false, error: updateError.message });
    }

    res.json({ success: true, transfer: transferResult, newBalance: updatedBalance });
  } catch (error) {
    console.error("Withdrawal error:", error);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.post("/contribute/quote", async (req, res) => {
  try {
    const { walletName, amount, currency } = req.body;

    const { data: wallet, error: fetchError } = await supabase
      .from("wallets")
      .select("*")
      .eq("name", walletName)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return res.status(404).json({ success: false, error: "Wallet not found" });
      }

      console.error("Supabase fetch wallet for quote error:", fetchError);
      return res.status(500).json({ success: false, error: fetchError.message });
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

app.post("/test-create-split", async (req, res) => {
  try {
    const account = await createVirtualAccount({
      accountRef: `split-${Date.now()}`,
      accountName: "Test Eid Contribution",
      expectedAmount: "5000.00",
      expiryDate: "2026-08-01 23:59:00"
    });

    res.json({ success: true, account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.get("/test-fetch-account/:accountRef", async (req, res) => {
  try {
    const account = await fetchVirtualAccount(req.params.accountRef);
    res.json({ success: true, account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});