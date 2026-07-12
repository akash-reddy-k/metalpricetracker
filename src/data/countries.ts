import type { CountryTaxConfig, PurityOption, MetalType, CurrencyType } from '../types/metals';

export const COUNTRIES: CountryTaxConfig[] = [
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    importDuty: 0,
    vatGst: 6, // Average state sales tax on metals (ranges 0-10%)
    dealerPremium: 4.5,
    fixedMintFeePerOz: 2.5,
    flag: '🇺🇸',
  },
  {
    code: 'IN',
    name: 'India',
    currency: 'INR',
    importDuty: 15.0, // High custom duty on precious metals
    vatGst: 3.0,     // GST on gold and silver in India is 3%
    dealerPremium: 2.5,
    fixedMintFeePerOz: 1.5,
    flag: '🇮🇳',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    importDuty: 0,
    vatGst: 20, // 20% standard VAT, but Gold is exempt (handled in formula)
    dealerPremium: 5.0,
    fixedMintFeePerOz: 3.0,
    flag: '🇬🇧',
  },
  {
    code: 'DE',
    name: 'Germany',
    currency: 'EUR',
    importDuty: 0,
    vatGst: 19, // 19% standard VAT, Gold is exempt (handled in formula)
    dealerPremium: 4.0,
    fixedMintFeePerOz: 2.8,
    flag: '🇩🇪',
  },
  {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    importDuty: 0,
    vatGst: 0, // Investment grade precious metals are exempt from GST/HST
    dealerPremium: 5.2,
    fixedMintFeePerOz: 3.2,
    flag: '🇨🇦',
  },
  {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    importDuty: 0,
    vatGst: 0, // Investment-grade metals are GST-free
    dealerPremium: 4.8,
    fixedMintFeePerOz: 2.9,
    flag: '🇦🇺',
  },
  {
    code: 'JP',
    name: 'Japan',
    currency: 'JPY',
    importDuty: 0,
    vatGst: 10, // 10% consumption tax applies to all metals
    dealerPremium: 3.5,
    fixedMintFeePerOz: 2.0,
    flag: '🇯🇵',
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    currency: 'AED',
    importDuty: 5, // 5% tariff on jewelry, but investment metals are 0%
    vatGst: 5,     // 5% VAT (investment gold is exempt)
    dealerPremium: 2.0,
    fixedMintFeePerOz: 1.2,
    flag: '🇦🇪',
  },
  {
    code: 'CH',
    name: 'Switzerland',
    currency: 'CHF',
    importDuty: 0,
    vatGst: 8.1, // 8.1% VAT (standard rate, gold is exempt)
    dealerPremium: 3.8,
    fixedMintFeePerOz: 2.5,
    flag: '🇨🇭',
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
  const exemptCountries = ['GB', 'DE', 'CH', 'CA', 'AU', 'AE'];
  return exemptCountries.includes(countryCode);
}
