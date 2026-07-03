const axios = require("axios");

let cachedToken = null;
let tokenExpiry = null;

const BASE_URL = "https://sandbox.nomba.com";

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
    console.error("Nomba auth error:", error.response?.data || error.message);
    clearAccessToken();
    throw error;
  }
}

async function withTokenRetry(action) {
  try {
    return await action();
  } catch (error) {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      clearAccessToken();
      return await action();
    }
    throw error;
  }
}

async function createVirtualAccount({ accountRef, accountName, expectedAmount, expiryDate }) {
  return withTokenRetry(async () => {
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
  return withTokenRetry(async () => {
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
  return withTokenRetry(async () => {
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
  return withTokenRetry(async () => {
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
  return withTokenRetry(async () => {
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
  return withTokenRetry(async () => {
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
  transferToBank,
  fetchExchangeRate,
  convertMoney
};