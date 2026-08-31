import type { MetalType, CurrencyType } from '../types/metals';

export const API_BASE = import.meta.env.VITE_HONO_SERVER_URL || 'http://localhost:3000';

export type Timeframe = '24h' | '7d' | '30d' | '1y' | '5y';

export const METAL_TICKERS: Record<MetalType, string> = {
  gold: 'TVC:GOLD',
  silver: 'TVC:SILVER',
  platinum: 'TVC:PLATINUM',
  palladium: 'TVC:PALLADIUM',
};

export const TICKER_TO_METAL: Record<string, MetalType> = Object.fromEntries(
  Object.entries(METAL_TICKERS).map(([metal, ticker]) => [ticker, metal as MetalType])
);

export const FX_TICKERS: Record<Exclude<CurrencyType, 'USD'>, string> = {
  INR: 'FX_IDC:USDINR',
  EUR: 'FX_IDC:USDEUR',
  GBP: 'FX_IDC:USDGBP',
  JPY: 'FX_IDC:USDJPY',
  CAD: 'FX_IDC:USDCAD',
  AUD: 'FX_IDC:USDAUD',
  AED: 'FX_IDC:USDAED',
  CHF: 'FX_IDC:USDCHF',
  CNY: 'FX_IDC:USDCNY',
  RUB: 'FX_IDC:USDRUB',
  IDR: 'FX_IDC:USDIDR',
  ZAR: 'FX_IDC:USDZAR',
};

export const TICKER_TO_CURRENCY: Record<string, CurrencyType> = Object.fromEntries(
  Object.entries(FX_TICKERS).map(([currency, ticker]) => [ticker, currency as CurrencyType])
);

/** Everything the dashboard subscribes to on the live stream. */
export const SUBSCRIBED_TICKERS = [
  ...Object.values(METAL_TICKERS),
  ...Object.values(FX_TICKERS),
  'MCX:GOLD1!',
  'MCX:SILVER1!',
];

export interface LiveQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  mode: string;
  fetchedAt: number;
  stale?: boolean;
}

export interface HistoryBar {
  t: number; // UNIX seconds
  o: number;
  h: number;
  l: number;
  c: number;
}

export function liveQuotesUrl(throttleMs: number): string {
  const params = new URLSearchParams({
    s: SUBSCRIBED_TICKERS.join(','),
    i: String(throttleMs),
  });
  return `${API_BASE}/live-quotes?${params}`;
}

export async function fetchHistory(
  metal: MetalType,
  range: Timeframe,
  signal?: AbortSignal
): Promise<HistoryBar[]> {
  const params = new URLSearchParams({ symbol: METAL_TICKERS[metal], range });
  const response = await fetch(`${API_BASE}/history?${params}`, { signal });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `history failed (${response.status})`);
  }

  const body = (await response.json()) as { bars?: HistoryBar[] };
  if (!Array.isArray(body.bars) || body.bars.length === 0) {
    throw new Error('history returned no bars');
  }
  return body.bars;
}

export interface IndiaPurityRow {
  key: string;
  label: string;
  purity: number;
  perGram: number;
  per10Gram: number;
  per100Gram: number;
  perKilogram: number;
  perOunce: number;
  perTola: number;
}

export interface IndiaRate {
  metal: 'gold' | 'silver';
  basis: 'mcx' | 'derived-spot';
  perGramPure: number;
  purities: IndiaPurityRow[];
  sources: string[];
  note: string;
}

export interface IndiaRatesResponse {
  gold: IndiaRate | null;
  silver: IndiaRate | null;
  lastPollAt: number;
  stale: boolean;
}

export async function fetchIndiaRates(signal?: AbortSignal): Promise<IndiaRatesResponse> {
  const response = await fetch(`${API_BASE}/india-rates`, { signal });
  if (!response.ok) throw new Error(`india-rates failed (${response.status})`);
  return (await response.json()) as IndiaRatesResponse;
}
