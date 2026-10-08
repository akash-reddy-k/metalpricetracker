#!/usr/bin/env tsx
// Post-build script — run after `vite build`. Writes static SEO landing pages
// into dist/ and generates sitemap.xml. Cloudflare Pages serves static files
// before the /* → /index.html SPA redirect, so these pages win the race.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dir, '../dist');
const DOMAIN = 'https://metalprices.online';
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// ── Static data (mirrors src/data but without import.meta.env) ───────────────

const SPOT = { gold: 4603.0, silver: 68.94, platinum: 1877.0, palladium: 1344.0 };
const TROY_OZ_PER_GRAM = 1 / 31.1034768;
type Metal = 'gold' | 'silver' | 'platinum' | 'palladium';
const METALS: Metal[] = ['gold', 'silver', 'platinum', 'palladium'];

const METAL_LABEL: Record<Metal, string> = {
  gold: 'Gold', silver: 'Silver', platinum: 'Platinum', palladium: 'Palladium',
};
const METAL_SYMBOL: Record<Metal, string> = {
  gold: 'XAU', silver: 'XAG', platinum: 'XPT', palladium: 'XPD',
};
const METAL_COLOR: Record<Metal, string> = {
  gold: '#F59E0B', silver: '#9CA3AF', platinum: '#38BDF8', palladium: '#A78BFA',
};

interface City {
  slug: string;
  name: string;
  /** Short local context line shown on the page, e.g. "home to the Zaveri Bazaar gold market". */
  context: string;
}

interface Country {
  code: string;
  slug: string;
  name: string;
  currency: string;
  symbol: string;
  flag: string;
  rate: number;
  displayUnit: 'oz' | 'g';
  displayUnitLabel: string;
  unitMultiplier: number; // oz → displayUnit
  taxes: Record<Metal, { importDuty: number; vatGst: number }>;
  taxNote: string;
  cities?: City[];
}

