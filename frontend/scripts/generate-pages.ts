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
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${DOMAIN}${canonicalPath}">
<meta property="og:type" content="article">
<meta property="og:url" content="${DOMAIN}${canonicalPath}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${DOMAIN}/og-image.png">
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
    <a href="${DOMAIN}/blogs" style="color:#94a3b8;text-decoration:none;font-size:13px;font-weight:600;padding:6px 12px;border-radius:6px;">Blogs</a>
    <a href="${DOMAIN}/tips" style="color:#94a3b8;text-decoration:none;font-size:13px;font-weight:600;padding:6px 12px;border-radius:6px;">Tips</a>
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
  const canonicalPath = `/${country.slug}/${metal}`;

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
    .map(m => `<li><a href="/${country.slug}/${m}">${METAL_LABEL[m]} Price in ${country.name}</a></li>`)
    .join('\n          ');
  const otherCountries = COUNTRIES.filter(c => c.slug !== country.slug).slice(0, 6)
    .map(c => {
      const cp = calcPrice(c, metal);
      return `<li><a href="/${c.slug}/${metal}">${c.flag} ${metalLabel} in ${c.name} — ${c.symbol}${fmt(cp.totalPerUnit, c.currency)}/${c.displayUnitLabel}</a></li>`;
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

  // Replace noscript with route-specific SEO content
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>${noscriptContent}\n    </noscript>`);

  return html;
}

// ── Country overview page ─────────────────────────────────────────────────────

function buildCountryPage(country: Country): string {
  const canonicalPath = `/${country.slug}`;
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
    return `<a href="${DOMAIN}/${country.slug}/${metal}" style="text-decoration:none;">
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
      <td><a href="${DOMAIN}/${country.slug}/${metal}" style="color:${METAL_COLOR[metal]}">${METAL_LABEL[metal]}</a></td>
      <td>$${fmt(p.spotUSD, 'USD')}/oz</td>
      <td>${country.symbol}${fmt(p.spotPerUnit, country.currency)}</td>
      <td>${p.importDutyPct}%</td>
      <td>${p.vatGstPct}%</td>
      <td style="font-weight:600">${country.symbol}${fmt(p.totalPerUnit, country.currency)}</td>
    </tr>`
  ).join('');

  const countryLinks = COUNTRIES
    .filter(c => c.slug !== country.slug)
    .map(c => `<a href="${DOMAIN}/${c.slug}" class="pill">${c.flag} ${c.name}</a>`)
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

// ── Main ──────────────────────────────────────────────────────────────────────

const sitemapUrls: Array<{ loc: string; priority: string; changefreq: string }> = [
  { loc: DOMAIN + '/', priority: '1.0', changefreq: 'always' },
  { loc: DOMAIN + '/blogs/', priority: '0.7', changefreq: 'weekly' },
  { loc: DOMAIN + '/tips/', priority: '0.6', changefreq: 'monthly' },
];

let pageCount = 0;

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
  }
}

write(path.join(DIST, 'sitemap.xml'), buildSitemap(sitemapUrls));
console.log(`✓ Generated ${pageCount} pages and sitemap.xml (${sitemapUrls.length} URLs)`);
