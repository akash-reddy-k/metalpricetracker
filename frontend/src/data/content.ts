import type { MetalType } from '../types/metals';

export interface InvestmentTip {
  metal: MetalType | 'general';
  title: string;
  body: string;
}

// Educational tips on how precious-metal investing works. Static, evergreen content.
export const INVESTMENT_TIPS: InvestmentTip[] = [
  {
    metal: 'general',
    title: 'Spot price is only the starting point',
    body: 'The quoted international spot price is the raw metal value. What you actually pay adds import duty, local VAT/GST, and a dealer or minting premium. Always compare the all-in local price, not just spot.',
  },
  {
    metal: 'gold',
    title: 'Purity changes value proportionally',
    body: 'Gold is sold at different finenesses — 24K (99.9%), 22K (91.6%), 18K (75%). A 22K piece is worth roughly 91.6% of the pure-gold value of the same weight, before making charges. Jewellery premiums vary widely; coins and bars carry the lowest markup.',
  },
  {
    metal: 'silver',
    title: 'Silver is volatile and industrial',
    body: 'Silver moves more sharply than gold because half its demand is industrial (electronics, solar). It offers higher upside but larger drawdowns — size positions accordingly and expect wider price swings.',
  },
  {
    metal: 'platinum',
    title: 'Platinum tracks the auto cycle',
    body: 'Platinum and palladium demand is driven by catalytic converters. Prices react to vehicle production and the shift to EVs. They can diverge sharply from gold, so treat them as separate bets rather than gold substitutes.',
  },
  {
    metal: 'general',
    title: 'Bullion vs. jewellery for investment',
    body: 'For pure investment exposure, bullion coins and bars minimise premium and, in some countries, qualify for VAT exemption. Jewellery carries fabrication (making) charges you rarely recover on resale.',
  },
  {
    metal: 'general',
    title: 'Cost-average, do not time the top',
    body: 'Precious metals are a long-horizon hedge against inflation and currency risk. Buying a fixed amount at regular intervals smooths out volatility better than trying to catch a single low.',
  },
];