const COUNTRIES: Country[] = [
  {
    code: 'IN', slug: 'india', name: 'India', currency: 'INR', symbol: '₹', flag: '🇮🇳',
    rate: 95.0, displayUnit: 'g', displayUnitLabel: 'gram', unitMultiplier: TROY_OZ_PER_GRAM,
    taxes: {
      gold:      { importDuty: 15.0, vatGst: 3.0  },
      silver:    { importDuty: 15.0, vatGst: 3.0  },
      platinum:  { importDuty: 15.4, vatGst: 18.0 },
      palladium: { importDuty: 15.0, vatGst: 18.0 },
    },
    taxNote: 'India charges 15% basic customs duty plus 3% GST on gold and silver. Platinum and palladium attract 15.4% duty and 18% GST — among the highest precious-metals tax rates in the world.',
    cities: [
      { slug: 'mumbai', name: 'Mumbai', context: 'home to the Zaveri Bazaar gold market, India\'s largest bullion trading hub' },
      { slug: 'delhi', name: 'Delhi', context: 'home to Dariba Kalan and Chandni Chowk, North India\'s primary gold trading centres' },
      { slug: 'chennai', name: 'Chennai', context: 'a major South Indian gold market where jewellery demand peaks during the Tamil wedding season' },
      { slug: 'bangalore', name: 'Bangalore', context: 'Karnataka\'s tech capital with strong retail gold demand and multiple MMTC outlets' },
      { slug: 'kolkata', name: 'Kolkata', context: 'home to Bowbazar, Eastern India\'s oldest and largest jewellery district' },
      { slug: 'hyderabad', name: 'Hyderabad', context: 'known for Laad Bazaar and Pot Market, Telangana\'s traditional gold trading centres' },
      { slug: 'ahmedabad', name: 'Ahmedabad', context: 'Gujarat\'s commercial capital and a major centre for gold jewellery manufacturing' },
      { slug: 'jaipur', name: 'Jaipur', context: 'Rajasthan\'s Pink City, renowned for traditional Kundan and Meenakari gold jewellery' },
      { slug: 'pune', name: 'Pune', context: 'Maharashtra\'s second-largest gold market after Mumbai with strong wedding-season demand' },
      { slug: 'lucknow', name: 'Lucknow', context: 'Uttar Pradesh\'s capital and a traditional market for gold and Chikan jewellery' },
      { slug: 'kochi', name: 'Kochi', context: 'Kerala\'s commercial hub where gold demand is among the highest per capita in India' },
      { slug: 'coimbatore', name: 'Coimbatore', context: 'a leading South Indian gold retail centre with high per-capita jewellery ownership' },
    ],
  },
  {
    code: 'AE', slug: 'united-arab-emirates', name: 'United Arab Emirates', currency: 'AED', symbol: 'د.إ', flag: '🇦🇪',
    rate: 3.67, displayUnit: 'g', displayUnitLabel: 'gram', unitMultiplier: TROY_OZ_PER_GRAM,
    taxes: {
      gold:      { importDuty: 5, vatGst: 5 },
      silver:    { importDuty: 5, vatGst: 5 },
      platinum:  { importDuty: 5, vatGst: 5 },
      palladium: { importDuty: 5, vatGst: 5 },
    },
    taxNote: 'The UAE applies 5% import duty and 5% VAT on all precious metals. Dubai\'s Gold Souk is one of the world\'s largest retail gold markets, with relatively low taxes compared to India or Europe.',
    cities: [
      { slug: 'dubai', name: 'Dubai', context: 'home to the Gold Souk in Deira, one of the world\'s largest retail gold markets by volume' },
      { slug: 'abu-dhabi', name: 'Abu Dhabi', context: 'the UAE capital with growing gold retail demand and the Madinat Zayed gold centre' },
      { slug: 'sharjah', name: 'Sharjah', context: 'the Gold Souk in Sharjah\'s Blue Souk offers competitive prices alongside Dubai' },
    ],
  },
  {
    code: 'US', slug: 'united-states', name: 'United States', currency: 'USD', symbol: '$', flag: '🇺🇸',
    rate: 1.0, displayUnit: 'oz', displayUnitLabel: 'troy oz', unitMultiplier: 1,
    taxes: {
      gold:      { importDuty: 0, vatGst: 6 },
      silver:    { importDuty: 0, vatGst: 6 },
      platinum:  { importDuty: 0, vatGst: 6 },
      palladium: { importDuty: 0, vatGst: 6 },
    },
    taxNote: 'The US charges no federal import duty on precious metals. Sales tax (shown here at the average 6%) varies by state — many states fully exempt investment-grade bullion.',
    cities: [
      { slug: 'new-york', name: 'New York', context: 'home to the COMEX exchange and the Federal Reserve Bank gold vault, the centre of global gold trading' },
      { slug: 'los-angeles', name: 'Los Angeles', context: 'California\'s largest bullion market with numerous dealers along the Jewelry District downtown' },
      { slug: 'chicago', name: 'Chicago', context: 'home to the CME Group that operates COMEX gold and silver futures' },
      { slug: 'houston', name: 'Houston', context: 'Texas\'s largest city where investment-grade bullion is sales-tax exempt' },
      { slug: 'dallas', name: 'Dallas', context: 'a major Texas bullion hub where gold and silver purchases are exempt from state sales tax' },
    ],
  },
  {
    code: 'GB', slug: 'united-kingdom', name: 'United Kingdom', currency: 'GBP', symbol: '£', flag: '🇬🇧',
    rate: 0.78, displayUnit: 'oz', displayUnitLabel: 'troy oz', unitMultiplier: 1,
    taxes: {
      gold:      { importDuty: 0, vatGst: 20 },
      silver:    { importDuty: 0, vatGst: 20 },
      platinum:  { importDuty: 0, vatGst: 20 },
      palladium: { importDuty: 0, vatGst: 20 },
    },
    taxNote: 'The UK charges 20% VAT on silver, platinum, and palladium. Investment gold coins and bars meeting HMRC criteria are VAT-exempt.',
    cities: [
      { slug: 'london', name: 'London', context: 'home to the LBMA that sets the global gold price benchmark twice daily' },
      { slug: 'birmingham', name: 'Birmingham', context: 'the Jewellery Quarter is the UK\'s historic centre of gold manufacturing and hallmarking' },
      { slug: 'manchester', name: 'Manchester', context: 'Northern England\'s largest bullion retail market' },
    ],
  },
  {
    code: 'DE', slug: 'germany', name: 'Germany', currency: 'EUR', symbol: '€', flag: '🇩🇪',
    rate: 0.92, displayUnit: 'g', displayUnitLabel: 'gram', unitMultiplier: TROY_OZ_PER_GRAM,
    taxes: {
      gold:      { importDuty: 0, vatGst: 19 },
      silver:    { importDuty: 0, vatGst: 19 },
      platinum:  { importDuty: 0, vatGst: 19 },
      palladium: { importDuty: 0, vatGst: 19 },
    },
    taxNote: 'Germany charges 19% VAT on silver, platinum, and palladium. EU investment gold of 99.5%+ purity is VAT-exempt under EU Directive 1998/80/EC.',
    cities: [
      { slug: 'frankfurt', name: 'Frankfurt', context: 'Germany\'s financial capital and home to the Deutsche Börse commodities exchange' },
      { slug: 'munich', name: 'Munich', context: 'Bavaria\'s capital with a strong tradition of gold investment and coin collecting' },
      { slug: 'berlin', name: 'Berlin', context: 'Germany\'s capital with growing retail bullion demand' },
    ],
  },
  {
    code: 'CA', slug: 'canada', name: 'Canada', currency: 'CAD', symbol: 'C$', flag: '🇨🇦',
    rate: 1.36, displayUnit: 'oz', displayUnitLabel: 'troy oz', unitMultiplier: 1,
    taxes: {
      gold:      { importDuty: 0, vatGst: 0 },
      silver:    { importDuty: 0, vatGst: 0 },
      platinum:  { importDuty: 0, vatGst: 0 },
      palladium: { importDuty: 0, vatGst: 0 },
    },
    taxNote: 'Canada exempts investment-grade precious metals from GST/HST with no import duties — one of the most tax-efficient bullion markets globally.',
    cities: [
      { slug: 'toronto', name: 'Toronto', context: 'Canada\'s financial capital and home to the Toronto Stock Exchange' },
      { slug: 'vancouver', name: 'Vancouver', context: 'a gateway for Pacific gold trade and home to many mining company headquarters' },
    ],
  },
  {
    code: 'AU', slug: 'australia', name: 'Australia', currency: 'AUD', symbol: 'A$', flag: '🇦🇺',
    rate: 1.5, displayUnit: 'oz', displayUnitLabel: 'troy oz', unitMultiplier: 1,
    taxes: {
      gold:      { importDuty: 0, vatGst: 0 },
      silver:    { importDuty: 0, vatGst: 0 },
      platinum:  { importDuty: 0, vatGst: 0 },
      palladium: { importDuty: 0, vatGst: 0 },
    },
    taxNote: 'Australia exempts investment-grade precious metals from GST and import duties. The Perth Mint is one of the world\'s largest gold refineries.',
    cities: [
      { slug: 'sydney', name: 'Sydney', context: 'Australia\'s financial centre and largest bullion retail market' },
      { slug: 'melbourne', name: 'Melbourne', context: 'home to the ABC Refinery and a strong coin-collecting community' },
      { slug: 'perth', name: 'Perth', context: 'home to the Perth Mint, one of the world\'s largest and oldest gold refineries' },
    ],
  },
  {
    code: 'JP', slug: 'japan', name: 'Japan', currency: 'JPY', symbol: '¥', flag: '🇯🇵',
    rate: 155.0, displayUnit: 'g', displayUnitLabel: 'gram', unitMultiplier: TROY_OZ_PER_GRAM,
    taxes: {
      gold:      { importDuty: 0, vatGst: 10 },
      silver:    { importDuty: 0, vatGst: 10 },
      platinum:  { importDuty: 0, vatGst: 10 },
      palladium: { importDuty: 0, vatGst: 10 },
    },
    taxNote: 'Japan charges 10% consumption tax on all precious metals with no import duty. The Tokyo Commodity Exchange (TOCOM) is the main price reference.',
    cities: [
      { slug: 'tokyo', name: 'Tokyo', context: 'home to the Tokyo Commodity Exchange (TOCOM), Japan\'s primary gold futures market' },
      { slug: 'osaka', name: 'Osaka', context: 'Japan\'s second-largest gold market with a long history of precious metals trading' },
    ],
  },
  {
    code: 'CH', slug: 'switzerland', name: 'Switzerland', currency: 'CHF', symbol: 'CHF', flag: '🇨🇭',
    rate: 0.9, displayUnit: 'g', displayUnitLabel: 'gram', unitMultiplier: TROY_OZ_PER_GRAM,
    taxes: {
      gold:      { importDuty: 0, vatGst: 8.1 },
      silver:    { importDuty: 0, vatGst: 8.1 },
      platinum:  { importDuty: 0, vatGst: 8.1 },
      palladium: { importDuty: 0, vatGst: 8.1 },
    },
    taxNote: 'Switzerland charges 8.1% VAT on precious metals with no import duty. It is home to major refineries including PAMP and Valcambi.',
    cities: [
      { slug: 'zurich', name: 'Zurich', context: 'Switzerland\'s financial centre and a global hub for gold refining, storage, and trading' },
      { slug: 'geneva', name: 'Geneva', context: 'home to private banking vaults and a centre for physical gold custody services' },
    ],
  },
  {
    code: 'CN', slug: 'china', name: 'China', currency: 'CNY', symbol: '元', flag: '🇨🇳',
    rate: 7.25, displayUnit: 'g', displayUnitLabel: 'gram', unitMultiplier: TROY_OZ_PER_GRAM,
    taxes: {
      gold:      { importDuty: 0, vatGst: 13 },
      silver:    { importDuty: 0, vatGst: 13 },
      platinum:  { importDuty: 0, vatGst: 13 },
      palladium: { importDuty: 0, vatGst: 13 },
    },
    taxNote: 'China charges 13% VAT on precious metals. The Shanghai Gold Exchange (SGE) is the world\'s largest physical gold exchange by volume.',
    cities: [
      { slug: 'shanghai', name: 'Shanghai', context: 'home to the Shanghai Gold Exchange (SGE), the world\'s largest physical gold exchange' },
      { slug: 'beijing', name: 'Beijing', context: 'China\'s capital with strong retail gold demand during Spring Festival and wedding seasons' },
      { slug: 'shenzhen', name: 'Shenzhen', context: 'China\'s gold jewellery manufacturing capital, producing over 70% of the country\'s gold jewellery' },
    ],
  },
  {
    code: 'RU', slug: 'russia', name: 'Russia', currency: 'RUB', symbol: '₽', flag: '🇷🇺',
    rate: 90.0, displayUnit: 'g', displayUnitLabel: 'gram', unitMultiplier: TROY_OZ_PER_GRAM,
    taxes: {
      gold:      { importDuty: 0, vatGst: 20 },
      silver:    { importDuty: 0, vatGst: 20 },
      platinum:  { importDuty: 0, vatGst: 20 },
      palladium: { importDuty: 0, vatGst: 20 },
    },
    taxNote: 'Russia charges 20% VAT on precious metals. Russia is the world\'s largest palladium producer and a top-five gold producer.',
  },
  {
    code: 'ID', slug: 'indonesia', name: 'Indonesia', currency: 'IDR', symbol: 'Rp', flag: '🇮🇩',
    rate: 16200.0, displayUnit: 'g', displayUnitLabel: 'gram', unitMultiplier: TROY_OZ_PER_GRAM,
    taxes: {
      gold:      { importDuty: 7.5, vatGst: 11 },
      silver:    { importDuty: 7.5, vatGst: 11 },
      platinum:  { importDuty: 7.5, vatGst: 11 },
      palladium: { importDuty: 7.5, vatGst: 11 },
    },
    taxNote: 'Indonesia charges 7.5% import duty and 11% VAT on precious metals. Antam (PT Aneka Tambang) is the state-owned gold producer and refiner.',
    cities: [
      { slug: 'jakarta', name: 'Jakarta', context: 'Indonesia\'s capital and largest gold retail market, home to the Antam refinery' },
    ],
  },
  {
    code: 'ZA', slug: 'south-africa', name: 'South Africa', currency: 'ZAR', symbol: 'R', flag: '🇿🇦',
    rate: 18.5, displayUnit: 'oz', displayUnitLabel: 'troy oz', unitMultiplier: 1,
    taxes: {
      gold:      { importDuty: 0, vatGst: 15 },
      silver:    { importDuty: 0, vatGst: 15 },
      platinum:  { importDuty: 0, vatGst: 15 },
      palladium: { importDuty: 0, vatGst: 15 },
    },
    taxNote: 'South Africa charges 15% VAT on precious metals. It is the world\'s largest producer of platinum-group metals and historically the largest gold producer.',
    cities: [
      { slug: 'johannesburg', name: 'Johannesburg', context: 'South Africa\'s gold capital, built on the Witwatersrand gold reef and home to the Rand Refinery' },
      { slug: 'cape-town', name: 'Cape Town', context: 'the Western Cape\'s primary bullion retail market and home to the South African Mint' },
    ],
  },
];

