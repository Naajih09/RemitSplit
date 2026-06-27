const axios = require("axios");

let cachedToken = null;
let tokenExpiry = null;

const BASE_URL = "https://sandbox.nomba.com";

async function getAccessToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/v1/auth/token/issue`,
      {
        grant_type: "client_credentials",
        client_id: process.env.NOMBA_CLIENT_ID,
        client_secret: process.env.NOMBA_PRIVATE_KEY
      },
      {
        headers: {
          "Content-Type": "application/json",
          "accountId": process.env.NOMBA_ACCOUNT_ID
        }
      }
    );

    cachedToken = response.data.data.access_token;
    tokenExpiry = Date.now() + (30 * 60 - 60) * 1000;

    return cachedToken;
  } catch (error) {
    console.error("Nomba auth error:", error.response?.data || error.message);
    throw error;
  }
}

async function createVirtualAccount({ accountRef, accountName, expectedAmount, expiryDate }) {
  const token = await getAccessToken();

  try {
    const response = await axios.post(
      `${BASE_URL}/v1/accounts/virtual`,
      {
        accountRef,
        accountName,
        expectedAmount,
        expiryDate
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "accountId": process.env.NOMBA_ACCOUNT_ID
        }
      }
    );

    return response.data.data;
  } catch (error) {
    console.error("Create virtual account error:", error.response?.data || error.message);
    throw error;
  }
}

async function fetchVirtualAccount(accountRef) {
  const token = await getAccessToken();

  try {
    const response = await axios.get(
      `${BASE_URL}/v1/accounts/virtual/${accountRef}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "accountId": process.env.NOMBA_ACCOUNT_ID
        }
      }
    );

    return response.data.data;
  } catch (error) {
    console.error("Fetch virtual account error:", error.response?.data || error.message);
    throw error;
  }
}

async function fetchBankCodes() {
  const token = await getAccessToken();

  try {
    const response = await axios.get(
      `${BASE_URL}/v1/transfers/banks`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "accountId": process.env.NOMBA_ACCOUNT_ID
        }
      }
    );

    return response.data.data;
  } catch (error) {
    console.error("Fetch bank codes error:", error.response?.data || error.message);
    throw error;
  }
}

async function lookupBankAccount({ accountNumber, bankCode }) {
  const token = await getAccessToken();

  try {
    const response = await axios.post(
      `${BASE_URL}/v1/transfers/bank/lookup`,
      {
        accountNumber,
        bankCode
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "accountId": process.env.NOMBA_ACCOUNT_ID
        }
      }
    );

    return response.data.data;
  } catch (error) {
    console.error("Lookup bank account error:", error.response?.data || error.message);
    throw error;
  }
}

async function transferToBank({ amount, accountNumber, accountName, bankCode, merchantTxRef, senderName, narration }) {
  const token = await getAccessToken();

  try {
    const response = await axios.post(
      `${BASE_URL}/v2/transfers/bank`,
      {
        amount,
        accountNumber,
        accountName,
        bankCode,
        merchantTxRef,
        senderName,
        narration
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "accountId": process.env.NOMBA_ACCOUNT_ID
        }
      }
    );

    return response.data.data;
  } catch (error) {
    console.error("Transfer to bank error:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  getAccessToken,
  createVirtualAccount,
  fetchVirtualAccount,
  fetchBankCodes,
  lookupBankAccount,
  transferToBank
};