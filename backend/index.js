require("dns").setDefaultResultOrder("ipv4first");
require("dotenv").config();
const express = require("express");
const app = express();

const { createVirtualAccount, getAccessToken, fetchVirtualAccount, fetchBankCodes, lookupBankAccount, transferToBank, fetchExchangeRate, convertMoney } = require("./nomba");
const supabase = require("./supabase");

app.use(express.json());

app.get("/", (req, res) => {
  res.send("RemitSplit backend is live 🚀");
});

app.post("/webhooks/nomba", async (req, res) => {
  console.log("Webhook received:", req.body);

  try {
    const accountRef = req.body?.data?.accountRef || req.body?.accountRef;
    const amountValue = req.body?.data?.amount || req.body?.amount;
    const amountPaid = typeof amountValue === "string" ? parseFloat(amountValue) : amountValue;

    if (accountRef && !Number.isNaN(amountPaid)) {
      const { data: wallet, error: fetchError } = await supabase
        .from("wallets")
        .select("id, current_balance")
        .eq("account_ref", accountRef)
        .single();

      if (fetchError) {
        console.error("Supabase fetch wallet error:", fetchError);
      } else if (wallet) {
        const updatedBalance = Number(wallet.current_balance || 0) + Number(amountPaid);
        const { error: updateError } = await supabase
          .from("wallets")
          .update({ current_balance: updatedBalance })
          .eq("id", wallet.id);

        if (updateError) {
          console.error("Supabase update wallet error:", updateError);
        }
      } else {
        console.log(`No wallet found for account_ref=${accountRef}`);
      }
    } else {
      console.log("Webhook missing accountRef or amount:", { accountRef, amountPaid });
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