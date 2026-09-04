const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));


// ==================================================
// SAFE JSON FETCH
// ==================================================

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} from ${url} | ${raw.slice(0, 250)}`
    );
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid JSON from ${url} | ${raw.slice(0, 250)}`
    );
  }
}


// ==================================================
// HEALTH
// ==================================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Guardian Live",
    coinglassConfigured: Boolean(process.env.COINGLASS_API_KEY),
    openAIConfigured: Boolean(process.env.OPENAI_API_KEY),
    time: new Date().toISOString()
  });
});


// ==================================================
// COINGLASS BTC
// ==================================================

async function getCoinGlassBTC() {
  if (!process.env.COINGLASS_API_KEY) {
    throw new Error("COINGLASS_API_KEY not configured");
  }

  const data = await fetchJson(
    "https://open-api-v4.coinglass.com/api/futures/coins-markets",
    {
      headers: {
        Accept: "application/json",
        "CG-API-KEY": process.env.COINGLASS_API_KEY
      }
    }
  );

  if (String(data?.code) !== "0") {
    throw new Error(
      `CoinGlass error: ${data?.msg || "Unknown error"}`
    );
  }

  const btc = data?.data?.find(
    (item) => item?.symbol === "BTC"
  );

  if (!btc) {
    throw new Error("BTC not found in CoinGlass response");
  }

  return {
    source: "CoinGlass",
    symbol: "BTC",

    price: btc.current_price ?? null,

    openInterestUsd:
      btc.open_interest_usd ?? null,

    openInterestQuantity:
      btc.open_interest_quantity ?? null,

    fundingRateOI:
      btc.avg_funding_rate_by_oi ?? null,

    fundingRateVolume:
      btc.avg_funding_rate_by_vol ?? null,

    openInterestMarketCapRatio:
      btc.open_interest_market_cap_ratio ?? null,

    openInterestVolumeRatio:
      btc.open_interest_volume_ratio ?? null,

    marketCapUsd:
      btc.market_cap_usd ?? null
  };
}


// ==================================================
// BYBIT FALLBACK
// ==================================================

async function getBybitBTC() {
  const urls = [
    "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT",
    "https://api.bytick.com/v5/market/tickers?category=linear&symbol=BTCUSDT"
  ];

  let lastError;

  for (const url of urls) {
    try {
      const data = await fetchJson(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Guardian-Dashboard/1.0"
        }
      });

      if (data?.retCode !== 0) {
        throw new Error(data?.retMsg || "Bybit API error");
      }

      const ticker = data?.result?.list?.[0];

      if (!ticker) {
        throw new Error("BTCUSDT ticker missing");
      }

      return {
        source: "Bybit",
        symbol: "BTCUSDT",

        price: ticker.lastPrice ?? null,
        markPrice: ticker.markPrice ?? null,
        indexPrice: ticker.indexPrice ?? null,

        openInterestQuantity:
          ticker.openInterest ?? null,

        openInterestUsd:
          ticker.openInterestValue ?? null,

        fundingRateOI:
          ticker.fundingRate ?? null,

        volume24h:
          ticker.volume24h ?? null,

        turnover24h:
          ticker.turnover24h ?? null
      };

    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}


// ==================================================
// MARKET DATA ROUTER
// CoinGlass primary
// Bybit fallback
// ==================================================

async function getBTCMarketData() {
  const errors = [];

  try {
    const cg = await getCoinGlassBTC();

    return {
      ...cg,
      fallbackUsed: false
    };

  } catch (error) {
    errors.push(
      `CoinGlass: ${error.message}`
    );
  }

  try {
    const bybit = await getBybitBTC();

    return {
      ...bybit,
      fallbackUsed: true,
      warnings: errors
    };

  } catch (error) {
    errors.push(
      `Bybit: ${error.message}`
    );
  }

  throw new Error(errors.join(" | "));
}


// ==================================================
// BTC LIVE
// ==================================================

