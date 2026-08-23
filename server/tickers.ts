export type QuoteKind = 'metal' | 'fx' | 'benchmark';

export interface TickerSpec {
  /** TradingView ticker, e.g. "TVC:GOLD" */
  tv: string;
  kind: QuoteKind;
  /** Currency the quote is denominated in */
  currency: string;
  /** Unit the quote is denominated in, for display and conversion */
  unit: 'oz' | '10g' | 'kg' | 'ratio';
  label: string;
  /** True when TradingView reports this feed as delayed rather than real-time */
  delayed?: boolean;
}

/**
 * The set of tickers this service will proxy. Requests for anything outside this
 * map are rejected, so the endpoint cannot be used as a general TradingView proxy.
 */
export const TICKERS: Record<string, TickerSpec> = {
  'TVC:GOLD': { tv: 'TVC:GOLD', kind: 'metal', currency: 'USD', unit: 'oz', label: 'Gold Spot' },
  'TVC:SILVER': {
    tv: 'TVC:SILVER',
    kind: 'metal',
    currency: 'USD',
    unit: 'oz',
    label: 'Silver Spot',
  },
  'TVC:PLATINUM': {
    tv: 'TVC:PLATINUM',
    kind: 'metal',
    currency: 'USD',
    unit: 'oz',
    label: 'Platinum Spot',
  },
  'TVC:PALLADIUM': {
    tv: 'TVC:PALLADIUM',
    kind: 'metal',
    currency: 'USD',
    unit: 'oz',
    label: 'Palladium Spot',
  },

  'MCX:GOLD1!': {
    tv: 'MCX:GOLD1!',
    kind: 'benchmark',
    currency: 'INR',
    unit: '10g',
    label: 'Gold MCX Futures',
  },
  'MCX:SILVER1!': {
    tv: 'MCX:SILVER1!',
    kind: 'benchmark',
    currency: 'INR',
    unit: 'kg',
    label: 'Silver MCX Futures',
  },
  'COMEX:GC1!': {
    tv: 'COMEX:GC1!',
    kind: 'benchmark',
    currency: 'USD',
    unit: 'oz',
    label: 'Gold COMEX Futures',
    delayed: true,
  },
  'COMEX:SI1!': {
    tv: 'COMEX:SI1!',
    kind: 'benchmark',
    currency: 'USD',
    unit: 'oz',
    label: 'Silver COMEX Futures',
    delayed: true,
  },
};

const FX_CURRENCIES = [
  'INR',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'AED',
  'CHF',
  'CNY',
  'RUB',
  'IDR',
  'ZAR',
] as const;

for (const currency of FX_CURRENCIES) {
  const tv = `FX_IDC:USD${currency}`;
  TICKERS[tv] = { tv, kind: 'fx', currency, unit: 'ratio', label: `USD/${currency}` };
}

/** Legacy Yahoo Finance tickers and bare metal names, kept so old clients keep working. */
const ALIASES: Record<string, string> = {
  'GC=F': 'TVC:GOLD',
  GOLD: 'TVC:GOLD',
  XAUUSD: 'TVC:GOLD',
  'SI=F': 'TVC:SILVER',
  SILVER: 'TVC:SILVER',
  XAGUSD: 'TVC:SILVER',
  'PL=F': 'TVC:PLATINUM',
  PLATINUM: 'TVC:PLATINUM',
  XPTUSD: 'TVC:PLATINUM',
  'PA=F': 'TVC:PALLADIUM',
  PALLADIUM: 'TVC:PALLADIUM',
  XPDUSD: 'TVC:PALLADIUM',
};

for (const currency of FX_CURRENCIES) {
  ALIASES[`${currency}=X`] = `FX_IDC:USD${currency}`;
  ALIASES[`USD${currency}`] = `FX_IDC:USD${currency}`;
}

/** Resolves a client-supplied symbol to an allowlisted ticker, or null if unknown. */
export function resolveTicker(symbol: string): string | null {
  const upper = symbol.trim().toUpperCase();
  if (TICKERS[upper]) return upper;
  const alias = ALIASES[upper];
  return alias && TICKERS[alias] ? alias : null;
}

/** Every ticker the hub polls upstream. One poll covers all clients. */
export const ALL_TICKERS = Object.keys(TICKERS);

export const DEFAULT_TICKERS = [
  'TVC:GOLD',
  'TVC:SILVER',
  'TVC:PLATINUM',
  'TVC:PALLADIUM',
  'FX_IDC:USDINR',
];
