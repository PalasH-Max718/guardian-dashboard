const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Guardian Live",
    time: new Date().toISOString()
  });
});

app.get("/api/btc", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT"
    );

    const data = await response.json();
    const ticker = data?.result?.list?.[0];

    res.json({
      source: "Bybit",
      symbol: "BTCUSDT",
      price: ticker?.lastPrice || null,
      markPrice: ticker?.markPrice || null,
      change24h: ticker?.price24hPcnt || null,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Unable to fetch Bybit BTC data",
      message: error.message
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Guardian Live running on port ${PORT}`);
});
