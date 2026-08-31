import { useEffect, useRef, useState } from 'react';
import { liveQuotesUrl, type LiveQuote } from '../services/api';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

interface LiveQuotesState {
  quotes: Record<string, LiveQuote>;
  status: ConnectionStatus;
  lastUpdated: Date | null;
  /** True when the server reports its own upstream feed has gone stale. */
  stale: boolean;
}

const MAX_BACKOFF_MS = 30000;
const BASE_BACKOFF_MS = 1000;
/** Consecutive failures before we stop calling it a blip and show offline. */
const OFFLINE_AFTER_ATTEMPTS = 3;

/**
 * Subscribes to the server's SSE price stream.
 *
 * `throttleMs` is sent to the server as a delivery preference and changing it does
 * not tear down the connection, so adjusting the refresh rate never drops the feed.
 */
export function useLiveQuotes(throttleMs: number): LiveQuotesState & { reconnect: () => void } {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stale, setStale] = useState(false);
  const [reconnectNonce, setReconnectNonce] = useState(0);

  // Held in a ref so throttle changes reach the next reconnect without
  // re-running the effect and dropping the current stream.
  const throttleRef = useRef(throttleMs);
  useEffect(() => {
    throttleRef.current = throttleMs;
  }, [throttleMs]);

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;

      source = new EventSource(liveQuotesUrl(throttleRef.current));

      source.onopen = () => {
        attempts = 0;
        setStatus('live');
      };

      source.onmessage = (event) => {
        try {
          const all = JSON.parse((event as MessageEvent).data) as Record<string, LiveQuote>;
          const valid = Object.fromEntries(
            Object.entries(all).filter(([, q]) => Number.isFinite(q.price) && q.price > 0)
          );
          if (Object.keys(valid).length === 0) return;

          setQuotes(valid);
          setLastUpdated(new Date());
          setStatus('live');
        } catch {
          // A single malformed frame should not kill the stream.
        }
      };

      source.addEventListener('status', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as { stale?: boolean };
          setStale(Boolean(payload.stale));
        } catch {
          /* ignore */
        }
      });

      source.onerror = () => {
        source?.close();
        source = null;
        if (disposed) return;

        attempts++;
        setStatus(attempts >= OFFLINE_AFTER_ATTEMPTS ? 'offline' : 'reconnecting');

        // Exponential backoff with jitter so a server restart does not cause
        // every open tab to reconnect in lockstep.
        const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
        retryTimer = setTimeout(connect, delay + Math.random() * 500);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [reconnectNonce]);

  return {
    quotes,
    status,
    lastUpdated,
    stale,
    reconnect: () => setReconnectNonce((n) => n + 1),
  };
}
