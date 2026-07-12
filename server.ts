import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { cors } from 'hono/cors';
import YahooFinance from 'yahoo-finance2';

const MAX_REQUESTS_PER_INVOCATION = 120; // Expanded limit for continuous dashboard usage

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

const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

app.get('/', (c) => {
  return c.text('MetalPriceTracker Hono Server is active. Access /live-quotes for SSE stream.');
});

app.get('/live-quotes', (c) => {
  const normalizedSymbol = new Set(
    c.req
      .query('s')
      ?.split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean) || ['GC=F']
  );

  // Default interval to 10 seconds (10000ms) to stay within Yahoo limits, or use query param
  const interval = c.req.query('i') ? parseInt(c.req.query('i')!) : 10000;
  let requestCount = 0;

  return streamSSE(c, async (stream) => {
    let anySuccessfulFetch: boolean;

    const writePrice = async (symbol: string) => {
      try {
        const priceData = await fetchPrice(symbol);

        // Safeguard to prevent crashing if price data is missing
        const price = priceData.price ?? 0;
        const change = priceData.change ?? 0;
        const changeFormatted = change.toFixed(2);
        const changePercent = price > 0 ? ((change / price) * 100).toFixed(2) : '0.00';

        await stream.writeSSE({
          event: 'quote',
          data: JSON.stringify({
            t: Date.now(),
            symbol,
            price,
            change: changeFormatted,
            state: priceData.state,
            changePercent,
            meta: priceData.meta,
          }),
        });
        anySuccessfulFetch = true;
      } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
      }
    };

    while (!stream.aborted && !stream.closed && requestCount++ < MAX_REQUESTS_PER_INVOCATION) {
      anySuccessfulFetch = false; // Reset success flag for this tick

      // Fetch prices for all symbols and wait for the interval sleep to complete
      await Promise.allSettled([
        ...Array.from(normalizedSymbol).map(writePrice),
        stream.sleep(interval),
      ]);

      if (!anySuccessfulFetch && requestCount === 1) {
        // If the first request fails completely, abort immediately
        console.error('All price fetches failed on initial request');
        stream.abort();
        break;
      }
    }
  });
});

interface YahooQuote {
  symbol: string;
  marketState?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  postMarketPrice?: number;
  postMarketChange?: number;
  preMarketPrice?: number;
  preMarketChange?: number;
  state?: string;
  price?: number;
  change?: number;
  meta?: Record<string, unknown>;
}

interface CachedPrice {
  price: number;
  change: number;
  state: string;
  meta: {
    preMarketChange: number;
    regularMarketChange: number;
    postMarketChange: number;
  };
  timestamp: number;
}

const priceCache = new Map<string, CachedPrice>();

async function fetchPrice(symbol: string) {
  const fields = [
    'marketState',
    'regularMarketPrice',
    'regularMarketChange',
    'postMarketPrice',
    'postMarketChange',
    'preMarketPrice',
    'preMarketChange',
  ];

  let result: YahooQuote | YahooQuote[] | null | undefined;
  try {
    result = (await yf.quoteCombine(symbol, { fields }, { validateResult: false })) as
      YahooQuote | YahooQuote[] | null | undefined;
  } catch (error: unknown) {
    // Check cache fallback first for any non-validation error
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'FailedYahooValidationError' &&
      'result' in error
    ) {
      console.warn(`[YahooFinance] Validation failed for ${symbol}, falling back to error.result`);
      result = (error as { result: YahooQuote | YahooQuote[] }).result;
    } else {
      const cached = priceCache.get(symbol);
      if (cached) {
        console.warn(
          `[YahooFinance] Failed to fetch live rate for ${symbol}, falling back to cache (stale by ${Math.round(
            (Date.now() - cached.timestamp) / 1000
          )}s):`,
          error
        );
        return cached;
      }
      throw error;
    }
  }

  // Handle case where result is a QuoteResponseArray (finding matching symbol) or single object
  const quote = Array.isArray(result)
    ? result.find((q): q is YahooQuote => !!q && q.symbol === symbol)
    : result;

  const {
    marketState,
    regularMarketPrice,
    regularMarketChange,
    postMarketPrice,
    postMarketChange,
    preMarketPrice,
    preMarketChange,
  } = quote || {};

  const preMarketChangeVal = preMarketChange ?? 0;
  const regularMarketChangeVal = regularMarketChange ?? 0;
  const postMarketChangeVal = postMarketChange ?? 0;

  // Safeguard: fallback to whichever price fields are populated if the current state field is empty
  const fallbackPrice = regularMarketPrice ?? postMarketPrice ?? preMarketPrice ?? 0;

  let finalPriceData;
  switch (marketState) {
    case 'PRE':
      finalPriceData = {
        price: preMarketPrice ?? fallbackPrice,
        change: preMarketChangeVal,
        state: 'PRE',
        meta: {
          preMarketChange: preMarketChangeVal,
          regularMarketChange: regularMarketChangeVal,
          postMarketChange: postMarketChangeVal,
        },
      };
      break;
    case 'REGULAR':
      finalPriceData = {
        price: regularMarketPrice ?? fallbackPrice,
        change: regularMarketChangeVal,
        state: 'REGULAR',
        meta: {
          preMarketChange: preMarketChangeVal,
          regularMarketChange: regularMarketChangeVal,
          postMarketChange: postMarketChangeVal,
        },
      };
      break;
    default:
      finalPriceData = {
        price: postMarketPrice ?? fallbackPrice,
        change: regularMarketChangeVal + postMarketChangeVal,
        state: 'POST',
        meta: {
          preMarketChange: preMarketChangeVal,
          regularMarketChange: regularMarketChangeVal,
          postMarketChange: postMarketChangeVal,
        },
      };
      break;
  }

  // Save successful response in cache
  priceCache.set(symbol, {
    ...finalPriceData,
    timestamp: Date.now(),
  });

  return finalPriceData;
}

// Start Node.js server dynamically only when running inside a Node runtime (e.g. local PM2 or Heroku)
// This enables server.ts to be exported directly as a Cloudflare Worker entrypoint without server-start errors.
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  const { serve } = await import('@hono/node-server');
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  console.log(`Starting Hono backend server on http://localhost:${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}

export default app;
