import { TICKERS } from '../tickers.js';

const SCANNER_URL = 'https://scanner.tradingview.com/global/scan';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  /** TradingView feed mode, e.g. "streaming" or "delayed_streaming_600" */
  mode: string;
  fetchedAt: number;
}

export class ScannerError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ScannerError';
    this.status = status;
  }
}

interface ScanItem {
  s: string;
  d: (number | string | null)[];
}

const COLUMNS = ['close', 'change', 'change_abs', 'update_mode'] as const;

function isRetryable(err: unknown): boolean {
  if (err instanceof ScannerError && err.status) {
    return err.status >= 500 || err.status === 429;
  }
  return true; // network/abort errors are worth another try
}

async function scanOnce(tickers: string[]): Promise<Quote[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(SCANNER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      body: JSON.stringify({ symbols: { tickers }, columns: COLUMNS }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ScannerError(`scanner returned ${response.status}`, response.status);
    }

    const body = (await response.json()) as { data?: ScanItem[] };
    if (!Array.isArray(body?.data)) {
      throw new ScannerError('scanner response missing data array');
    }

    const fetchedAt = Date.now();
    const quotes: Quote[] = [];

    for (const item of body.data) {
      if (!item?.s || !Array.isArray(item.d)) continue;
      if (!TICKERS[item.s]) continue;

      const price = Number(item.d[0]);
      // A zero or non-finite close means the feed has nothing useful; skip rather
      // than publishing a price of 0 to clients.
      if (!Number.isFinite(price) || price <= 0) continue;

      quotes.push({
        symbol: item.s,
        price,
        change: Number(item.d[2]) || 0,
        changePercent: Number(item.d[1]) || 0,
        mode: typeof item.d[3] === 'string' ? item.d[3] : 'unknown',
        fetchedAt,
      });
    }

    return quotes;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetches quotes with bounded retries and exponential backoff. Throws if every attempt fails. */
export async function fetchQuotes(tickers: string[]): Promise<Quote[]> {
  if (tickers.length === 0) return [];

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await scanOnce(tickers);
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === MAX_ATTEMPTS - 1) break;
      const backoff = 300 * 2 ** attempt + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError instanceof Error ? lastError : new ScannerError(String(lastError));
}
