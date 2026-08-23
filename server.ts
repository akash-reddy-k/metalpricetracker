import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { cors } from 'hono/cors';

const MAX_REQUESTS_PER_INVOCATION = 120; // Expanded limit for continuous dashboard streaming

const app = new Hono();

// Enable CORS for our frontend client
app.use('*', cors());

app.onError((err, c) => {
  console.error('Global error handler caught:', err);
  return c.json(
    {
      success: false,
      errors: [{ code: 7000, message: err.message || 'Internal Server Error' }],
    },
    500
  );
});

app.get('/', (c) => {
  return c.text('MetalPriceTracker Hono Server is active. Access /live-quotes for SSE stream.');
});

// Map of common symbol aliases (including legacy Yahoo Finance tickers) to TradingView tickers
const SYMBOL_ALIAS_MAP: Record<string, string> = {
  'GC=F': 'TVC:GOLD',
  GOLD: 'TVC:GOLD',
  XAUUSD: 'TVC:GOLD',
  'TVC:GOLD': 'TVC:GOLD',

  'SI=F': 'TVC:SILVER',
  SILVER: 'TVC:SILVER',
  XAGUSD: 'TVC:SILVER',
  'TVC:SILVER': 'TVC:SILVER',

  'PL=F': 'TVC:PLATINUM',
  PLATINUM: 'TVC:PLATINUM',
  XPTUSD: 'TVC:PLATINUM',
  'TVC:PLATINUM': 'TVC:PLATINUM',

  'PA=F': 'TVC:PALLADIUM',
  PALLADIUM: 'TVC:PALLADIUM',
  XPDUSD: 'TVC:PALLADIUM',
  'TVC:PALLADIUM': 'TVC:PALLADIUM',
};

function resolveTradingViewTicker(symbol: string): string {
  const upper = symbol.toUpperCase().trim();
  if (SYMBOL_ALIAS_MAP[upper]) {
    return SYMBOL_ALIAS_MAP[upper];
  }
  if (upper.startsWith('FX_IDC:')) {
    return upper;
  }
  if (upper.endsWith('=X')) {
    const currency = upper.replace('=X', '');
    return `FX_IDC:USD${currency}`;
  }
  if (upper.startsWith('USD') && upper.length === 6) {
    return `FX_IDC:${upper}`;
  }
  return upper;
}

interface CachedPrice {
  price: number;
  change: number;
  changePercent: string;
  state: string;
  timestamp: number;
}

const priceCache = new Map<string, CachedPrice>();

interface TradingViewScanItem {
  s: string; // Ticker e.g. "TVC:GOLD"
  d: (number | null)[]; // Data array [close, change, change_abs]
}

interface TradingViewScanResponse {
  totalCount?: number;
  data?: TradingViewScanItem[];
}

async function fetchTradingViewBatch(
  tickers: string[]
): Promise<Map<string, { price: number; change: number; changePercent: string }>> {
  const results = new Map<string, { price: number; change: number; changePercent: string }>();
  if (tickers.length === 0) return results;

  try {
    const response = await fetch('https://scanner.tradingview.com/global/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      body: JSON.stringify({
        symbols: { tickers },
        columns: ['close', 'change', 'change_abs'],
      }),
    });

    if (!response.ok) {
      throw new Error(`TradingView scanner API returned status ${response.status}`);
    }

    const data = (await response.json()) as TradingViewScanResponse;

    if (data && Array.isArray(data.data)) {
      for (const item of data.data) {
        if (item && item.s && Array.isArray(item.d)) {
          const price = item.d[0] ?? 0;
          const changePercentNum = item.d[1] ?? 0;
          const changeVal = item.d[2] ?? 0;

          results.set(item.s, {
            price,
            change: Number(changeVal.toFixed(4)),
            changePercent: changePercentNum.toFixed(2),
          });
        }
      }
    }
  } catch (error) {
    console.error('[TradingView] Failed to fetch batch quote data:', error);
  }

  return results;
}

app.get('/live-quotes', (c) => {
  const rawSymbols = c.req
    .query('s')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) || ['TVC:GOLD', 'TVC:SILVER', 'TVC:PLATINUM', 'TVC:PALLADIUM'];

  // Default interval to 10 seconds (10000ms) or use query param
  const interval = c.req.query('i') ? parseInt(c.req.query('i')!) : 10000;
  let requestCount = 0;

  return streamSSE(c, async (stream) => {
    while (!stream.aborted && !stream.closed && requestCount++ < MAX_REQUESTS_PER_INVOCATION) {
      let anySuccessfulFetch = false;

      // Determine unique TradingView tickers needed
      const tickerToRequestedSymbolsMap = new Map<string, string[]>();
      for (const rawSym of rawSymbols) {
        const tvTicker = resolveTradingViewTicker(rawSym);
        const list = tickerToRequestedSymbolsMap.get(tvTicker) || [];
        list.push(rawSym);
        tickerToRequestedSymbolsMap.set(tvTicker, list);
      }

      const uniqueTvTickers = Array.from(tickerToRequestedSymbolsMap.keys());
      const batchData = await fetchTradingViewBatch(uniqueTvTickers);

      // Process each requested symbol and write SSE
      for (const rawSym of rawSymbols) {
        const tvTicker = resolveTradingViewTicker(rawSym);
        const liveData = batchData.get(tvTicker);

        let priceData: { price: number; change: number; changePercent: string; state: string };

        if (liveData && liveData.price > 0) {
          priceData = {
            price: liveData.price,
            change: liveData.change,
            changePercent: liveData.changePercent,
            state: 'REGULAR',
          };
          priceCache.set(rawSym, {
            ...priceData,
            timestamp: Date.now(),
          });
          anySuccessfulFetch = true;
        } else {
          // Fall back to cached price if available
          const cached = priceCache.get(rawSym);
          if (cached) {
            priceData = {
              price: cached.price,
              change: cached.change,
              changePercent: cached.changePercent,
              state: 'CACHED',
            };
            anySuccessfulFetch = true;
          } else {
            console.warn(`[TradingView] No live or cached data for symbol: ${rawSym}`);
            continue;
          }
        }

        try {
          await stream.writeSSE({
            event: 'quote',
            data: JSON.stringify({
              t: Date.now(),
              symbol: rawSym,
              price: priceData.price,
              change: priceData.change,
              changePercent: priceData.changePercent,
              state: priceData.state,
            }),
          });
        } catch (err) {
          console.error(`Error writing SSE stream for ${rawSym}:`, err);
        }
      }

      if (!anySuccessfulFetch && requestCount === 1) {
        console.error('All price fetches failed on initial request');
        stream.abort();
        break;
      }

      await stream.sleep(interval);
    }
  });
});

export default app;

