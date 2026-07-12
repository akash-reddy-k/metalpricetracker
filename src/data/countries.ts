import type { CountryTaxConfig, PurityOption, MetalType, CurrencyType, WeightUnit } from '../types/metals';

// Helper to load ENV variable or return default fallback
const getEnvNum = (key: string, fallback: number): number => {
  const val = import.meta.env[key];
  return val !== undefined && val !== '' ? parseFloat(val) : fallback;
};

const getEnvStr = (key: string, fallback: string): string => {
  return import.meta.env[key] || fallback;
};

export const COUNTRIES: CountryTaxConfig[] = [
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    importDuty: getEnvNum('VITE_COUNTRY_US_IMPORT_DUTY', 0),
    vatGst: getEnvNum('VITE_COUNTRY_US_VAT_GST', 6),
    dealerPremium: 0,
    fixedMintFeePerOz: 0,
    flag: '🇺🇸',
    defaultWeight: getEnvNum('VITE_COUNTRY_US_DEFAULT_WEIGHT', 1),
    defaultUnit: getEnvStr('VITE_COUNTRY_US_DEFAULT_UNIT', 'oz') as WeightUnit,
  },
  {
    code: 'IN',
    name: 'India',
    currency: 'INR',
    importDuty: getEnvNum('VITE_COUNTRY_IN_IMPORT_DUTY', 15.0),
    vatGst: getEnvNum('VITE_COUNTRY_IN_VAT_GST', 3.0),
    dealerPremium: 0,
    fixedMintFeePerOz: 0,
    flag: '🇮🇳',
    defaultWeight: getEnvNum('VITE_COUNTRY_IN_DEFAULT_WEIGHT', 10),
    defaultUnit: getEnvStr('VITE_COUNTRY_IN_DEFAULT_UNIT', 'g') as WeightUnit,
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    importDuty: getEnvNum('VITE_COUNTRY_GB_IMPORT_DUTY', 0),
    vatGst: getEnvNum('VITE_COUNTRY_GB_VAT_GST', 20),
    dealerPremium: 0,
    fixedMintFeePerOz: 0,
    flag: '🇬🇧',
    defaultWeight: getEnvNum('VITE_COUNTRY_GB_DEFAULT_WEIGHT', 1),
    defaultUnit: getEnvStr('VITE_COUNTRY_GB_DEFAULT_UNIT', 'oz') as WeightUnit,
  },
  {
    code: 'DE',
    name: 'Germany',
    currency: 'EUR',
    importDuty: getEnvNum('VITE_COUNTRY_DE_IMPORT_DUTY', 0),
    vatGst: getEnvNum('VITE_COUNTRY_DE_VAT_GST', 19),
    dealerPremium: 0,
    fixedMintFeePerOz: 0,
    flag: '🇩🇪',
    defaultWeight: getEnvNum('VITE_COUNTRY_DE_DEFAULT_WEIGHT', 1),
    defaultUnit: getEnvStr('VITE_COUNTRY_DE_DEFAULT_UNIT', 'oz') as WeightUnit,
  },
  {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    importDuty: getEnvNum('VITE_COUNTRY_CA_IMPORT_DUTY', 0),
    vatGst: getEnvNum('VITE_COUNTRY_CA_VAT_GST', 0),
    dealerPremium: 0,
    fixedMintFeePerOz: 0,
    flag: '🇨🇦',
    defaultWeight: getEnvNum('VITE_COUNTRY_CA_DEFAULT_WEIGHT', 1),
    defaultUnit: getEnvStr('VITE_COUNTRY_CA_DEFAULT_UNIT', 'oz') as WeightUnit,
  },
  {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    importDuty: getEnvNum('VITE_COUNTRY_AU_IMPORT_DUTY', 0),
    vatGst: getEnvNum('VITE_COUNTRY_AU_VAT_GST', 0),
    dealerPremium: 0,
    fixedMintFeePerOz: 0,
    flag: '🇦🇺',
    defaultWeight: getEnvNum('VITE_COUNTRY_AU_DEFAULT_WEIGHT', 1),
    defaultUnit: getEnvStr('VITE_COUNTRY_AU_DEFAULT_UNIT', 'oz') as WeightUnit,
  },
  {
    code: 'JP',
    name: 'Japan',
    currency: 'JPY',
    importDuty: getEnvNum('VITE_COUNTRY_JP_IMPORT_DUTY', 0),
    vatGst: getEnvNum('VITE_COUNTRY_JP_VAT_GST', 10),
    dealerPremium: 0,
    fixedMintFeePerOz: 0,
    flag: '🇯🇵',
    defaultWeight: getEnvNum('VITE_COUNTRY_JP_DEFAULT_WEIGHT', 1),
    defaultUnit: getEnvStr('VITE_COUNTRY_JP_DEFAULT_UNIT', 'oz') as WeightUnit,
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    currency: 'AED',
    importDuty: getEnvNum('VITE_COUNTRY_AE_IMPORT_DUTY', 5),
    vatGst: getEnvNum('VITE_COUNTRY_AE_VAT_GST', 5),
    dealerPremium: 0,
    fixedMintFeePerOz: 0,
    flag: '🇦🇪',
    defaultWeight: getEnvNum('VITE_COUNTRY_AE_DEFAULT_WEIGHT', 1),
    defaultUnit: getEnvStr('VITE_COUNTRY_AE_DEFAULT_UNIT', 'oz') as WeightUnit,
  },
  {
    code: 'CH',
    name: 'Switzerland',
    currency: 'CHF',
    importDuty: getEnvNum('VITE_COUNTRY_CH_IMPORT_DUTY', 0),
    vatGst: getEnvNum('VITE_COUNTRY_CH_VAT_GST', 8.1),
    dealerPremium: 0,
    fixedMintFeePerOz: 0,
    flag: '🇨🇭',
    defaultWeight: getEnvNum('VITE_COUNTRY_CH_DEFAULT_WEIGHT', 1),
    defaultUnit: getEnvStr('VITE_COUNTRY_CH_DEFAULT_UNIT', 'oz') as WeightUnit,
  }
];

