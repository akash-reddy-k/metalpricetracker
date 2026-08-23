import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { resolveTicker, DEFAULT_TICKERS, TICKERS } from './server/tickers.js';
import { fetchHistory, isRange, RANGES, type Range } from './server/tradingview/history.js';
import { buildIndiaRates, DEFAULT_DUTY } from './server/india.js';
import { openCache, type HubNamespace } from './server/runtime.js';
import type { Quote } from './server/tradingview/scanner.js';

export { PriceHub } from './server/priceHub.js';

interface Env {
  PRICE_HUB: HubNamespace;
  /** Comma-separated allowed origins. Unset means allow any (dev only). */
  ALLOWED_ORIGINS?: string;
}

const MAX_REQUESTED_TICKERS = 40;
const MIN_THROTTLE_MS = 1000;
const MAX_THROTTLE_MS = 3_600_000;

const app = new Hono<{ Bindings: Env }>();

app.use('*', (c, next) => {
  const configured = c.env?.ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return cors({
    origin: (origin) => {
      if (!configured || configured.length === 0) return origin || '*';
      return configured.includes(origin) ? origin : null;
    },
  })(c, next);
});

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

/** Resolves and validates a client symbol list against the allowlist. */
function parseTickers(raw: string | undefined): { tickers: string[]; rejected: string[] } {
  if (!raw) return { tickers: [...DEFAULT_TICKERS], rejected: [] };

  const requested = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_REQUESTED_TICKERS);

  const tickers: string[] = [];
  const rejected: string[] = [];

  for (const symbol of requested) {
    const resolved = resolveTicker(symbol);
    if (resolved) {
      if (!tickers.includes(resolved)) tickers.push(resolved);
    } else {
      rejected.push(symbol);
    }
  }

  return { tickers: tickers.length > 0 ? tickers : [...DEFAULT_TICKERS], rejected };
}

function hub(env: Env) {
  // A single named instance means one upstream poller process-wide.
  return env.PRICE_HUB.get(env.PRICE_HUB.idFromName('global'));
}

app.get('/', (c) =>
  c.json({
    service: 'metalpricetracker',
    endpoints: ['/live-quotes', '/snapshot', '/history', '/india-rates', '/tickers', '/health'],
  })
);

app.get('/tickers', (c) => c.json({ tickers: TICKERS }));

app.get('/health', async (c) => {
  const response = await hub(c.env).fetch('https://hub/health');
  const body = await response.json();
  return c.json(body as Record<string, unknown>, response.ok ? 200 : 503);
});

app.get('/live-quotes', async (c) => {
  const { tickers, rejected } = parseTickers(c.req.query('s'));

  // Legacy clients pass `i` in milliseconds. Clamp it: this throttles delivery
  // to the client and never affects how often we poll TradingView.
  const rawThrottle = Number(c.req.query('i'));
  const throttleMs = Number.isFinite(rawThrottle)
    ? Math.min(Math.max(rawThrottle, MIN_THROTTLE_MS), MAX_THROTTLE_MS)
    : 0;

  const url = new URL('https://hub/subscribe');
  url.searchParams.set('tickers', tickers.join(','));
  url.searchParams.set('throttle', String(throttleMs));

  const response = await hub(c.env).fetch(url.toString());

  const headers = new Headers(response.headers);
  if (rejected.length > 0) {
    headers.set('X-Rejected-Symbols', rejected.join(','));
  }
  return new Response(response.body, { status: response.status, headers });
});

app.get('/snapshot', async (c) => {
  const { tickers, rejected } = parseTickers(c.req.query('s'));
  const response = await hub(c.env).fetch('https://hub/snapshot');
  const snapshot = (await response.json()) as {
    quotes: Record<string, Quote>;
    lastPollAt: number;
    stale: boolean;
  };

  const filtered: Record<string, Quote> = {};
  for (const ticker of tickers) {
    const quote = snapshot.quotes[ticker];
    if (quote) filtered[ticker] = quote;
  }

  return c.json({
    quotes: filtered,
    lastPollAt: snapshot.lastPollAt,
    stale: snapshot.stale,
    rejected,
  });
});

app.get('/india-rates', async (c) => {
  const response = await hub(c.env).fetch('https://hub/snapshot');
  const snapshot = (await response.json()) as {
    quotes: Record<string, Quote>;
    lastPollAt: number;
    stale: boolean;
  };

  const quotes = new Map(Object.entries(snapshot.quotes));
  const rates = buildIndiaRates(quotes, DEFAULT_DUTY);

  return c.json({
    ...rates,
    lastPollAt: snapshot.lastPollAt,
    stale: snapshot.stale,
    benchmarks: {
      mcxGold: snapshot.quotes['MCX:GOLD1!'] ?? null,
      mcxSilver: snapshot.quotes['MCX:SILVER1!'] ?? null,
      comexGold: snapshot.quotes['COMEX:GC1!'] ?? null,
      comexSilver: snapshot.quotes['COMEX:SI1!'] ?? null,
    },
  });
});

app.get('/history', async (c) => {
  const symbol = c.req.query('symbol') ?? 'TVC:GOLD';
  const ticker = resolveTicker(symbol);
  if (!ticker) {
    return c.json({ error: 'unknown_symbol', symbol }, 400);
  }

  const rangeParam = c.req.query('range') ?? '30d';
  if (!isRange(rangeParam)) {
    return c.json({ error: 'unknown_range', range: rangeParam, allowed: Object.keys(RANGES) }, 400);
  }
  const range: Range = rangeParam;

  const cacheKey = new Request(`https://cache/history?symbol=${ticker}&range=${range}`);
  const cache = await openCache('history');

  const cached = await cache?.match(cacheKey);
  if (cached) return cached;

  try {
    const bars = await fetchHistory(ticker, range);
    const response = Response.json(
      { symbol: ticker, range, bars },
      {
        headers: {
          'Cache-Control': `public, max-age=${RANGES[range].cacheSeconds}`,
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
    await cache?.put(cacheKey, response.clone());
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[history] ${ticker} ${range} failed:`, message);
    return c.json({ error: 'history_unavailable', symbol: ticker, range, message }, 502);
  }
});

export default app;
