const axios = require("axios");

let cachedToken = null;
let tokenExpiry = null;

const BASE_URL = process.env.NOMBA_BASE_URL || "https://sandbox.nomba.com";

function clearAccessToken() {
  cachedToken = null;
  tokenExpiry = null;
}

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
    const detail = error.response?.data?.description || error.response?.data || error.message;
    console.error("Nomba auth error:", detail);
    clearAccessToken();
    throw new Error(`Nomba auth failed: ${detail}`);
  }
}

async function nombaRequest(action) {
  try {
    return await action();
  } catch (error) {
    const status = error.response?.status;
    if (status === 401) {
      clearAccessToken();
      return await action();
    }
    throw error;
  }
}

async function createVirtualAccount({ accountRef, accountName, expectedAmount, expiryDate }) {
  return nombaRequest(async () => {
    const token = await getAccessToken();
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
  });
}

async function fetchVirtualAccount(accountRef) {
  return nombaRequest(async () => {
    const token = await getAccessToken();
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
  });
}

async function fetchBankCodes() {
  return nombaRequest(async () => {
    const token = await getAccessToken();
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
  });
}

async function fetchExchangeRate({ from, to }) {
  return nombaRequest(async () => {
    const token = await getAccessToken();
    const response = await axios.get(
      `${BASE_URL}/v1/global-payout/exchange-rates`,
      {
        params: { from, to },
        headers: {
          "Authorization": `Bearer ${token}`,
          "accountId": process.env.NOMBA_ACCOUNT_ID
        }
      }
    );

    return response.data.data.rates;
  });
}

async function convertMoney({ amount, currency, destinationCurrency, sourceCountryIsoCode = "NG" }) {
  return nombaRequest(async () => {
    const token = await getAccessToken();
    const response = await axios.post(
      `${BASE_URL}/v1/global-payout/money/convert`,
      {
        amount,
        currency,
        destinationCurrency,
        transactionType: "EXCHANGE",
        sourceCountryIsoCode
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
  });
}

async function lookupBankAccount({ accountNumber, bankCode }) {
  return nombaRequest(async () => {
    const token = await getAccessToken();
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
  });
}

async function transferToBank({ amount, accountNumber, accountName, bankCode, merchantTxRef, senderName, narration }) {
  return nombaRequest(async () => {
    const token = await getAccessToken();
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
          "accountId": process.env.NOMBA_ACCOUNT_ID,
          "Idempotency-Key": merchantTxRef
        }
      }
    );

    return response.data.data;
  });
}

module.exports = {
  getAccessToken,
  createVirtualAccount,
  fetchVirtualAccount,
  fetchBankCodes,
  lookupBankAccount,
  transferToBank,
  fetchExchangeRate,
  convertMoney
};
