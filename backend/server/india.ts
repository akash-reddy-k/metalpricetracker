import type { Quote } from './tradingview/scanner.js';

const GRAMS_PER_TROY_OZ = 31.1034768;

/**
 * Indian bullion association rates track MCX futures closely: sampled against
 * published association rates, 24K gold sat 0.22% above MCX GOLD1! and 999
 * silver 0.37% above MCX SILVER1!. Anchoring on MCX is far more accurate than
 * rebuilding the rate from international spot plus duty.
 */
const MCX_TO_RETAIL_PREMIUM = { gold: 1.0022, silver: 1.0037 };

/** Applied only when MCX is unavailable and we must derive from international spot. */
export interface DutyConfig {
  importDutyPercent: number;
  gstPercent: number;
}

export const DEFAULT_DUTY: DutyConfig = { importDutyPercent: 6, gstPercent: 3 };

export const GOLD_KARATS = [24, 22, 20, 18, 16, 14, 12, 10] as const;
export const SILVER_PURITIES = [
  { key: '999', purity: 0.999, label: 'Fine' },
  { key: '925', purity: 0.925, label: 'Sterling' },
  { key: '900', purity: 0.9, label: 'Coin' },
  { key: '800', purity: 0.8, label: 'German' },
] as const;

export type RateBasis = 'mcx' | 'derived-spot';

export interface IndiaRate {
  metal: 'gold' | 'silver';
  basis: RateBasis;
  /** Reference price per gram in INR at full purity, before purity scaling. */
  perGramPure: number;
  purities: {
    key: string;
    label: string;
    purity: number;
    perGram: number;
    per10Gram: number;
    per100Gram: number;
    perKilogram: number;
    perOunce: number;
    perTola: number;
  }[];
  sources: string[];
  note: string;
}

function scale(perGramPure: number, purity: number) {
  const perGram = perGramPure * purity;
  return {
    perGram,
    per10Gram: perGram * 10,
    per100Gram: perGram * 100,
    perKilogram: perGram * 1000,
    perOunce: perGram * GRAMS_PER_TROY_OZ,
    perTola: perGram * 11.6638, // 1 tola = 11.6638 g
  };
}

function goldRate(perGramPure: number, basis: RateBasis, sources: string[], note: string): IndiaRate {
  return {
    metal: 'gold',
    basis,
    perGramPure,
    purities: GOLD_KARATS.map((karat) => ({
      key: `${karat}K`,
      label: `Gold ${karat} Karat`,
      purity: karat / 24,
      ...scale(perGramPure, karat / 24),
    })),
    sources,
    note,
  };
}

function silverRate(
  perGramPure: number,
  basis: RateBasis,
  sources: string[],
  note: string
): IndiaRate {
  return {
    metal: 'silver',
    basis,
    perGramPure,
    purities: SILVER_PURITIES.map((p) => ({
      key: p.key,
      label: `Silver ${p.key} ${p.label}`,
      purity: p.purity,
      ...scale(perGramPure, p.purity),
    })),
    sources,
    note,
  };
}

/** Converts an international spot quote (USD/oz) into an INR per-gram landed cost. */
function fromSpot(spotUsdPerOz: number, usdInr: number, duty: DutyConfig): number {
  const inrPerGram = (spotUsdPerOz * usdInr) / GRAMS_PER_TROY_OZ;
  return inrPerGram * (1 + duty.importDutyPercent / 100) * (1 + duty.gstPercent / 100);
}

/**
 * Builds Indian retail rate tables. Prefers MCX futures; falls back to
 * spot-plus-duty when MCX is missing, flagging which basis was used so the UI
 * can label the number honestly.
 */
export function buildIndiaRates(
  quotes: Map<string, Quote>,
  duty: DutyConfig = DEFAULT_DUTY
): { gold: IndiaRate | null; silver: IndiaRate | null } {
  const mcxGold = quotes.get('MCX:GOLD1!');
  const mcxSilver = quotes.get('MCX:SILVER1!');
  const spotGold = quotes.get('TVC:GOLD');
  const spotSilver = quotes.get('TVC:SILVER');
  const usdInr = quotes.get('FX_IDC:USDINR');

  let gold: IndiaRate | null = null;
  let silver: IndiaRate | null = null;

  if (mcxGold) {
    // MCX gold is quoted in INR per 10 grams.
    gold = goldRate(
      (mcxGold.price / 10) * MCX_TO_RETAIL_PREMIUM.gold,
      'mcx',
      ['MCX:GOLD1!'],
      'Derived from MCX gold futures plus the typical association premium. Indicative, not an official bullion association rate.'
    );
  } else if (spotGold && usdInr) {
    gold = goldRate(
      fromSpot(spotGold.price, usdInr.price, duty),
      'derived-spot',
      ['TVC:GOLD', 'FX_IDC:USDINR'],
      `Derived from international spot with ${duty.importDutyPercent}% import duty and ${duty.gstPercent}% GST. MCX unavailable, so this is an approximation.`
    );
  }

  if (mcxSilver) {
    // MCX silver is quoted in INR per kilogram.
    silver = silverRate(
      (mcxSilver.price / 1000) * MCX_TO_RETAIL_PREMIUM.silver,
      'mcx',
      ['MCX:SILVER1!'],
      'Derived from MCX silver futures plus the typical association premium. Indicative, not an official bullion association rate.'
    );
  } else if (spotSilver && usdInr) {
    silver = silverRate(
      fromSpot(spotSilver.price, usdInr.price, duty),
      'derived-spot',
      ['TVC:SILVER', 'FX_IDC:USDINR'],
      `Derived from international spot with ${duty.importDutyPercent}% import duty and ${duty.gstPercent}% GST. MCX unavailable, so this is an approximation.`
    );
  }

  return { gold, silver };
}
