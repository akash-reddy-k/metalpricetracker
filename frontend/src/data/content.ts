import type { MetalType } from '../types/metals';

export interface InvestmentTip {
  metal: MetalType | 'general';
  title: string;
  body: string;
}

export interface WeeklyReport {
  slug: string;
  title: string;
  /** ISO date (YYYY-MM-DD) the report covers. */
  date: string;
  summary: string;
  /** Paragraphs of the full report body. */
  paragraphs: string[];
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

// Weekly market reports. Add new entries to the top; the newest is featured.
export const WEEKLY_REPORTS: WeeklyReport[] = [
  {
    slug: '2026-08-24-metals-weekly',
    title: 'Gold holds firm as rate-cut bets build',
    date: '2026-08-24',
    summary:
      'Gold consolidated near record territory this week as softer inflation data strengthened expectations of a rate cut, while silver outperformed on industrial demand.',
    paragraphs: [
      'Gold traded in a tight range through the week, underpinned by growing conviction that the next central-bank move is a cut. Real yields eased, keeping the opportunity cost of holding non-yielding metal low.',
      'Silver was the standout, gaining more than gold in percentage terms as solar and electronics demand stayed robust. The gold-to-silver ratio compressed, a pattern that historically favours silver in the later stage of a metals rally.',
      'Platinum and palladium were mixed. Platinum firmed on tightening supply from South Africa, while palladium stayed under pressure as EV adoption erodes long-run autocatalyst demand.',
      'For buyers: local premiums remained elevated in duty-heavy markets. Use the calculator above to compare the all-in cost across purities before committing.',
    ],
  },
  {
    slug: '2026-08-17-metals-weekly',
    title: 'Dollar strength caps precious metals',
    date: '2026-08-17',
    summary:
      'A firmer dollar and rising yields capped gains across the complex, though physical demand in Asia provided a floor under gold.',
    paragraphs: [
      'The metals complex spent the week on the back foot as the dollar index climbed and bond yields ticked higher, raising the opportunity cost of holding bullion.',
      'Despite the headwind, physical buying in India and China cushioned the decline. Festival-season demand typically lifts gold imports into the autumn, supporting local prices even when international spot softens.',
      'Industrial metals held up better than gold, with platinum supported by supply concerns. Investors continued to favour coins and bars over jewellery to minimise premium.',
    ],
  },
];
