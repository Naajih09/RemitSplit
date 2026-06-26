require("dotenv").config();
const express = require("express");
const app = express();

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