export const PURITY_OPTIONS: Record<MetalType, PurityOption[]> = {
  gold: [
    { value: 0.999, label: '24K (99.9% - Fine)' },
    { value: 0.916, label: '22K (91.6% - Crown Gold)' },
    { value: 0.750, label: '18K (75.0% - Standard)' },
    { value: 0.583, label: '14K (58.3%)' },
    { value: 0.417, label: '10K (41.7%)' }
  ],
  silver: [
    { value: 0.999, label: 'Fine Silver (99.9%)' },
    { value: 0.958, label: 'Britannia Silver (95.8%)' },
    { value: 0.925, label: 'Sterling Silver (92.5%)' },
    { value: 0.900, label: 'Coin Silver (90.0%)' }
  ],
  platinum: [
    { value: 0.999, label: 'Fine Platinum (99.9%)' },
    { value: 0.950, label: 'Platinum 950 (95.0%)' },
    { value: 0.900, label: 'Platinum 900 (90.0%)' }
  ],
  palladium: [
    { value: 0.999, label: 'Fine Palladium (99.9%)' },
    { value: 0.950, label: 'Palladium 950 (95.0%)' }
  ]
};

export const EXCHANGE_RATES: Record<CurrencyType, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  INR: 95.0,
  JPY: 155.0,
  CAD: 1.36,
  AUD: 1.50,
  AED: 3.67,
  CHF: 0.90
};

export const CURRENCY_SYMBOLS: Record<CurrencyType, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  AED: 'د.إ',
  CHF: 'CHF'
};

// Returns whether Gold is VAT exempt in a country (EU standard + UK + CH + UAE + CA + AU)
export function isGoldVatExempt(countryCode: string): boolean {
  const exemptCountries = [];
  return exemptCountries.includes(countryCode);
}
