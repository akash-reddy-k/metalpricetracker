import { TICKERS } from '../tickers.js';

const WS_URL = 'wss://data.tradingview.com/socket.io/websocket?from=chart%2F';
const ORIGIN = 'https://www.tradingview.com';
const HISTORY_TIMEOUT_MS = 15000;

export type Range = '24h' | '7d' | '30d' | '1y' | '5y';

interface RangeSpec {
  resolution: string;
  bars: number;
  /** Suggested edge cache lifetime; intraday data goes stale faster than monthly. */
  cacheSeconds: number;
}

export const RANGES: Record<Range, RangeSpec> = {
  '24h': { resolution: '60', bars: 24, cacheSeconds: 300 },
  '7d': { resolution: '240', bars: 42, cacheSeconds: 900 },
  '30d': { resolution: '1D', bars: 30, cacheSeconds: 3600 },
  '1y': { resolution: '1W', bars: 52, cacheSeconds: 21600 },
  '5y': { resolution: '1M', bars: 60, cacheSeconds: 86400 },
};

export function isRange(value: string): value is Range {
  return value in RANGES;
}

export interface Bar {
  /** Bar open time, UNIX seconds (as TradingView reports it). */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export class HistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoryError';
  }
}

/** TradingView frames every message as `~m~<byteLength>~m~<payload>`. */
function frame(payload: string): string {
  return `~m~${payload.length}~m~${payload}`;
}

function call(method: string, params: unknown[]): string {
  return frame(JSON.stringify({ m: method, p: params }));
}

function randomId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 14);
}

interface Socket {
  send(data: string): void;
  close(): void;
  onMessage(handler: (data: string) => void): void;
  onClose(handler: () => void): void;
  onError(handler: (err: Error) => void): void;
}

/**
 * Workers cannot use the WebSocket constructor for outbound connections; it
 * requires an Upgrade fetch. Node has the constructor but no such fetch support.
 */
async function connect(): Promise<Socket> {
  const ws = new WebSocket(WS_URL, { headers: { Origin: ORIGIN } } as unknown as string[]);
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve(), { once: true });
    ws.addEventListener('error', () => reject(new HistoryError('websocket connect failed')), {
      once: true,
    });
  });
  return wrap(ws);
}

function wrap(ws: WebSocket): Socket {
  return {
    send: (data) => ws.send(data),
    close: () => {
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    },
    onMessage: (handler) =>
      ws.addEventListener('message', (event: MessageEvent) => {
        handler(typeof event.data === 'string' ? event.data : String(event.data));
      }),
    onClose: (handler) => ws.addEventListener('close', () => handler()),
    onError: (handler) => ws.addEventListener('error', () => handler(new HistoryError('websocket error'))),
  };
}

/** Fetches OHLC bars for an allowlisted ticker over the given range. */
export async function fetchHistory(ticker: string, range: Range): Promise<Bar[]> {
  const spec = TICKERS[ticker];
  if (!spec) throw new HistoryError(`ticker not allowed: ${ticker}`);

  const { resolution, bars: barCount } = RANGES[range];
  const socket = await connect();
  const chartSession = randomId('cs_');
  const seriesId = 'sds_1';
  const bars: Bar[] = [];

  try {
    return await new Promise<Bar[]>((resolve, reject) => {
      let handshakeDone = false;
      const timer = setTimeout(() => {
        reject(new HistoryError(`history request timed out for ${ticker} ${range}`));
      }, HISTORY_TIMEOUT_MS);

      const finish = (fn: () => void) => {
        clearTimeout(timer);
        socket.close();
        fn();
      };

      socket.onError((err) => finish(() => reject(err)));
      socket.onClose(() =>
        finish(() =>
          bars.length > 0
            ? resolve(bars)
            : reject(new HistoryError(`connection closed before data for ${ticker}`))
        )
      );

      socket.onMessage((raw) => {
        const heartbeat = raw.match(/~m~\d+~m~(~h~\d+)/);
        if (heartbeat) {
          socket.send(frame(heartbeat[1]));
          return;
        }

        // The first server message carries the session; that is our cue to set up.
        if (!handshakeDone) {
          handshakeDone = true;
          socket.send(call('set_auth_token', ['unauthorized_user_token']));
          socket.send(call('chart_create_session', [chartSession, '']));
          socket.send(
            call('resolve_symbol', [
              chartSession,
              'sym_1',
              `={"symbol":"${ticker}","adjustment":"splits"}`,
            ])
          );
          socket.send(
            call('create_series', [chartSession, seriesId, 's1', 'sym_1', resolution, barCount, ''])
          );
          return;
        }

        for (const part of raw.split(/~m~\d+~m~/).filter(Boolean)) {
          let message: { m?: string; p?: unknown[] };
          try {
            message = JSON.parse(part);
          } catch {
            continue;
          }

          if (
            message.m === 'symbol_error' ||
            message.m === 'series_error' ||
            message.m === 'critical_error'
          ) {
            finish(() => reject(new HistoryError(`TradingView rejected ${ticker}: ${message.m}`)));
            return;
          }

          if (message.m === 'timescale_update') {
            const payload = message.p?.[1] as Record<string, { s?: { v: number[] }[] }> | undefined;
            for (const point of payload?.[seriesId]?.s ?? []) {
              const [t, o, h, l, c] = point.v;
              if (Number.isFinite(t) && Number.isFinite(c)) {
                bars.push({ t, o, h, l, c });
              }
            }
          }

          if (message.m === 'series_completed') {
            finish(() =>
              bars.length > 0
                ? resolve(bars.sort((a, b) => a.t - b.t))
                : reject(new HistoryError(`no bars returned for ${ticker} ${range}`))
            );
            return;
          }
        }
      });
    });
  } finally {
    socket.close();
  }
}
