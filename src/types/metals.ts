export type MetalType = 'gold' | 'silver' | 'platinum' | 'palladium';

export type CurrencyType = 'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'CAD' | 'AUD' | 'AED' | 'CHF';

export type WeightUnit = 'oz' | 'g' | 'kg';

export interface PurityOption {
  value: number; // 0.0 to 1.0 representation of purity
  label: string; // e.g. "24K (99.9%)", "22K (91.6%)", "Ster. (92.5%)"
}

export interface CountryTaxConfig {
  code: string;
  name: string;
  currency: CurrencyType;
  importDuty: number; // Percentage (e.g. 15 for 15%)
  vatGst: number; // Percentage (e.g. 18 for 18% GST/VAT)
  dealerPremium: number; // Percentage (e.g. 3.5 for 3.5% average premium)
  fixedMintFeePerOz: number; // Fixed fee in USD per oz
  flag: string; // emoji representation of the flag
  defaultWeight?: number;
  defaultUnit?: WeightUnit;
}

export interface SpotPrices {
  gold: number; // per oz in USD
  silver: number; // per oz in USD
  platinum: number; // per oz in USD
  palladium: number; // per oz in USD
  timestamp: number; // UNIX epoch ms
}

export interface HistoricalPricePoint {
  timestamp: number; // UNIX epoch ms
  prices: {
    gold: number;
    silver: number;
    platinum: number;
    palladium: number;
  };
}

export interface CalculationResult {
  metal: MetalType;
  weight: number;
  weightUnit: WeightUnit;
  purity: number;
  purityLabel: string;
  currency: CurrencyType;
  spotPricePerOzUSD: number;
  spotPricePerOzTarget: number;
  weightInOz: number;
  baseSpotValue: number; // raw spot price of weight in target currency
  rawMetalValue: number; // adjusted for purity: spotPriceTotal * purity
  importDutyValue: number;
  makingChargesValue: number;
  vatGstValue: number;
  dealerPremiumValue: number;
  finalPrice: number;
  exchangeRate: number; // relative to USD (1 USD = X target currency)
}
