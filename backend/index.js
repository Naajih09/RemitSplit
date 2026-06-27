require("dns").setDefaultResultOrder("ipv4first");
require("dotenv").config();
const express = require("express");
const app = express();

const { createVirtualAccount, getAccessToken, fetchVirtualAccount } = require("./nomba");
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