const axios = require("axios");

let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const response = await axios.post(
      "https://api.nomba.com/v1/auth/token/issue",
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
    tokenExpiry = Date.now() + (30 * 60 - 60) * 1000; // 30 min expiry, minus 1 min buffer

    return cachedToken;
  } catch (error) {
    console.error("Nomba auth error:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { getAccessToken };