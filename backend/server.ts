import { createHmac } from 'node:crypto';
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
    // log IST Time
    console.log(` ${new Date(lastPollAt + 5.5 * 60 * 60 * 1000).toISOString()} : [poll] ok — ${quotes.length} quotes, ${clients.size} client(s) `);
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

// ── Auth & rate limiting ──────────────────────────────────────────────────────

const TOKEN_SECRET = process.env.TOKEN_SECRET; // undefined in local dev = no auth required
const TOKEN_WINDOW_MS = 15 * 60 * 1000;

function currentWindow(): number { return Math.floor(Date.now() / TOKEN_WINDOW_MS); }

function makeToken(window: number): string {
  return createHmac('sha256', TOKEN_SECRET!).update(String(window)).digest('hex').slice(0, 32);
}

function isValidToken(t: string): boolean {
  const w = currentWindow();
  return t === makeToken(w) || t === makeToken(w - 1);
}

const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;    // requests per IP per minute
const RATE_WINDOW = 60_000;

// Periodic cleanup so the map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [ip, r] of ipHits) if (now >= r.resetAt) ipHits.delete(ip);
}, 5 * 60_000).unref?.();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const r = ipHits.get(ip);
  if (!r || now >= r.resetAt) { ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW }); return false; }
  if (r.count >= RATE_LIMIT) return true;
  r.count++;
  return false;
}

function getClientIp(c: { req: { header: (h: string) => string | undefined } }): string {
  return c.req.header('CF-Connecting-IP')
    ?? c.req.header('X-Forwarded-For')?.split(',')[0].trim()
    ?? 'unknown';
}

// ── Hono app ──────────────────────────────────────────────────────────────────

const app = new Hono();

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'] }));

// /token and /health are public; everything else requires a valid short-lived token.
app.use('*', async (c, next) => {
  if (c.req.path === '/health' || c.req.path === '/token') return next();

  if (isRateLimited(getClientIp(c))) {
    return c.json({ error: 'rate_limited' }, 429);
  }

  if (TOKEN_SECRET) {
    const provided = c.req.header('X-Token') ?? c.req.query('token');
    if (!provided || !isValidToken(provided)) return c.json({ error: 'unauthorized' }, 401);
  }

  return next();
});

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/', (c) =>
  c.json({
    service: 'metalpricetracker',
    endpoints: ['/token', '/live-quotes', '/snapshot', '/history', '/india-rates', '/tickers', '/health'],
  })
);

app.get('/token', (c) => {
  if (!TOKEN_SECRET) return c.json({ token: null, expiresIn: null });
  const w = currentWindow();
  const token = makeToken(w);
  const expiresIn = TOKEN_WINDOW_MS - (Date.now() % TOKEN_WINDOW_MS);
  return c.json({ token, expiresIn });
});

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
  const throttleMs = Math.max(POLL_MS, parseInt(c.req.query('i') ?? String(POLL_MS), 10));
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let lastSentAt = 0;

      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          // controller already closed — client has gone
        }
      };

      // Throttled writer registered in the broadcast set.
      // Heartbeat comments (': ...') always pass through without resetting the clock.
      const write: Writer = (chunk) => {
        if (chunk.startsWith(':')) { send(chunk); return; }
        const now = Date.now();
        if (now - lastSentAt < throttleMs) return;
        lastSentAt = now;
        send(chunk);
      };

      // Deliver current snapshot immediately so the UI isn't blank.
      // Don't update lastSentAt — snapshot bypasses the throttle so the next
      // poll broadcast (which may fire within seconds) always goes through.
      if (Object.keys(latestQuotes).length > 0) {
        send(`data: ${JSON.stringify(latestQuotes)}\n\n`);
      }
      send('retry: 3000\n\n');

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
