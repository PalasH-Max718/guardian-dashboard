const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));


// ==========================
// 1. HEALTH CHECK
// ==========================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Guardian Live",
    time: new Date().toISOString()
  });
});


// ==========================
// 2. BYBIT BTC LIVE DATA
// ==========================

app.get("/api/btc", async (req, res) => {
  try {

    const response = await fetch(
      "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT"
    );

    const data = await response.json();

    const ticker = data?.result?.list?.[0];

    if (!ticker) {
      throw new Error("Bybit ticker unavailable");
    }

    res.json({
      source: "Bybit",
      symbol: "BTCUSDT",
      price: ticker.lastPrice || null,
      markPrice: ticker.markPrice || null,
      indexPrice: ticker.indexPrice || null,
      change24h: ticker.price24hPcnt || null,
      high24h: ticker.highPrice24h || null,
      low24h: ticker.lowPrice24h || null,
      volume24h: ticker.volume24h || null,
      turnover24h: ticker.turnover24h || null,
      serverTime: new Date().toISOString()
    });

  } catch (error) {

    res.status(500).json({
      error: "Unable to fetch Bybit BTC data",
      message: error.message
    });

  }
});


// ==========================
// 3. GUARDIAN AI
// ==========================

app.post("/api/guardian", async (req, res) => {

  try {

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing"
      });
    }

    const {
      message,
      context = {},
      marketData = {}
    } = req.body || {};


    if (!message) {
      return res.status(400).json({
        error: "message is required"
      });
    }


    const guardianInstructions = `
You are Guardian, a trading-analysis assistant.

Use this hierarchy:

1. CONTEXT FIRST
Session + Regime + Structure + Location + Last Liquidity Event
SRSLL.

2. Then 1-minute Hidden Intention:
Location + Time + Structure + Effort + Response
LTSER.

3. Read:
- price behavior
- liquidity
- aggression
- absorption
- consumption
- CVD
- order-book behavior
- heatmap
- VWAP
- market structure

4. Never let a 1-minute signal override higher-timeframe context.

5. Execution principle:
SL first, then Entry.

6. Risk:
Maximum suggested risk is 1% per trade.

7. Prefer:
No Retest = No Respect.

8. Never invent live market data.
Clearly identify unavailable information.

9. Output should be concise and structured:
CONTEXT
WHO IS IN CONTROL
EVIDENCE
HIDDEN INTENTION
INVALIDATION
EXECUTION
RISK
FINAL DECISION
`;


    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model: "gpt-5.6-sol",

          instructions: guardianInstructions,

          input: `
USER REQUEST:
${message}

GUARDIAN CONTEXT:
${JSON.stringify(context, null, 2)}

LIVE MARKET DATA:
${JSON.stringify(marketData, null, 2)}
`
        })
      }
    );


    const data = await response.json();


    if (!response.ok) {

      return res.status(response.status).json({
        error: "OpenAI request failed",
        details: data
      });

    }


    const answer =
      data.output_text ||
      data?.output
        ?.flatMap(item => item.content || [])
        ?.find(item => item.type === "output_text")
        ?.text ||
      "No Guardian response received";


    res.json({
      status: "ok",
      model: data.model,
      guardian: answer,
      responseId: data.id,
      serverTime: new Date().toISOString()
    });


  } catch (error) {

    res.status(500).json({
      error: "Guardian AI failed",
      message: error.message
    });

  }

});


// ==========================
// 4. GUARDIAN + LIVE BTC
// ==========================

app.post("/api/guardian/btc", async (req, res) => {

  try {

    const btcResponse = await fetch(
  "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT",
  {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Guardian-Dashboard"
    }
  }
);

const raw = await btcResponse.text();

let btcData;

try {
  btcData = JSON.parse(raw);
} catch (parseError) {
  throw new Error(
    `Bybit invalid JSON: ${parseError.message} | Raw: ${raw.slice(0, 200)}`
  );
}
    const ticker = btcData?.result?.list?.[0];


    if (!ticker) {
      throw new Error("Unable to obtain BTC ticker");
    }


    const marketData = {

      source: "Bybit",

      symbol: "BTCUSDT",

      price: ticker.lastPrice,

      markPrice: ticker.markPrice,

      indexPrice: ticker.indexPrice,
// ==============================
// GUARDIAN + LIVE BTC + CHATGPT
// ==============================

app.post("/api/guardian/btc", async (req, res) => {
  try {
    // 1) GET LIVE BTC DATA FROM BYBIT
    const btcResponse = await fetch(
      "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT",
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "guardian-dashboard"
        }
      }
    );

    const raw = await btcResponse.text();

    let btcData;

    try {
      btcData = JSON.parse(raw);
    } catch (parseError) {
      throw new Error(
        `Bybit invalid JSON: ${parseError.message} | Raw: ${raw.slice(0, 200)}`
      );
    }

    const ticker = btcData?.result?.list?.[0];

    if (!ticker) {
      throw new Error("Unable to obtain BTC ticker from Bybit");
    }

    const marketData = {
      source: "Bybit",
      symbol: "BTCUSDT",

      price: ticker.lastPrice,
      markPrice: ticker.markPrice,
      indexPrice: ticker.indexPrice,

      change24h: ticker.price24hPcnt,
      high24h: ticker.highPrice24h,
      low24h: ticker.lowPrice24h,
      volume24h: ticker.volume24h,

      openInterest: ticker.openInterest,
      fundingRate: ticker.fundingRate,

      serverTime: new Date().toISOString()
    };

    // 2) SEND MARKET DATA TO OPENAI / CHATGPT
    const aiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model: "gpt-5.6-sol",

          instructions: `
You are Guardian, a conservative crypto market analysis assistant.

Never guarantee profit.
Never invent unavailable market data.

Use this hierarchy:

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

Important market behaviour inputs:
- Price behaviour
- Open Interest
- Funding
- Liquidations
- Delta / aggression
- VWAP
- HVN / LVN
- Heatmap liquidity clusters
- Structure HH/HL/LL/LH

Remember the 4 Price + OI combinations:

1. Price UP + OI UP
Fresh positions entering.
Move has participation.

2. Price UP + OI DOWN
Shorts closing / short squeeze / deleveraging.

3. Price DOWN + OI UP
Fresh shorts entering.

4. Price DOWN + OI DOWN
Longs closing / liquidation / deleveraging.

For 1-minute hidden-intention analysis:
First identify context.
Then interpret effort versus response.
Do not use microstructure to override higher-timeframe context.

Return concise JSON-like analysis with:

regime
structure
priceBehaviour
oiInterpretation
fundingInterpretation
hiddenIntention
bullishEvidence
bearishEvidence
riskFlags
decision

Decision must be one of:
LONG CLUE
SHORT CLUE
WAIT
NO TRADE
          `,

          input: `
Analyze this live BTCUSDT market data:

${JSON.stringify(marketData, null, 2)}
          `
        })
      }
    );

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
      throw new Error(
        aiData?.error?.message || "OpenAI API request failed"
      );
    }

    // 3) RETURN BOTH LIVE DATA + GUARDIAN ANALYSIS
    res.json({
      status: "ok",
      marketData,
      guardian: aiData.output_text || "No Guardian analysis returned",
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Guardian BTC error:", error);

    res.status(500).json({
      status: "error",
      error: "Guardian BTC analysis failed",
      message: error.message
    });
  }
});
