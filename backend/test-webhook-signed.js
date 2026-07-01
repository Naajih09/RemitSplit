const crypto = require("crypto");

const WEBHOOK_SECRET = "NombaHackathon2026";

const eventType = "payment_success";
const requestId = "signed-test-" + Date.now();
const userId = "test-user-id";
const walletId = "test-wallet-id";
const transactionId = "signed-txn-" + Date.now();
const transactionType = "vact_transfer";
const time = new Date().toISOString();
const responseCode = "";
const nombaTimestamp = new Date().toISOString();

const signString = `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${time}:${responseCode}:${nombaTimestamp}`;

const signature = crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(signString)
  .digest("base64");

const payload = {
  event_type: eventType,
  requestId: requestId,
  data: {
    merchant: {
      walletId: walletId,
      walletBalance: 1000,
      userId: userId
    },
    transaction: {
      aliasAccountNumber: "9900012345",
      aliasAccountReference: "manual-test-001",
      transactionAmount: 250,
      transactionId: transactionId,
      type: transactionType,
      time: time,
      responseCode: responseCode
    },
    customer: {
      senderName: "Signed Test Sender",
      bankName: "Test Bank",
      accountNumber: "1234567890"
    }
  }
};

async function sendTest() {
  try {
    const response = await fetch("http://localhost:3000/webhooks/nomba", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "nomba-signature": signature,
        "nomba-timestamp": nombaTimestamp
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Signature used:", signature);
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Request failed:", error.message);
  }
}

sendTest();