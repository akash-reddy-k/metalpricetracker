import { fetchQuotes, type Quote } from './tradingview/scanner.js';
import { ALL_TICKERS } from './tickers.js';
import type { HubState } from './runtime.js';

/**
 * Upstream is polled at this cadence no matter how many clients are connected.
 * Client-side refresh preferences throttle *delivery*, never the upstream rate,
 * so TradingView sees one request stream rather than one per viewer.
 */
const POLL_INTERVAL_MS = 5000;
/** Backoff ceiling applied after consecutive upstream failures. */
const MAX_POLL_INTERVAL_MS = 60000;
const HEARTBEAT_MS = 15000;
const SNAPSHOT_KEY = 'snapshot';

interface Subscriber {
  controller: ReadableStreamDefaultController<Uint8Array>;
  /** Minimum ms between pushes to this client. */
  throttleMs: number;
  tickers: Set<string>;
  lastSentAt: Map<string, number>;
  closed: boolean;
}

interface StoredSnapshot {
  quotes: Record<string, Quote>;
  savedAt: number;
}

const encoder = new TextEncoder();

function sseFrame(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export class PriceHub {
  private subscribers = new Set<Subscriber>();
  private quotes = new Map<string, Quote>();
  private polling = false;
  private consecutiveFailures = 0;
  private lastPollAt = 0;
  private lastError: string | null = null;
  private hydrated: Promise<void>;
  private state: HubState;

  constructor(state: HubState) {
    this.state = state;
    // Restore the last known snapshot so a freshly-spawned instance can serve
    // warm prices immediately instead of showing nothing until the first poll.
    this.hydrated = state.blockConcurrencyWhile(async () => {
      const stored = await state.storage.get<StoredSnapshot>(SNAPSHOT_KEY);
      if (stored?.quotes) {
        for (const [symbol, quote] of Object.entries(stored.quotes)) {
          this.quotes.set(symbol, quote);
        }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.hydrated;
    const url = new URL(request.url);

    if (url.pathname === '/subscribe') {
      return this.subscribe(url);
    }

    if (url.pathname === '/snapshot') {
      await this.ensureFreshSnapshot();
      return Response.json(this.snapshotBody());
    }

    if (url.pathname === '/health') {
      return Response.json({
        ok: this.consecutiveFailures === 0 && this.quotes.size > 0,
        subscribers: this.subscribers.size,
        tickers: this.quotes.size,
        lastPollAt: this.lastPollAt,
        ageMs: this.lastPollAt ? Date.now() - this.lastPollAt : null,
        consecutiveFailures: this.consecutiveFailures,
        lastError: this.lastError,
      });
    }

    return new Response('not found', { status: 404 });
  }

  private snapshotBody() {
    return {
      quotes: Object.fromEntries(this.quotes),
      lastPollAt: this.lastPollAt,
      stale: this.isStale(),
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  private isStale(): boolean {
    return this.lastPollAt === 0 || Date.now() - this.lastPollAt > POLL_INTERVAL_MS * 4;
  }

  /** Polls immediately if the cached snapshot is older than one interval. */
  private async ensureFreshSnapshot(): Promise<void> {
    if (Date.now() - this.lastPollAt < POLL_INTERVAL_MS) return;
    await this.poll();
  }

  private subscribe(url: URL): Response {
    const requested = (url.searchParams.get('tickers') ?? '').split(',').filter(Boolean);
    const throttleMs = Number(url.searchParams.get('throttle')) || 0;

    let subscriber: Subscriber;

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        subscriber = {
          controller,
          throttleMs,
          tickers: new Set(requested),
          lastSentAt: new Map(),
          closed: false,
        };
        this.subscribers.add(subscriber);

        // Tell the browser how long to wait before reconnecting if we drop.
        controller.enqueue(encoder.encode('retry: 3000\n\n'));
        this.sendSnapshotTo(subscriber, true);
        this.startPolling();
      },
      cancel: () => {
        if (subscriber) {
          subscriber.closed = true;
          this.subscribers.delete(subscriber);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  private sendSnapshotTo(subscriber: Subscriber, force: boolean): void {
    const now = Date.now();
    for (const [symbol, quote] of this.quotes) {
      if (subscriber.tickers.size > 0 && !subscriber.tickers.has(symbol)) continue;

      if (!force && subscriber.throttleMs > 0) {
        const last = subscriber.lastSentAt.get(symbol) ?? 0;
        if (now - last < subscriber.throttleMs) continue;
      }

      if (!this.write(subscriber, 'quote', { ...quote, stale: this.isStale() })) return;
      subscriber.lastSentAt.set(symbol, now);
    }
  }

  private write(subscriber: Subscriber, event: string, data: unknown): boolean {
    if (subscriber.closed) return false;
    try {
      subscriber.controller.enqueue(sseFrame(event, data));
      return true;
    } catch {
      // Client vanished mid-write; drop it and let the poll loop wind down.
      subscriber.closed = true;
      this.subscribers.delete(subscriber);
      return false;
    }
  }

  private startPolling(): void {
    if (this.polling) return;
    this.polling = true;
    void this.pollLoop();
  }

  private async pollLoop(): Promise<void> {
    let sinceHeartbeat = 0;

    while (this.subscribers.size > 0) {
      const ok = await this.poll();

      if (ok) {
        for (const subscriber of [...this.subscribers]) {
          this.sendSnapshotTo(subscriber, false);
        }
      }

      const delay = ok
        ? POLL_INTERVAL_MS
        : Math.min(POLL_INTERVAL_MS * 2 ** this.consecutiveFailures, MAX_POLL_INTERVAL_MS);

      sinceHeartbeat += delay;
      if (sinceHeartbeat >= HEARTBEAT_MS) {
        sinceHeartbeat = 0;
        for (const subscriber of [...this.subscribers]) {
          // Comment frame keeps intermediaries from timing out an idle stream.
          if (!subscriber.closed) {
            try {
              subscriber.controller.enqueue(encoder.encode(': ping\n\n'));
            } catch {
              subscriber.closed = true;
              this.subscribers.delete(subscriber);
            }
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.polling = false;
  }

  private async poll(): Promise<boolean> {
    try {
      const quotes = await fetchQuotes(ALL_TICKERS);
      if (quotes.length === 0) {
        throw new Error('scanner returned no usable quotes');
      }

      for (const quote of quotes) {
        this.quotes.set(quote.symbol, quote);
      }
      this.lastPollAt = Date.now();
      this.consecutiveFailures = 0;
      this.lastError = null;

      await this.state.storage.put<StoredSnapshot>(SNAPSHOT_KEY, {
        quotes: Object.fromEntries(this.quotes),
        savedAt: this.lastPollAt,
      });
      return true;
    } catch (err) {
      this.consecutiveFailures++;
      this.lastError = err instanceof Error ? err.message : String(err);
      console.error(`[PriceHub] poll failed (${this.consecutiveFailures}):`, this.lastError);

      // Tell clients the feed degraded rather than silently serving stale prices.
      for (const subscriber of [...this.subscribers]) {
        this.write(subscriber, 'status', {
          stale: true,
          consecutiveFailures: this.consecutiveFailures,
          lastPollAt: this.lastPollAt,
          message: this.lastError,
        });
      }
      return false;
    }
  }
}