// ── Price calculation ─────────────────────────────────────────────────────────

interface PriceBreakdown {
  spotUSD: number;
  spotLocal: number;
  spotPerUnit: number;
  importDutyAmt: number;
  vatAmt: number;
  totalPerUnit: number;
  importDutyPct: number;
  vatGstPct: number;
}

function calcPrice(country: Country, metal: Metal): PriceBreakdown {
  const { importDuty, vatGst } = country.taxes[metal];
  const spotUSD = SPOT[metal];
  const spotLocal = spotUSD * country.rate;
  const spotPerUnit = spotLocal * country.unitMultiplier;
  const importDutyAmt = spotPerUnit * (importDuty / 100);
  const vatBase = spotPerUnit + importDutyAmt;
  const vatAmt = vatBase * (vatGst / 100);
  const totalPerUnit = spotPerUnit + importDutyAmt + vatAmt;
  return { spotUSD, spotLocal, spotPerUnit, importDutyAmt, vatAmt, totalPerUnit, importDutyPct: importDuty, vatGstPct: vatGst };
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(value: number, currency: string): string {
  const decimals = ['JPY', 'IDR', 'RUB'].includes(currency) ? 0 : 2;
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── Shared inline CSS ─────────────────────────────────────────────────────────

const SHARED_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #09090f;
    color: #e2e8f0;
    line-height: 1.6;
  }
  a { color: #60a5fa; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .wrapper { max-width: 860px; margin: 0 auto; padding: 0 20px 60px; }
  nav.breadcrumb {
    padding: 16px 0 8px;
    font-size: 13px;
    color: #64748b;
  }
  nav.breadcrumb a { color: #64748b; }
  nav.breadcrumb a:hover { color: #94a3b8; }
  nav.breadcrumb span { margin: 0 6px; }
  header.page-header {
    padding: 32px 0 24px;
    border-bottom: 1px solid #1e293b;
    margin-bottom: 32px;
  }
  header.page-header h1 {
    font-size: clamp(22px, 4vw, 32px);
    font-weight: 700;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
  }
  header.page-header .subtitle {
    font-size: 14px;
    color: #64748b;
  }
  .price-highlight {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    padding: 24px 28px;
    margin-bottom: 24px;
  }
  .price-highlight .label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px; }
  .price-highlight .amount { font-size: clamp(28px, 5vw, 40px); font-weight: 700; }
  .price-highlight .per { font-size: 15px; color: #94a3b8; margin-left: 4px; }
  .price-highlight .spot-note { font-size: 12px; color: #475569; margin-top: 6px; }
  .breakdown {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 24px;
  }
  .breakdown h2 { font-size: 15px; font-weight: 600; padding: 16px 20px; border-bottom: 1px solid #1e293b; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .breakdown table { width: 100%; border-collapse: collapse; }
  .breakdown td { padding: 12px 20px; font-size: 14px; border-bottom: 1px solid #1e293b; }
  .breakdown tr:last-child td { border-bottom: none; }
  .breakdown td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .breakdown tr.total td { font-weight: 700; font-size: 16px; background: #111827; }
  .breakdown tr.total td:last-child { color: #10b981; }
  .tax-note {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-left: 3px solid #3b82f6;
    border-radius: 0 8px 8px 0;
    padding: 14px 18px;
    font-size: 14px;
    color: #94a3b8;
    margin-bottom: 32px;
  }
  .nav-section { margin-bottom: 32px; }
  .nav-section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin-bottom: 12px; }
  .nav-pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill {
    display: inline-block;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    border: 1px solid #1e293b;
    color: #94a3b8;
    transition: border-color 0.15s, color 0.15s;
  }
  .pill:hover { border-color: #3b82f6; color: #60a5fa; text-decoration: none; }
  .pill.active { border-color: var(--metal-color, #F59E0B); color: var(--metal-color, #F59E0B); }
  .cta-box {
    background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
    border: 1px solid #2563eb44;
    border-radius: 12px;
    padding: 28px;
    text-align: center;
    margin-bottom: 32px;
  }
  .cta-box h2 { font-size: 18px; margin-bottom: 8px; }
  .cta-box p { font-size: 14px; color: #94a3b8; margin-bottom: 20px; }
  .cta-btn {
    display: inline-block;
    padding: 12px 32px;
    background: #2563eb;
    color: #fff;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    transition: background 0.15s;
  }
  .cta-btn:hover { background: #1d4ed8; text-decoration: none; }
  .country-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-bottom: 32px; }
  .country-card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .country-card .flag { font-size: 22px; }
  .country-card .country-name { font-size: 13px; font-weight: 600; }
  .country-card .country-price { font-size: 12px; color: #64748b; font-variant-numeric: tabular-nums; }
  footer.page-footer {
    border-top: 1px solid #1e293b;
    padding: 24px 0 0;
    font-size: 12px;
    color: #475569;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }
`;

// ── Page builder helpers ──────────────────────────────────────────────────────

function head(title: string, description: string, canonicalPath: string, jsonLd: object[]): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="${DOMAIN}${canonicalPath}">
<meta property="og:type" content="website">
<meta property="og:url" content="${DOMAIN}${canonicalPath}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${DOMAIN}/og-image.png">
<meta property="og:site_name" content="MetalPrices.online">
<meta property="twitter:card" content="summary_large_image">
<meta property="twitter:title" content="${title}">
<meta property="twitter:description" content="${description}">
<meta property="twitter:image" content="${DOMAIN}/og-image.png">
${jsonLd.map(ld => `<script type="application/ld+json">${JSON.stringify(ld, null, 2)}</script>`).join('\n')}
<style>${SHARED_CSS}</style>
</head>
<body>`;
}

function siteHeader(): string {
  return `<div style="background:#0a0a0f;border-bottom:1px solid #1e293b;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
  <a href="${DOMAIN}" style="color:#e2e8f0;font-weight:700;font-size:16px;text-decoration:none;">MetalPrices.Online</a>
  <nav style="display:flex;gap:6px;align-items:center;">
    <a href="${DOMAIN}/" style="color:#94a3b8;text-decoration:none;font-size:13px;font-weight:600;padding:6px 12px;border-radius:6px;background:rgba(255,255,255,0.06);">Home</a>
    <a href="${DOMAIN}/blogs/" style="color:#94a3b8;text-decoration:none;font-size:13px;font-weight:600;padding:6px 12px;border-radius:6px;">Blogs</a>
    <a href="${DOMAIN}/tips/" style="color:#94a3b8;text-decoration:none;font-size:13px;font-weight:600;padding:6px 12px;border-radius:6px;">Tips</a>
  </nav>
</div>`;
}

function crossLinks(currentCountry?: Country, currentMetal?: Metal): string {
  const links: string[] = [];
  // Link to a few other popular country+metal combos
  const popularSlugs = ['india', 'united-states', 'united-arab-emirates', 'united-kingdom', 'germany'];
  for (const slug of popularSlugs) {
    const c = COUNTRIES.find(co => co.slug === slug);
    if (!c || (c.slug === currentCountry?.slug && !currentMetal)) continue;
    for (const m of METALS) {
      if (c.slug === currentCountry?.slug && m === currentMetal) continue;
      links.push(`<a href="${DOMAIN}/${c.slug}/${m}/" style="color:#60a5fa;text-decoration:none;font-size:12px;">${c.flag} ${METAL_LABEL[m]} in ${c.name}</a>`);
    }
  }
  if (links.length === 0) return '';
  return `<div style="margin-top:28px;padding-top:20px;border-top:1px solid #1e293b;">
    <h3 style="font-size:14px;color:#94a3b8;margin-bottom:10px;">Explore More Prices</h3>
    <div style="display:flex;flex-wrap:wrap;gap:8px 16px;">${links.slice(0, 16).join('')}</div>
  </div>`;
}

function foot(): string {
  return `<footer class="page-footer">
  <span>© 2026 MetalPrices.Online — Prices are indicative, updated at build time. For live rates use the <a href="${DOMAIN}">main app</a>.</span>
  <span>Data sourced from TradingView market feeds.</span>
</footer>`;
}

// ── Metal+Country page (SPA shell) ───────────────────────────────────────────

function buildMetalPage(country: Country, metal: Metal): string {
  const p = calcPrice(country, metal);
  const metalLabel = METAL_LABEL[metal];
  const metalSym = METAL_SYMBOL[metal];
  const unitLabel = country.displayUnitLabel;
  const sym = country.symbol;

  const title = `${metalLabel} Price in ${country.name} Today | ${sym}${fmt(p.totalPerUnit, country.currency)}/${unitLabel} | MetalPrices.Online`;
  const description = `${country.flag} Live ${metalLabel.toLowerCase()} price in ${country.name}: ${sym}${fmt(p.spotPerUnit, country.currency)}/${unitLabel} spot + ${p.importDutyPct}% duty + ${p.vatGstPct}% VAT = ${sym}${fmt(p.totalPerUnit, country.currency)}/${unitLabel} total. Free tax calculator.`;
  const canonicalPath = `/${country.slug}/${metal}/`;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: DOMAIN },
      { '@type': 'ListItem', position: 2, name: country.name, item: `${DOMAIN}/${country.slug}` },
      { '@type': 'ListItem', position: 3, name: metalLabel, item: `${DOMAIN}${canonicalPath}` },
    ],
  };

  const financialLd = {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: `${metalLabel} Spot Price in ${country.name}`,
    description: `Live ${metalLabel.toLowerCase()} (${metalSym}) spot price in ${country.currency} with ${country.name} import duty and VAT breakdown`,
    url: `${DOMAIN}${canonicalPath}`,
    provider: { '@type': 'Organization', name: 'MetalPrices.Online', url: DOMAIN },
  };

  const jsonLdBlock = [breadcrumbLd, financialLd]
    .map(ld => `<script type="application/ld+json">${JSON.stringify(ld, null, 2)}</script>`)
    .join('\n');

  // Build route-specific noscript content for SEO crawlers
  const otherMetals = METALS.filter(m => m !== metal)
    .map(m => `<li><a href="/${country.slug}/${m}/">${METAL_LABEL[m]} Price in ${country.name}</a></li>`)
    .join('\n          ');
  const otherCountries = COUNTRIES.filter(c => c.slug !== country.slug).slice(0, 6)
    .map(c => {
      const cp = calcPrice(c, metal);
      return `<li><a href="/${c.slug}/${metal}/">${c.flag} ${metalLabel} in ${c.name} — ${c.symbol}${fmt(cp.totalPerUnit, c.currency)}/${c.displayUnitLabel}</a></li>`;
    })
    .join('\n          ');

  const noscriptContent = `
      <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px;">
        <h1>${metalLabel} Price in ${country.name} Today</h1>
        <p>
          ${country.flag} Live ${metalLabel.toLowerCase()} (${metalSym}) spot price in ${country.currency}
          with import duty and tax breakdown for ${country.name}.
        </p>

        <h2>${metalLabel} Price Breakdown (${country.currency})</h2>
        <ul>
          <li>International Spot Price: $${fmt(p.spotUSD, 'USD')} per troy ounce</li>
          <li>Spot in ${country.currency}: ${sym}${fmt(p.spotPerUnit, country.currency)} per ${unitLabel}</li>
          <li>Import Duty (${p.importDutyPct}%): +${sym}${fmt(p.importDutyAmt, country.currency)}</li>
          <li>VAT/GST (${p.vatGstPct}%): +${sym}${fmt(p.vatAmt, country.currency)}</li>
          <li><strong>Total Duty-Paid Price: ${sym}${fmt(p.totalPerUnit, country.currency)} per ${unitLabel}</strong></li>
        </ul>

        <p>${country.taxNote}</p>

        <h2>Other Metals in ${country.name}</h2>
        <ul>
          ${otherMetals}
        </ul>

        ${(country.cities ?? []).length > 0 ? `<h2>${metalLabel} Price by City in ${country.name}</h2>
        <ul>
          ${(country.cities ?? []).map(c => `<li><a href="/${country.slug}/${metal}/${c.slug}/">${metalLabel} Price in ${c.name}</a></li>`).join('\n          ')}
        </ul>` : ''}

        <h2>${metalLabel} Price in Other Countries</h2>
        <ul>
          ${otherCountries}
        </ul>

        <p><a href="/">Back to MetalPrices.online — Live Precious Metal Prices</a></p>
        <p><strong>Note:</strong> Please enable JavaScript for the full live price experience with real-time updates.</p>
      </div>`;

  // Clone the SPA template and customise SEO tags for this route
  let html = SPA_TEMPLATE;

  // <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);

  // meta name="title"
  html = html.replace(/<meta name="title"[^>]*>/, `<meta name="title" content="${escapeHtml(title)}" />`);

  // meta name="description" (may span multiple lines in the source HTML)
  html = html.replace(/<meta\s+name="description"[\s\S]*?>/, `<meta name="description" content="${escapeHtml(description)}" />`);

  // canonical URL
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${DOMAIN}${canonicalPath}" />`);

  // Open Graph
  html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${DOMAIN}${canonicalPath}" />`);
  html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta\s+property="og:description"[\s\S]*?>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);

  // Twitter Card
  html = html.replace(/<meta property="twitter:url"[^>]*>/, `<meta property="twitter:url" content="${DOMAIN}${canonicalPath}" />`);
  html = html.replace(/<meta property="twitter:title"[^>]*>/, `<meta property="twitter:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta\s+property="twitter:description"[\s\S]*?>/, `<meta property="twitter:description" content="${escapeHtml(description)}" />`);

  // Remove all existing JSON-LD, inject route-specific blocks before </head>
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  html = html.replace('</head>', `${jsonLdBlock}\n</head>`);

  // Replace static HTML inside <div id="root"> with route-specific SEO content.
  // React's createRoot().render() will replace this when the SPA mounts,
  // but Googlebot sees real content on its first (HTML-only) crawl pass.
  // Use a greedy match with anchor to capture the entire #root div including nested divs.
  const rootOpen = html.indexOf('<div id="root">');
  if (rootOpen !== -1) {
    // Find the matching closing </div> by counting nesting depth
    const afterOpen = rootOpen + '<div id="root">'.length;
    let depth = 1;
    let i = afterOpen;
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) {
          html = html.substring(0, afterOpen) + noscriptContent + '\n    ' + html.substring(nextClose);
          break;
        }
        i = nextClose + 6;
      }
    }
  }

  return html;
}

// ── Helper: replace #root content in SPA template ───────────────────────────

function replaceRootContent(html: string, newContent: string): string {
  const rootOpen = html.indexOf('<div id="root">');
  if (rootOpen === -1) return html;
  const afterOpen = rootOpen + '<div id="root">'.length;
  let depth = 1;
  let i = afterOpen;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) {
        return html.substring(0, afterOpen) + newContent + '\n    ' + html.substring(nextClose);
      }
      i = nextClose + 6;
    }
  }
  return html;
}

/** Replace SEO meta tags in an SPA template clone. */
function patchSpaTemplate(opts: {
  title: string; description: string; canonicalPath: string; jsonLdBlock: string; noscriptContent: string;
}): string {
  let html = SPA_TEMPLATE;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(opts.title)}</title>`);
  html = html.replace(/<meta name="title"[^>]*>/, `<meta name="title" content="${escapeHtml(opts.title)}" />`);
  html = html.replace(/<meta\s+name="description"[\s\S]*?>/, `<meta name="description" content="${escapeHtml(opts.description)}" />`);
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${DOMAIN}${opts.canonicalPath}" />`);
  html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${DOMAIN}${opts.canonicalPath}" />`);
  html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(opts.title)}" />`);
  html = html.replace(/<meta\s+property="og:description"[\s\S]*?>/, `<meta property="og:description" content="${escapeHtml(opts.description)}" />`);
  html = html.replace(/<meta property="twitter:url"[^>]*>/, `<meta property="twitter:url" content="${DOMAIN}${opts.canonicalPath}" />`);
  html = html.replace(/<meta property="twitter:title"[^>]*>/, `<meta property="twitter:title" content="${escapeHtml(opts.title)}" />`);
  html = html.replace(/<meta\s+property="twitter:description"[\s\S]*?>/, `<meta property="twitter:description" content="${escapeHtml(opts.description)}" />`);
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  html = html.replace('</head>', `${opts.jsonLdBlock}\n</head>`);
  html = replaceRootContent(html, opts.noscriptContent);
  return html;
}

// ── City+Metal page (SPA shell) ─────────────────────────────────────────────

function buildCityPage(country: Country, metal: Metal, city: City): string {
  const p = calcPrice(country, metal);
  const metalLabel = METAL_LABEL[metal];
  const metalSym = METAL_SYMBOL[metal];
  const unitLabel = country.displayUnitLabel;
  const sym = country.symbol;
  const canonicalPath = `/${country.slug}/${metal}/${city.slug}/`;

  const title = `${metalLabel} Price in ${city.name} Today | ${sym}${fmt(p.totalPerUnit, country.currency)}/${unitLabel} | MetalPrices.Online`;
  const description = `${country.flag} Live ${metalLabel.toLowerCase()} price in ${city.name}, ${country.name}: ${sym}${fmt(p.spotPerUnit, country.currency)}/${unitLabel} spot + ${p.importDutyPct}% duty + ${p.vatGstPct}% VAT/GST = ${sym}${fmt(p.totalPerUnit, country.currency)}/${unitLabel}. ${city.name} is ${city.context}.`;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: DOMAIN },
      { '@type': 'ListItem', position: 2, name: country.name, item: `${DOMAIN}/${country.slug}/` },
      { '@type': 'ListItem', position: 3, name: `${metalLabel} in ${country.name}`, item: `${DOMAIN}/${country.slug}/${metal}/` },
      { '@type': 'ListItem', position: 4, name: city.name, item: `${DOMAIN}${canonicalPath}` },
    ],
  };

  const financialLd = {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: `${metalLabel} Spot Price in ${city.name}, ${country.name}`,
    description: `Live ${metalLabel.toLowerCase()} (${metalSym}) spot price in ${city.name} in ${country.currency} with ${country.name} import duty and VAT breakdown`,
    url: `${DOMAIN}${canonicalPath}`,
    areaServed: { '@type': 'City', name: city.name, containedInPlace: { '@type': 'Country', name: country.name } },
    provider: { '@type': 'Organization', name: 'MetalPrices.Online', url: DOMAIN },
  };

  const jsonLdBlock = [breadcrumbLd, financialLd]
    .map(ld => `<script type="application/ld+json">${JSON.stringify(ld, null, 2)}</script>`)
    .join('\n');

  // Other cities in this country for this metal
  const otherCities = (country.cities ?? []).filter(c => c.slug !== city.slug)
    .map(c => `<li><a href="/${country.slug}/${metal}/${c.slug}/">${metalLabel} Price in ${c.name}</a></li>`)
    .join('\n          ');

  // Other metals in this city
  const otherMetals = METALS.filter(m => m !== metal)
    .map(m => `<li><a href="/${country.slug}/${m}/${city.slug}/">${METAL_LABEL[m]} Price in ${city.name}</a></li>`)
    .join('\n          ');

  // Cross-links to popular country+metal pages
  const popularCountryLinks = COUNTRIES.filter(c => c.slug !== country.slug).slice(0, 4)
    .map(c => {
      const cp = calcPrice(c, metal);
      return `<li><a href="/${c.slug}/${metal}/">${c.flag} ${metalLabel} in ${c.name} — ${c.symbol}${fmt(cp.totalPerUnit, c.currency)}/${c.displayUnitLabel}</a></li>`;
    })
    .join('\n          ');

  const noscriptContent = `
      <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px;">
        <h1>${metalLabel} Price in ${city.name} Today</h1>
        <p>
          ${country.flag} Live ${metalLabel.toLowerCase()} (${metalSym}) price in ${city.name}, ${country.name}
          — ${city.context}. Prices include ${country.name}'s import duty and VAT/GST.
        </p>

        <h2>${metalLabel} Price Breakdown in ${city.name} (${country.currency})</h2>
        <ul>
          <li>International Spot Price: $${fmt(p.spotUSD, 'USD')} per troy ounce</li>
          <li>Spot in ${country.currency}: ${sym}${fmt(p.spotPerUnit, country.currency)} per ${unitLabel}</li>
          <li>Import Duty (${p.importDutyPct}%): +${sym}${fmt(p.importDutyAmt, country.currency)}</li>
          <li>VAT/GST (${p.vatGstPct}%): +${sym}${fmt(p.vatAmt, country.currency)}</li>
          <li><strong>Total Duty-Paid Price: ${sym}${fmt(p.totalPerUnit, country.currency)} per ${unitLabel}</strong></li>
        </ul>

        <p>${country.taxNote}</p>

        <h2>About ${metalLabel} in ${city.name}</h2>
        <p>
          ${city.name} is ${city.context}. The ${metalLabel.toLowerCase()} price in ${city.name} follows
          ${country.name}'s national rate plus local dealer premiums. The price shown above is the
          calculated landed cost based on the international spot price converted to ${country.currency}
          with ${country.name}'s import duty (${p.importDutyPct}%) and VAT/GST (${p.vatGstPct}%) applied.
        </p>

        ${otherCities ? `<h2>${metalLabel} in Other ${country.name} Cities</h2>
        <ul>
          ${otherCities}
        </ul>` : ''}

        <h2>Other Metals in ${city.name}</h2>
        <ul>
          ${otherMetals}
        </ul>

        <h2>${metalLabel} Price in Other Countries</h2>
        <ul>
          ${popularCountryLinks}
        </ul>

        <p><a href="/${country.slug}/${metal}/">${metalLabel} Price in ${country.name} — National Overview</a></p>
        <p><a href="/">Back to MetalPrices.online — Live Precious Metal Prices</a></p>
      </div>`;

  return patchSpaTemplate({ title, description, canonicalPath, jsonLdBlock, noscriptContent });
}

// ── Country overview page ─────────────────────────────────────────────────────

function buildCountryPage(country: Country): string {
  const canonicalPath = `/${country.slug}/`;
  const allPrices = METALS.map(m => ({ metal: m, p: calcPrice(country, m) }));

  const title = `Precious Metal Prices in ${country.name} Today | MetalPrices.Online`;
  const description = `Live gold, silver, platinum and palladium prices in ${country.name} (${country.currency}) including ${country.name} import duties and VAT. Updated ${BUILD_DATE}.`;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: DOMAIN },
      { '@type': 'ListItem', position: 2, name: country.name, item: `${DOMAIN}${canonicalPath}` },
    ],
  };

  const cards = allPrices.map(({ metal, p }) => {
    const color = METAL_COLOR[metal];
    return `<a href="${DOMAIN}/${country.slug}/${metal}/" style="text-decoration:none;">
      <div class="country-card" style="border-color:${color}22;">
        <div class="flag" style="font-size:26px;">${METAL_LABEL[metal][0]}</div>
        <div class="country-name" style="color:${color}">${METAL_LABEL[metal]}</div>
        <div class="country-price">${country.symbol}${fmt(p.totalPerUnit, country.currency)} / ${country.displayUnitLabel}</div>
        <div class="country-price" style="color:#374151;">incl. ${p.importDutyPct}% duty + ${p.vatGstPct}% VAT</div>
      </div>
    </a>`;
  }).join('');

  const breakdown = allPrices.map(({ metal, p }) =>
    `<tr>
      <td><a href="${DOMAIN}/${country.slug}/${metal}/" style="color:${METAL_COLOR[metal]}">${METAL_LABEL[metal]}</a></td>
      <td>$${fmt(p.spotUSD, 'USD')}/oz</td>
      <td>${country.symbol}${fmt(p.spotPerUnit, country.currency)}</td>
      <td>${p.importDutyPct}%</td>
      <td>${p.vatGstPct}%</td>
      <td style="font-weight:600">${country.symbol}${fmt(p.totalPerUnit, country.currency)}</td>
    </tr>`
  ).join('');

  const countryLinks = COUNTRIES
    .filter(c => c.slug !== country.slug)
    .map(c => `<a href="${DOMAIN}/${c.slug}/" class="pill">${c.flag} ${c.name}</a>`)
    .join('');

  return `${head(title, description, canonicalPath, [breadcrumbLd])}
${siteHeader()}
<div class="wrapper">
  <nav class="breadcrumb" aria-label="breadcrumb">
    <a href="${DOMAIN}">Home</a><span>›</span>
    <span>${country.flag} ${country.name}</span>
  </nav>

  <header class="page-header">
    <h1>${country.flag} Precious Metal Prices in ${country.name} Today</h1>
    <p class="subtitle">Spot prices in ${country.currency} with ${country.name} import duty and VAT · ${BUILD_DATE}</p>
  </header>

  <div class="country-grid">${cards}</div>

  <div class="breakdown">
    <h2>Full Comparison — All Metals</h2>
    <table>
      <thead>
        <tr style="border-bottom:1px solid #1e293b">
          <td style="font-size:12px;color:#475569;padding:10px 20px">Metal</td>
          <td style="font-size:12px;color:#475569;padding:10px 20px">Spot (USD/oz)</td>
          <td style="font-size:12px;color:#475569;padding:10px 20px">In ${country.currency}/${country.displayUnitLabel}</td>
          <td style="font-size:12px;color:#475569;padding:10px 20px">Import Duty</td>
          <td style="font-size:12px;color:#475569;padding:10px 20px">VAT/GST</td>
          <td style="font-size:12px;color:#475569;padding:10px 20px">Total/${country.displayUnitLabel}</td>
        </tr>
      </thead>
      <tbody>${breakdown}</tbody>
    </table>
  </div>

  <div class="tax-note">ℹ️ ${country.taxNote}</div>

  <div class="cta-box">
    <h2>Live prices auto-detected for your location</h2>
    <p>The app detects your country via IP and shows duty-inclusive prices in your local currency — updated every minute from TradingView.</p>
    <a href="${DOMAIN}" class="cta-btn">Open Live Calculator →</a>
  </div>

  <div class="nav-section">
    <h2>Prices in other countries</h2>
    <div class="nav-pills">${countryLinks}</div>
  </div>

  ${crossLinks(country)}
  ${foot()}
</div>
</body></html>`;
}

// ── Sitemap ───────────────────────────────────────────────────────────────────

function buildSitemap(urls: Array<{ loc: string; priority: string; changefreq: string }>): string {
  const entries = urls.map(u => `
  <url>
    <loc>${u.loc}</loc>
    <lastmod>${BUILD_DATE}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}
</urlset>`;
}

// ── Write helpers ─────────────────────────────────────────────────────────────

function write(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// ── SPA shell template ───────────────────────────────────────────────────────
// Metal+country pages are served as the built SPA with route-specific SEO tags.
// Cloudflare serves these static files, the SPA boots, and React Router renders
// the correct MetalPage component — identical experience to client-side nav.

const SPA_TEMPLATE = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Blogs page (SPA shell) ──────────────────────────────────────────────────

function buildBlogsPage(): string {
  const title = 'Weekly Precious Metals Market Reports | MetalPrices.Online';
  const description = 'Weekly market analysis and reports covering gold, silver, platinum, and palladium price movements, central bank policy, and investment insights.';
  const canonicalPath = '/blogs/';

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: DOMAIN },
      { '@type': 'ListItem', position: 2, name: 'Blogs', item: `${DOMAIN}${canonicalPath}` },
    ],
  };

  const jsonLdBlock = `<script type="application/ld+json">${JSON.stringify(breadcrumbLd, null, 2)}</script>`;

  const noscriptContent = `
      <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #e2e8f0;">
        <h1>Weekly Precious Metals Market Reports</h1>
        <p style="color: #94a3b8;">Our take on what moved gold, silver, platinum, and palladium each week.</p>

        <h2>Gold holds firm as rate-cut bets build — Aug 24, 2026</h2>
        <p style="color: #94a3b8;">Gold consolidated near record territory this week as softer inflation data strengthened expectations of a rate cut, while silver outperformed on industrial demand.</p>

        <h2>Dollar strength caps precious metals — Aug 17, 2026</h2>
        <p style="color: #94a3b8;">A firmer dollar and rising yields capped gains across the complex, though physical demand in Asia provided a floor under gold.</p>

        <h2>Explore Prices</h2>
        <ul>
          <li><a href="/" style="color: #60a5fa;">Live Precious Metal Prices</a></li>
          <li><a href="/india/gold/" style="color: #60a5fa;">Gold Price in India</a></li>
          <li><a href="/united-states/gold/" style="color: #60a5fa;">Gold Price in USA</a></li>
          <li><a href="/tips/" style="color: #60a5fa;">Investment Tips &amp; Guides</a></li>
        </ul>
      </div>`;

  let html = SPA_TEMPLATE;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(/<meta name="title"[^>]*>/, `<meta name="title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta\s+name="description"[\s\S]*?>/, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${DOMAIN}${canonicalPath}" />`);
  html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${DOMAIN}${canonicalPath}" />`);
  html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta\s+property="og:description"[\s\S]*?>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = html.replace(/<meta property="twitter:url"[^>]*>/, `<meta property="twitter:url" content="${DOMAIN}${canonicalPath}" />`);
  html = html.replace(/<meta property="twitter:title"[^>]*>/, `<meta property="twitter:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta\s+property="twitter:description"[\s\S]*?>/, `<meta property="twitter:description" content="${escapeHtml(description)}" />`);

  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  html = html.replace('</head>', `${jsonLdBlock}\n</head>`);

  // Replace root div content
  const rootOpen = html.indexOf('<div id="root">');
  if (rootOpen !== -1) {
    const afterOpen = rootOpen + '<div id="root">'.length;
    let depth = 1;
    let i = afterOpen;
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) {
          html = html.substring(0, afterOpen) + noscriptContent + '\n    ' + html.substring(nextClose);
          break;
        }
        i = nextClose + 6;
      }
    }
  }

  return html;
}

// ── Tips page (SPA shell) ───────────────────────────────────────────────────

function buildTipsPage(): string {
  const title = 'Precious Metal Investment Tips & Guides | MetalPrices.Online';
  const description = 'Learn how precious metal investing works: spot vs. local price, purity and karats, bullion vs. jewellery, and dollar-cost averaging strategies for gold, silver, platinum, and palladium.';
  const canonicalPath = '/tips/';

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: DOMAIN },
      { '@type': 'ListItem', position: 2, name: 'Investment Tips', item: `${DOMAIN}${canonicalPath}` },
    ],
  };

  const jsonLdBlock = `<script type="application/ld+json">${JSON.stringify(breadcrumbLd, null, 2)}</script>`;

  const noscriptContent = `
      <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #e2e8f0;">
        <h1>How Precious-Metal Investing Works</h1>
        <p style="color: #94a3b8;">Quick primers on pricing, purity, and strategy before you buy.</p>

        <h2>Spot price is only the starting point</h2>
        <p style="color: #94a3b8;">The quoted international spot price is the raw metal value. What you actually pay adds import duty, local VAT/GST, and a dealer or minting premium. Always compare the all-in local price, not just spot.</p>

        <h2>Purity changes value proportionally</h2>
        <p style="color: #94a3b8;">Gold is sold at different finenesses — 24K (99.9%), 22K (91.6%), 18K (75%). A 22K piece is worth roughly 91.6% of the pure-gold value of the same weight, before making charges.</p>

        <h2>Silver is volatile and industrial</h2>
        <p style="color: #94a3b8;">Silver moves more sharply than gold because half its demand is industrial (electronics, solar). It offers higher upside but larger drawdowns.</p>

        <h2>Bullion vs. jewellery for investment</h2>
        <p style="color: #94a3b8;">For pure investment exposure, bullion coins and bars minimise premium and, in some countries, qualify for VAT exemption. Jewellery carries fabrication charges you rarely recover on resale.</p>

        <h2>Cost-average, do not time the top</h2>
        <p style="color: #94a3b8;">Precious metals are a long-horizon hedge against inflation and currency risk. Buying a fixed amount at regular intervals smooths out volatility.</p>

        <h2>Explore Prices</h2>
        <ul>
          <li><a href="/" style="color: #60a5fa;">Live Precious Metal Prices</a></li>
          <li><a href="/india/gold/" style="color: #60a5fa;">Gold Price in India</a></li>
          <li><a href="/united-states/gold/" style="color: #60a5fa;">Gold Price in USA</a></li>
          <li><a href="/blogs/" style="color: #60a5fa;">Weekly Market Reports</a></li>
        </ul>
      </div>`;

  let html = SPA_TEMPLATE;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(/<meta name="title"[^>]*>/, `<meta name="title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta\s+name="description"[\s\S]*?>/, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${DOMAIN}${canonicalPath}" />`);
  html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${DOMAIN}${canonicalPath}" />`);
  html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta\s+property="og:description"[\s\S]*?>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = html.replace(/<meta property="twitter:url"[^>]*>/, `<meta property="twitter:url" content="${DOMAIN}${canonicalPath}" />`);
  html = html.replace(/<meta property="twitter:title"[^>]*>/, `<meta property="twitter:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta\s+property="twitter:description"[\s\S]*?>/, `<meta property="twitter:description" content="${escapeHtml(description)}" />`);

  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  html = html.replace('</head>', `${jsonLdBlock}\n</head>`);

  // Replace root div content
  const rootOpen = html.indexOf('<div id="root">');
  if (rootOpen !== -1) {
    const afterOpen = rootOpen + '<div id="root">'.length;
    let depth = 1;
    let i = afterOpen;
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) {
          html = html.substring(0, afterOpen) + noscriptContent + '\n    ' + html.substring(nextClose);
          break;
        }
        i = nextClose + 6;
      }
    }
  }

  return html;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const sitemapUrls: Array<{ loc: string; priority: string; changefreq: string }> = [
  { loc: DOMAIN + '/', priority: '1.0', changefreq: 'always' },
  { loc: DOMAIN + '/blogs/', priority: '0.7', changefreq: 'weekly' },
  { loc: DOMAIN + '/tips/', priority: '0.6', changefreq: 'monthly' },
];

let pageCount = 0;

// Generate Blogs and Tips SPA shell pages
write(path.join(DIST, 'blogs', 'index.html'), buildBlogsPage());
pageCount++;
write(path.join(DIST, 'tips', 'index.html'), buildTipsPage());
pageCount++;

for (const country of COUNTRIES) {
  // Country overview page
  write(path.join(DIST, country.slug, 'index.html'), buildCountryPage(country));
  sitemapUrls.push({ loc: `${DOMAIN}/${country.slug}/`, priority: '0.9', changefreq: 'daily' });
  pageCount++;

  // Metal detail pages
  for (const metal of METALS) {
    write(path.join(DIST, country.slug, metal, 'index.html'), buildMetalPage(country, metal));
    sitemapUrls.push({ loc: `${DOMAIN}/${country.slug}/${metal}/`, priority: '0.8', changefreq: 'daily' });
    pageCount++;

    // City-level pages
    for (const city of country.cities ?? []) {
      write(path.join(DIST, country.slug, metal, city.slug, 'index.html'), buildCityPage(country, metal, city));
      sitemapUrls.push({ loc: `${DOMAIN}/${country.slug}/${metal}/${city.slug}/`, priority: '0.7', changefreq: 'daily' });
      pageCount++;
    }
  }
}

write(path.join(DIST, 'sitemap.xml'), buildSitemap(sitemapUrls));
console.log(`✓ Generated ${pageCount} pages and sitemap.xml (${sitemapUrls.length} URLs)`);