app.get("/api/btc", async (req, res) => {
  try {
    const marketData = await getBTCMarketData();

    res.json({
      status: "ok",
      ...marketData,
      serverTime: new Date().toISOString()
    });

  } catch (error) {

    res.status(500).json({
      status: "error",
      error: "Unable to obtain BTC market data",
      message: error.message
    });

  }
});


// ==================================================
// GUARDIAN INFO
// ==================================================

app.get("/api/guardian", (req, res) => {
  res.json({
    status: "ok",

    guardian: "Guardian Hidden Intention",

    context: {
      formula: "SRSLL",
      session: "Session",
      regime: "Regime",
      structure: "Structure",
      location: "Location",
      lastLiquidityEvent: "Last Liquidity Event"
    },

    hiddenIntention: {
      formula: "LTESR",
      location: "Location",
      time: "Time",
      effort: "Effort",
      structure: "Structure",
      response: "Response"
    },

    executionTimeframe: "1 Minute",

    riskRules: {
      maxRisk: "1%",
      rule1: "SL first, then Entry",
      rule2: "No Retest = No Respect"
    }
  });
});


// ==================================================
// OPENAI TEXT EXTRACT
// ==================================================

function extractOpenAIText(data) {
  if (data?.output_text) {
    return data.output_text;
  }

  const texts = [];

  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (
        part?.type === "output_text" &&
        part?.text
      ) {
        texts.push(part.text);
      }
    }
  }

  return texts.join("\n").trim();
}


// ==================================================
// GUARDIAN AI
// ==================================================

app.post("/api/guardian/btc", async (req, res) => {
  try {

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        status: "error",
        error: "OPENAI_API_KEY not configured"
      });
    }

    const marketData =
      await getBTCMarketData();

    const userContext =
      typeof req.body?.context === "string"
        ? req.body.context.trim()
        : "";


    const guardianPrompt = `
You are Guardian.

Your role is conservative BTC market interpretation.

Never invent data.

Guardian hierarchy:

CONTEXT = SRSLL
Session
Regime
Structure
Location
Last Liquidity Event

HIDDEN INTENTION = LTESR
Location
Time
Effort
Structure
Response

Execution timeframe:
1 minute.

Important concepts:

PRICE + OI

Price UP + OI UP:
Fresh participation entering.

Price UP + OI DOWN:
Short covering / squeeze / deleveraging may be contributing.

Price DOWN + OI UP:
Fresh shorts may be entering.

Price DOWN + OI DOWN:
Longs closing / liquidation / deleveraging may be contributing.

Funding:
Positive funding indicates long-side positioning pressure.
Negative funding indicates short-side positioning pressure.

Funding and OI do NOT alone prove:
absorption,
liquidity sweep,
spoofing,
acceptance,
rejection,
hidden whale intention.

Those require:
price response,
structure,
session,
location,
VWAP,
heatmap,
delta/CVD,
orderbook,
liquidation behavior.

LIVE DATA:

${JSON.stringify(marketData, null, 2)}

USER CHART CONTEXT:

${userContext || "No additional chart context supplied."}

Analyze with:

1. Market Snapshot
2. Price + OI
3. Funding
4. Possible Participation Type
5. SRSLL
6. LTESR
7. What Is Missing
8. Long / Short / WAIT
9. Confirmation Needed
10. Risk Lock

If evidence is incomplete:
WAIT.
`;


    const aiData = await fetchJson(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model: "gpt-5.6-sol",

          reasoning: {
            effort: "medium"
          },

          input: guardianPrompt
        })
      }
    );


    res.json({
      status: "ok",

      service:
        "Guardian Hidden Intention AI",

      marketData,

      analysis:
        extractOpenAIText(aiData) ||
        "No AI analysis returned.",

      time:
        new Date().toISOString()
    });

  } catch (error) {

    res.status(500).json({
      status: "error",

      error:
        "Guardian analysis failed",

      message:
        error.message
    });

  }
});


// ==================================================
// FRONTEND
// ==================================================

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});


// ==================================================
// START
// ==================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Guardian Live running on port ${PORT}`
  );
});
