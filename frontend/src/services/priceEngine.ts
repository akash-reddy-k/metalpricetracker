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

export const GRAMS_PER_TROY_OZ = 31.1034768;

// Convert prices between ounces, grams, and other popular weight units
export const WEIGHT_CONVERSIONS: Record<WeightUnit, number> = {
  oz: 1,
  g: 1 / GRAMS_PER_TROY_OZ,
  kg: 32.1507466,
  // Traditional (BIS) tola, the unit Indian bullion associations quote against.
  // Not the 10 g "metric tola" some modern mints stamp on bars.
  tola: 11.6638 / GRAMS_PER_TROY_OZ,
  tael: 37.5 / GRAMS_PER_TROY_OZ, // Chinese Tael (37.5g)
  baht: 15.244 / GRAMS_PER_TROY_OZ, // Thai Baht (15.244g)
  mesghal: 4.6083 / GRAMS_PER_TROY_OZ, // Iranian Mesghal (4.6083g)
  dwt: 0.05, // Pennyweight (exactly 1/20 of troy oz)
};

export function getPricePerUnit(pricePerOz: number, unit: WeightUnit): number {
  return pricePerOz * WEIGHT_CONVERSIONS[unit];
}
