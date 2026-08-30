import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { fetchQuotes } from './server/tradingview/scanner.js';
import { fetchHistory, isRange, RANGES, type Range } from './server/tradingview/history.js';
import { buildIndiaRates, DEFAULT_DUTY } from './server/india.js';
import { ALL_TICKERS, TICKERS, resolveTicker } from './server/tickers.js';
import type { Quote } from './server/tradingview/scanner.js';

const POLL_MS = 30_000;
const HEARTBEAT_MS = 15_000;

// ── Shared in-process state ───────────────────────────────────────────────────
// Node.js module scope is shared across every request in the same process.
// One poll loop writes here; every SSE handler reads from here.

let latestQuotes: Record<string, Quote> = {};
let lastPollAt = 0;
let consecutiveFailures = 0;

type Writer = (chunk: string) => void;
const clients = new Set<Writer>();

// ── Single upstream poll loop ─────────────────────────────────────────────────

async function poll() {
  try {
    const quotes = await fetchQuotes(ALL_TICKERS);
    latestQuotes = Object.fromEntries(quotes.map((q) => [q.symbol, q]));
    lastPollAt = Date.now();
    consecutiveFailures = 0;
    broadcast(`data: ${JSON.stringify(latestQuotes)}\n\n`);
    console.log(`[poll] ok — ${quotes.length} quotes, ${clients.size} client(s)`);
  } catch (err) {
    consecutiveFailures++;
    console.error(`[poll] failure #${consecutiveFailures}:`, err);
    broadcast(`event: status\ndata: ${JSON.stringify({ stale: true })}\n\n`);
  }
}

function broadcast(chunk: string) {
  for (const write of clients) write(chunk);
}

// Fetch immediately on startup so the first client doesn't wait 30s.
poll();
const pollTimer = setInterval(poll, POLL_MS);
pollTimer.unref?.(); // don't block graceful Node.js shutdown

// Heartbeat keeps load-balancer / proxy connections alive.
const heartbeatTimer = setInterval(() => broadcast(': heartbeat\n\n'), HEARTBEAT_MS);
heartbeatTimer.unref?.();

// ── History cache (in-memory, keyed symbol:range) ─────────────────────────────

const historyCache = new Map<string, { bars: unknown; expiresAt: number }>();

// ── Hono app ──────────────────────────────────────────────────────────────────

const app = new Hono();

const ALLOWED = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
app.use(
  '*',
  cors({
    origin: ALLOWED.length > 0 ? (o) => (ALLOWED.includes(o) ? o : null) : '*',
    allowMethods: ['GET', 'OPTIONS'],
  })
);

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/', (c) =>
  c.json({
    service: 'metalpricetracker',
    endpoints: ['/live-quotes', '/snapshot', '/history', '/india-rates', '/tickers', '/health'],
  })
);

app.get('/tickers', (c) => c.json({ tickers: TICKERS }));

app.get('/health', (c) =>
  c.json({
    ok: true,
    clients: clients.size,
    lastPollAt,
    ageMs: lastPollAt > 0 ? Date.now() - lastPollAt : null,
    consecutiveFailures,
  })
);

app.get('/snapshot', (c) =>
  c.json({ quotes: latestQuotes, lastPollAt, stale: consecutiveFailures > 0 })
);

app.get('/live-quotes', (c) => {
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write: Writer = (chunk) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          // controller already closed — client has gone
        }
      };

      // Deliver current snapshot immediately so the UI isn't blank.
      if (Object.keys(latestQuotes).length > 0) {
        write(`data: ${JSON.stringify(latestQuotes)}\n\n`);
      }
      write('retry: 3000\n\n');

      clients.add(write);
      console.log(`[sse] connected  — total: ${clients.size}`);

      c.req.raw.signal.addEventListener('abort', () => {
        clients.delete(write);
        try { controller.close(); } catch { /* already closed */ }
        console.log(`[sse] disconnected — total: ${clients.size}`);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx / Cloudflare response buffering
    },
  });
});

app.get('/india-rates', (c) => {
  const quotes = new Map(Object.entries(latestQuotes));
  const rates = buildIndiaRates(quotes, DEFAULT_DUTY);
  return c.json({
    ...rates,
    lastPollAt,
    stale: consecutiveFailures > 0,
    benchmarks: {
      mcxGold: latestQuotes['MCX:GOLD1!'] ?? null,
      mcxSilver: latestQuotes['MCX:SILVER1!'] ?? null,
      comexGold: latestQuotes['COMEX:GC1!'] ?? null,
      comexSilver: latestQuotes['COMEX:SI1!'] ?? null,
    },
  });
});

app.get('/history', async (c) => {
  const symbol = c.req.query('symbol') ?? 'TVC:GOLD';
  const ticker = resolveTicker(symbol);
  if (!ticker) return c.json({ error: 'unknown_symbol', symbol }, 400);

  const rangeParam = c.req.query('range') ?? '30d';
  if (!isRange(rangeParam)) {
    return c.json({ error: 'unknown_range', range: rangeParam, allowed: Object.keys(RANGES) }, 400);
  }

  const cacheKey = `${ticker}:${rangeParam}`;
  const cached = historyCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return c.json({ symbol: ticker, range: rangeParam, bars: cached.bars });
  }

  try {
    const bars = await fetchHistory(ticker, rangeParam as Range);
    historyCache.set(cacheKey, { bars, expiresAt: Date.now() + RANGES[rangeParam as Range].cacheSeconds * 1000 });
    return c.json({ symbol: ticker, range: rangeParam, bars });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[history] ${ticker} ${rangeParam} failed:`, message);
    return c.json({ error: 'history_unavailable', symbol: ticker, range: rangeParam, message }, 502);
  }
});

export default app;
