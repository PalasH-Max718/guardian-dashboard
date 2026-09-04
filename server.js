const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));

// ========================================
// 1. HEALTH
// ========================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Guardian Live",
    time: new Date().toISOString()
  });
});

// ========================================
// Helper: safe fetch JSON
// ========================================

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} from ${url} | ${raw.slice(0, 300)}`
    );
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid JSON from ${url}: ${error.message} | Raw: ${raw.slice(0, 300)}`
    );
  }
}

// ========================================
// Helper: Bybit BTC ticker
// ========================================

async function getBtcTicker() {
  const urls = [
    "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT",
    "https://api.bytick.com/v5/market/tickers?category=linear&symbol=BTCUSDT"
  ];

  let lastError = null;

  for (const url of urls) {
    try {
      const data = await fetchJson(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Guardian-Dashboard/1.0"
        }
      });

      if (data?.retCode !== 0) {
        throw new Error(
          `Bybit retCode ${data?.retCode}: ${data?.retMsg || "Unknown error"}`
        );
      }

      const ticker = data?.result?.list?.[0];

      if (!ticker) {
        throw new Error("BTCUSDT ticker missing in Bybit response");
      }

      return ticker;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to fetch BTCUSDT ticker");
}

// ========================================
// 2. BTC LIVE DATA
// ========================================

app.get("/api/btc", async (req, res) => {
  try {
    const ticker = await getBtcTicker();

    res.json({
      status: "ok",
      source: "Bybit",
      symbol: "BTCUSDT",

      price: ticker.lastPrice || null,
      markPrice: ticker.markPrice || null,
      indexPrice: ticker.indexPrice || null,

      openInterest: ticker.openInterest || null,
      openInterestValue: ticker.openInterestValue || null,

      fundingRate: ticker.fundingRate || null,
      nextFundingTime: ticker.nextFundingTime || null,

      change24h: ticker.price24hPcnt || null,
      high24h: ticker.highPrice24h || null,
      low24h: ticker.lowPrice24h || null,

      volume24h: ticker.volume24h || null,
      turnover24h: ticker.turnover24h || null,

      bid1Price: ticker.bid1Price || null,
      ask1Price: ticker.ask1Price || null,

      serverTime: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: "Unable to fetch Bybit BTC data",
      message: error.message
    });
  }
});

// ========================================
// 3. GUARDIAN BASIC
// ========================================

app.get("/api/guardian", (req, res) => {
  res.json({
    status: "ok",
    guardian: "Guardian Hidden Intention",
    framework: {
      context: "SRSLL",
      hiddenIntention: "LTESR",
      executionTimeframe: "1 Minute",
      risk: "Maximum 1% per trade",
      rule: "No Retest = No Respect"
    },
    openAIConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
});

// ========================================
// Helper: extract Responses API text
// ========================================

function extractOpenAIText(data) {
  if (data?.output_text) {
    return data.output_text;
  }

  const parts = [];

  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}

// ========================================
// 4. GUARDIAN + LIVE BTC + OPENAI
// ========================================

app.post("/api/guardian/btc", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        status: "error",
        error: "OPENAI_API_KEY is not configured in Render"
      });
    }

    const ticker = await getBtcTicker();

    const marketData = {
      source: "Bybit",
      symbol: "BTCUSDT",

      price: ticker.lastPrice || null,
      markPrice: ticker.markPrice || null,
      indexPrice: ticker.indexPrice || null,

      openInterest: ticker.openInterest || null,
      openInterestValue: ticker.openInterestValue || null,

      fundingRate: ticker.fundingRate || null,
      nextFundingTime: ticker.nextFundingTime || null,

      change24h: ticker.price24hPcnt || null,
      high24h: ticker.highPrice24h || null,
      low24h: ticker.lowPrice24h || null,

      volume24h: ticker.volume24h || null,
      turnover24h: ticker.turnover24h || null,

      bid1Price: ticker.bid1Price || null,
      ask1Price: ticker.ask1Price || null
    };

    const userContext =
      typeof req.body?.context === "string"
        ? req.body.context.trim()
        : "";

    const prompt = `
You are Guardian, a conservative crypto market analysis assistant.

Framework:

CONTEXT = SRSLL
- Session
- Regime
- Structure
- Location
- Last Liquidity Event

HIDDEN INTENTION = LTESR
- Location
- Time
- Effort
- Structure
- Response

Execution timeframe:
1 minute.

Risk rules:
- Maximum 1% risk per trade.
- SL first, then entry.
- No Retest = No Respect.
- Never claim certainty.
- Do not invent unavailable order-flow data.

Interpret Price + Open Interest:

Price UP + OI UP
= fresh participation entering.

Price UP + OI DOWN
= short covering / short squeeze / deleveraging may be contributing.

Price DOWN + OI UP
= fresh short participation may be entering.

Price DOWN + OI DOWN
= longs closing / liquidation / deleveraging may be contributing.

Funding is context only:
positive funding = longs generally paying shorts.
negative funding = shorts generally paying longs.

Important:
A single snapshot cannot prove absorption, spoofing, liquidity sweep,
acceptance, rejection, or hidden intention.

For those conclusions, require additional evidence such as:
session, structure, VWAP, heatmap liquidity, delta/CVD,
orderbook behavior, liquidation behavior and price response.

LIVE MARKET DATA:
${JSON.stringify(marketData, null, 2)}

USER CONTEXT:
${userContext || "No extra chart context supplied."}

Return a concise Guardian read using these headings:

1. Market Snapshot
2. OI + Funding Read
3. What This Does NOT Prove
4. SRSLL Context Needed
5. LTESR Hidden Intention Read
6. Long / Short / Wait Bias
7. Confirmation Needed
8. Risk Lock

If evidence is insufficient, explicitly say WAIT.
`;

    const aiData = await fetchJson(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model: "gpt-5.6-sol",
          reasoning: {
            effort: "medium"
          },
          input: prompt
        })
      }
    );

    const analysis = extractOpenAIText(aiData);

    res.json({
      status: "ok",
      service: "Guardian Live AI",
      model: "gpt-5.6-sol",
      marketData,
      analysis: analysis || "No analysis text returned.",
      time: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: "Guardian BTC analysis failed",
      message: error.message
    });
  }
});

// ========================================
// 5. FRONTEND FALLBACK
// ========================================

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Guardian Live running on port ${PORT}`);
});
