import type { WeightUnit } from '../types/metals';

/**
 * Last-known spot prices in USD per troy ounce, shown only until the first live
 * quote arrives. Not a simulation: these are static and never tick.
 */
export const FALLBACK_SPOT_PRICES = {
  gold: 4603.0,
  silver: 68.94,
  platinum: 1877.0,
  palladium: 1344.0,
};

// Convert prices between ounces, grams, and other popular weight units
// 1 troy ounce = 31.1034768 grams
export const WEIGHT_CONVERSIONS: Record<WeightUnit, number> = {
  oz: 1,
  g: 1 / 31.1034768,
  kg: 32.1507466,
  tola: 10 / 31.1034768, // Metric Tola (10g)
  tael: 37.5 / 31.1034768, // Chinese Tael (37.5g)
  baht: 15.244 / 31.1034768, // Thai Baht (15.244g)
  mesghal: 4.6083 / 31.1034768, // Iranian Mesghal (4.6083g)
  dwt: 0.05, // Pennyweight (exactly 1/20 of troy oz)
};

export function getPricePerUnit(pricePerOz: number, unit: WeightUnit): number {
  return pricePerOz * WEIGHT_CONVERSIONS[unit];
}
