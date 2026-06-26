require("dotenv").config();
const express = require("express");
const app = express();

const { getAccessToken } = require("./nomba");

app.get("/test-auth", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use(express.json());

app.get("/", (req, res) => {
  res.send("RemitSplit backend is live 🚀");
});

app.post("/webhooks/nomba", (req, res) => {
  console.log("Webhook received:", req.body);
  res.status(200).json({ received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});