/**
 * generate-news.ts
 *
 * Automated weekly news article generator for MetalPrices.Online.
 * Runs every Sunday morning via GitHub Actions.
 *
 * Pipeline:
 *   1. Pull live prices for the four metals PLUS the macro drivers that move
 *      them — the US Dollar Index (DXY), the US 10-year Treasury yield (a proxy
 *      for interest rates), and WTI crude oil — straight from TradingView's
 *      public scanner (the same upstream the backend uses).
 *   2. Compute week-over-week changes against the previous article.
 *   3. Ask Google Gemini (free tier) to turn the numbers into a short, plain-
 *      English article a layman can understand: what moved, why, and what to
 *      watch. If Gemini is unavailable, fall back to a deterministic template.
 *   4. Write a structured article to src/data/news.json.
 *
 * Usage:  npx tsx scripts/generate-news.ts
 * Env:
 *   GEMINI_API_KEY   Google AI Studio key (free). If unset, uses the template.
 *   GEMINI_MODEL     Override model (default: gemini-2.0-flash).
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NEWS_FILE = resolve(__dirname, '../src/data/news.json');

const SCANNER_URL = 'https://scanner.tradingview.com/global/scan';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// ── Types ────────────────────────────────────────────────────────────────────

interface NewsArticle {
  slug: string;
  /** URL-safe slug derived from the title; used in the article's detail URL. */
  titleSlug: string;
  title: string;
  date: string; // YYYY-MM-DD
  summary: string;
  /** Long-form, in-depth body: a lede plus headed sections and key takeaways. */
  intro: string;
  sections: ArticleSection[];
  keyTakeaways: string[];
  /** Self-contained inline SVG performance chart, rendered on the detail page. */
  chartSvg: string;
  prices: {
    gold: number;
    silver: number;
    platinum: number;
    palladium: number;
  };
  /** Macro snapshot, stored so next week can compute week-over-week moves. */
  macro?: {
    dollarIndex: number;
    us10y: number;
    crude: number;
  };
}

interface ArticleSection {
  heading: string;
  paragraphs: string[];
}

interface ScanQuote {
  price: number;
  changePct: number; // daily change, %
}

type ArticleBody = Pick<NewsArticle, 'title' | 'summary' | 'intro' | 'sections' | 'keyTakeaways'>;

// ── Tickers ──────────────────────────────────────────────────────────────────

const METALS = ['gold', 'silver', 'platinum', 'palladium'] as const;
type Metal = (typeof METALS)[number];

const METAL_TICKERS: Record<Metal, string> = {
  gold: 'TVC:GOLD',
  silver: 'TVC:SILVER',
  platinum: 'TVC:PLATINUM',
  palladium: 'TVC:PALLADIUM',
};

const MACRO_TICKERS = {
  dollarIndex: 'TVC:DXY', // US Dollar Index — dollar strength
  us10y: 'TVC:US10Y', // US 10-year Treasury yield — interest-rate proxy
  crude: 'NYMEX:CL1!', // WTI crude oil futures — inflation signal
} as const;

// ── Scanner fetch ────────────────────────────────────────────────────────────

async function fetchScan(tickers: string[]): Promise<Record<string, ScanQuote>> {
  const res = await fetch(SCANNER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
    body: JSON.stringify({ symbols: { tickers }, columns: ['close', 'change'] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Scanner returned ${res.status}`);

  const body = (await res.json()) as { data?: { s: string; d: (number | string | null)[] }[] };
  if (!Array.isArray(body?.data)) throw new Error('Scanner response missing data array');

  const out: Record<string, ScanQuote> = {};
  for (const item of body.data) {
    if (!item?.s || !Array.isArray(item.d)) continue;
    const price = Number(item.d[0]);
    if (!Number.isFinite(price) || price <= 0) continue;
    out[item.s] = { price, changePct: Number(item.d[1]) || 0 };
  }
  return out;
}

// ── Formatting helpers (used by the template fallback) ───────────────────────

function formatUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function pctStr(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

/** URL-safe slug from a headline. Drops the "— Weekly Metals Roundup" tail. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[—–-]\s*weekly metals roundup\s*$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

function direction(pct: number): string {
  if (pct > 1) return 'surged';
  if (pct > 0.3) return 'gained';
  if (pct > 0) return 'edged higher';
  if (pct > -0.3) return 'edged lower';
  if (pct > -1) return 'declined';
  return 'fell sharply';
}

// ── Derived market data ──────────────────────────────────────────────────────

interface MarketData {
  metals: Record<Metal, { price: number; dayPct: number; weekPct: number | null }>;
  dollarIndex: { price: number; dayPct: number; weekPct: number | null };
  us10y: { price: number; dayPct: number; weekPct: number | null };
  crude: { price: number; dayPct: number; weekPct: number | null };
}

function wow(current: number, prev: number | undefined): number | null {
  if (prev === undefined || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function buildMarketData(
  quotes: Record<string, ScanQuote>,
  prev?: NewsArticle
): MarketData {
  const metals = {} as MarketData['metals'];
  for (const metal of METALS) {
    const q = quotes[METAL_TICKERS[metal]];
    if (!q) throw new Error(`Missing quote for ${metal} (${METAL_TICKERS[metal]})`);
    metals[metal] = {
      price: q.price,
      dayPct: q.changePct,
      weekPct: wow(q.price, prev?.prices?.[metal]),
    };
  }

  const dxy = quotes[MACRO_TICKERS.dollarIndex];
  const y10 = quotes[MACRO_TICKERS.us10y];
  const oil = quotes[MACRO_TICKERS.crude];
  if (!dxy || !y10 || !oil) throw new Error('Missing one or more macro quotes');

  return {
    metals,
    dollarIndex: { price: dxy.price, dayPct: dxy.changePct, weekPct: wow(dxy.price, prev?.macro?.dollarIndex) },
    us10y: { price: y10.price, dayPct: y10.changePct, weekPct: wow(y10.price, prev?.macro?.us10y) },
    crude: { price: oil.price, dayPct: oil.changePct, weekPct: wow(oil.price, prev?.macro?.crude) },
  };
}

// ── LLM generation (Gemini, free tier) ───────────────────────────────────────

function moveLabel(dayPct: number, weekPct: number | null): string {
  if (weekPct !== null) return `${pctStr(weekPct)} over the week`;
  return `${pctStr(dayPct)} on the day`;
}

function buildPrompt(d: MarketData): string {
  const m = d.metals;
  return `You are a financial journalist writing an IN-DEPTH weekly market explainer for a precious-metals price website. Your readers are everyday people — not traders — who want to truly understand what is happening in the world and get a feel for where gold and silver prices might head, both internationally and in their own country. This should read like a friendly teacher walking a beginner through the week.

THIS WEEK'S MARKET DATA (metal prices per troy ounce, in USD):
- Gold: ${formatUSD(m.gold.price)} (${moveLabel(m.gold.dayPct, m.gold.weekPct)})
- Silver: ${formatUSD(m.silver.price)} (${moveLabel(m.silver.dayPct, m.silver.weekPct)})
- Platinum: ${formatUSD(m.platinum.price)} (${moveLabel(m.platinum.dayPct, m.platinum.weekPct)})
- Palladium: ${formatUSD(m.palladium.price)} (${moveLabel(m.palladium.dayPct, m.palladium.weekPct)})

MACRO DRIVERS:
- US Dollar Index (DXY): ${d.dollarIndex.price.toFixed(2)} (${moveLabel(d.dollarIndex.dayPct, d.dollarIndex.weekPct)}). Higher = a stronger US dollar.
- US 10-Year Treasury Yield: ${d.us10y.price.toFixed(2)}% (${moveLabel(d.us10y.dayPct, d.us10y.weekPct)}). This is a proxy for interest rates.
- WTI Crude Oil: ${formatUSD(d.crude.price)} per barrel (${moveLabel(d.crude.dayPct, d.crude.weekPct)}).

WRITE THE ARTICLE. Requirements:
- Length: AT LEAST 1000 words across the intro and all sections combined. Be thorough and genuinely educational, not padded.
- Plain, simple English a layman understands. Whenever you use a term (e.g. "the dollar index", "Treasury yield", "safe-haven"), explain it in a few words the first time.
- Teach the cause-and-effect clearly, with the real numbers above woven in:
  * A STRONGER US dollar usually pushes gold and silver DOWN in international (USD) prices, because metals are priced in dollars and become more expensive for everyone paying in other currencies.
  * HIGHER interest rates (rising bond yields) are usually a headwind for gold, because gold pays no interest and investors can earn more by holding bonds instead; FALLING yields usually help gold.
  * Rising CRUDE OIL can stoke inflation, which often supports gold as a hedge, and also raises costs across the whole economy.
  * How these forces interact with each other (e.g. the Fed raising rates tends to strengthen the dollar, which pressures metals twice over).
  * For a reader's OWN country, the local price roughly equals the international price adjusted for their currency versus the dollar, PLUS local taxes/duties and dealer premiums. If their currency WEAKENS against the dollar, local metal prices can RISE even when international prices are flat or falling. Use the US dollar vs the Indian rupee as a concrete worked example, but keep the lesson general so any reader can apply it to their own currency.
- Include a balanced "What to watch next week" discussion that helps readers form their OWN view. Do NOT give financial advice or make firm predictions — use conditional phrasing like "if the dollar keeps strengthening, gold may face pressure".

Return the result as JSON with this shape:
- "title": a short, specific headline leading with the standout move, ending with " — Weekly Metals Roundup".
- "summary": one sentence, max 30 words, teasing the article (used as the preview on the news list).
- "intro": an engaging 2-3 sentence opening paragraph that sets the scene for the week.
- "sections": an array of 5 to 6 objects, each { "heading": short section title, "paragraphs": array of 2-3 plain-English paragraphs }. Cover, in order: (1) what moved this week across the four metals, (2) the US dollar and why it matters, (3) interest rates and the cost of holding gold, (4) crude oil, inflation and the wider economy, (5) what it means for YOUR country / local prices, (6) what to watch next week.
- "keyTakeaways": an array of 4-5 short one-sentence bullet points summarising the practical lessons.`;
}

function validateBody(parsed: Partial<ArticleBody>): parsed is ArticleBody {
  return (
    typeof parsed.title === 'string' &&
    typeof parsed.summary === 'string' &&
    typeof parsed.intro === 'string' &&
    Array.isArray(parsed.sections) &&
    parsed.sections.length > 0 &&
    parsed.sections.every(
      (s) =>
        s &&
        typeof s.heading === 'string' &&
        Array.isArray(s.paragraphs) &&
        s.paragraphs.length > 0 &&
        s.paragraphs.every((p) => typeof p === 'string'),
    ) &&
    Array.isArray(parsed.keyTakeaways) &&
    parsed.keyTakeaways.every((t) => typeof t === 'string')
  );
}

async function generateWithGemini(d: MarketData): Promise<ArticleBody | null> {
  if (!GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY not set — using template fallback.');
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const reqBody = {
    contents: [{ parts: [{ text: buildPrompt(d) }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          summary: { type: 'STRING' },
          intro: { type: 'STRING' },
          sections: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                heading: { type: 'STRING' },
                paragraphs: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['heading', 'paragraphs'],
            },
          },
          keyTakeaways: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['title', 'summary', 'intro', 'sections', 'keyTakeaways'],
      },
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`Gemini returned ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn('Gemini response had no text part.');
      return null;
    }

    const parsed = JSON.parse(text) as Partial<ArticleBody>;
    if (!validateBody(parsed)) {
      console.warn('Gemini JSON failed validation.');
      return null;
    }

    console.log('Article generated by Gemini.');
    return parsed;
  } catch (err) {
    console.warn('Gemini call failed:', err);
    return null;
  }
}

// ── Deterministic template fallback ──────────────────────────────────────────

function generateTemplate(d: MarketData): ArticleBody {
  const m = d.metals;
  const lead = METALS.map((metal) => ({ metal, abs: Math.abs(m[metal].weekPct ?? m[metal].dayPct) }))
    .sort((a, b) => b.abs - a.abs)[0];
  const leadName = lead.metal.charAt(0).toUpperCase() + lead.metal.slice(1);
  const leadPct = m[lead.metal].weekPct ?? m[lead.metal].dayPct;
  const title =
    lead.abs > 1
      ? `${leadName} ${leadPct > 0 ? 'rallies' : 'slides'} ${lead.abs.toFixed(1)}% — Weekly Metals Roundup`
      : `Gold steadies near ${formatUSD(m.gold.price)} — Weekly Metals Roundup`;

  const dollarDir = d.dollarIndex.dayPct >= 0 ? 'stronger' : 'softer';
  const dollarVerb = d.dollarIndex.dayPct >= 0 ? 'climbed' : 'slipped';
  const yieldVerb = d.us10y.dayPct >= 0 ? 'rose' : 'eased';
  const crudeVerb = d.crude.dayPct >= 0 ? 'firmed' : 'softened';
  const ratio = (m.gold.price / m.silver.price).toFixed(1);

  const intro =
    `Welcome to this week's plain-English roundup of the precious-metals market. ` +
    `Gold ${direction(m.gold.weekPct ?? m.gold.dayPct)} to ${formatUSD(m.gold.price)} per troy ounce while silver changed hands near ${formatUSD(m.silver.price)}, ` +
    `and the bigger forces in the background — the US dollar, interest rates and the oil price — all played their part. ` +
    `Below we walk through what happened, why it happened, and what it could mean for the price you pay in your own country.`;

  const sections: ArticleSection[] = [
    {
      heading: 'What moved this week',
      paragraphs: [
        `Gold ${direction(m.gold.weekPct ?? m.gold.dayPct)} to ${formatUSD(m.gold.price)} and silver ${direction(m.silver.weekPct ?? m.silver.dayPct)} to ${formatUSD(m.silver.price)} per troy ounce (a troy ounce is the standard unit for pricing precious metals, about 31.1 grams). ` +
          `Among the "platinum-group" metals used heavily in industry, platinum sat at ${formatUSD(m.platinum.price)} and palladium at ${formatUSD(m.palladium.price)}.`,
        `One quick gauge traders watch is the gold-to-silver ratio — how many ounces of silver it takes to buy one ounce of gold. ` +
          `It stands at about ${ratio} this week. A high ratio is often read as silver being cheap relative to gold, though silver also swings harder in both directions because so much of its demand comes from industry.`,
      ],
    },
    {
      heading: 'The US dollar: the single biggest driver',
      paragraphs: [
        `Gold and silver are priced in US dollars all around the world, so the dollar's strength matters enormously. ` +
          `The US Dollar Index — a simple scorecard that measures the dollar against a basket of other major currencies — ${dollarVerb} to ${d.dollarIndex.price.toFixed(2)} and was ${dollarDir} on the week.`,
        `When the dollar strengthens, it takes more of every other currency to buy the same ounce of gold, which usually cools international demand and pushes the dollar price down. ` +
          `When the dollar weakens, the opposite tends to happen and metals often catch a bid. That is why a quiet week for metals prices often hides a busy week in the currency market.`,
      ],
    },
    {
      heading: 'Interest rates and the cost of holding gold',
      paragraphs: [
        `Interest rates are the second big lever. We track them through the US 10-year Treasury yield — the interest the US government pays to borrow money for ten years, and a benchmark for rates across the economy. ` +
          `This week it ${yieldVerb} to ${d.us10y.price.toFixed(2)}%.`,
        `Here is the key idea: gold pays you no interest. So when safe bonds offer a high yield, holding gold means giving up that income, and gold becomes less attractive — a "headwind". ` +
          `When yields fall, that trade-off shrinks and gold usually becomes more appealing. Rates and the dollar are also linked: when a central bank like the US Federal Reserve raises rates, the dollar often strengthens too, which can press on metals from two directions at once.`,
      ],
    },
    {
      heading: 'Crude oil, inflation and the wider economy',
      paragraphs: [
        `Oil might seem unrelated to gold, but it is an important inflation signal. WTI crude — the main US oil benchmark — ${crudeVerb} to ${formatUSD(d.crude.price)} a barrel this week.`,
        `Expensive oil feeds through to fuel, transport and manufacturing costs, which can lift inflation across the board. ` +
          `Because gold is widely used as a hedge against inflation — a store of value when money is losing purchasing power — a sustained rise in oil can quietly support demand for gold, even as it squeezes household budgets elsewhere.`,
      ],
    },
    {
      heading: 'What it means for your country',
      paragraphs: [
        `The headline prices above are international spot prices in US dollars. The price you actually pay at home is roughly that international price converted into your currency, plus local import duties, sales taxes (such as GST or VAT) and the dealer's premium.`,
        `The currency step is the one people miss. Suppose gold is flat in dollars but your local currency weakens against the dollar — your local gold price still goes up, because each unit of your money now buys fewer dollars' worth of metal. ` +
          `Take India as an example: if the rupee softens versus the dollar, rupee gold prices can climb even on a calm week internationally. The same logic applies to any currency, so always watch your currency-versus-dollar rate alongside the global price. Our calculator can convert the all-in cost for your country and purity.`,
      ],
    },
    {
      heading: 'What to watch next week',
      paragraphs: [
        `Keep an eye on three things: the direction of the US dollar, the path of Treasury yields, and any fresh inflation or central-bank news. ` +
          `If the dollar keeps strengthening and yields climb, gold and silver may stay under pressure in dollar terms. If the dollar softens or yields fall, metals could find more support.`,
        `For buyers, the steadier approach is usually to spread purchases over time rather than trying to pick the exact bottom, and to compare the all-in local cost — not just the spot price — before committing. None of this is financial advice; it is a framework to help you read the week for yourself.`,
      ],
    },
  ];

  const keyTakeaways = [
    `Gold is around ${formatUSD(m.gold.price)} and silver around ${formatUSD(m.silver.price)} per troy ounce this week.`,
    `A stronger US dollar (index at ${d.dollarIndex.price.toFixed(2)}) is typically a headwind for metals; a weaker dollar helps.`,
    `Higher interest rates (10-year yield at ${d.us10y.price.toFixed(2)}%) make non-yielding gold less attractive; falling rates help it.`,
    `Rising crude oil (${formatUSD(d.crude.price)}) can lift inflation, which often supports gold over time.`,
    `Your local price = international price × your currency-vs-dollar rate, plus local taxes and premiums.`,
  ];

  const summary =
    `Gold at ${formatUSD(m.gold.price)}, silver at ${formatUSD(m.silver.price)}. ` +
    `${title.split(' — ')[0]}, with the dollar, interest rates and oil in focus.`;

  return { title, summary, intro, sections, keyTakeaways };
}

// ── Inline SVG performance chart (self-contained, works in static HTML) ───────

function buildChartSvg(d: MarketData): string {
  const usingWeekly = d.metals.gold.weekPct !== null;
  const rows = METALS.map((metal) => ({
    name: metal.charAt(0).toUpperCase() + metal.slice(1),
    price: d.metals[metal].price,
    pct: d.metals[metal].weekPct ?? d.metals[metal].dayPct,
  }));

  const maxAbs = Math.max(0.5, ...rows.map((r) => Math.abs(r.pct)));
  const W = 640;
  const rowH = 56;
  const top = 58;
  const axisX = 330;
  const maxBar = 150;
  const H = top + rows.length * rowH + 16;
  const color = (pct: number) => (pct >= 0 ? '#10b981' : '#ef4444');

  const bars = rows
    .map((r, i) => {
      const y = top + i * rowH;
      const len = (Math.abs(r.pct) / maxAbs) * maxBar;
      const x = r.pct >= 0 ? axisX : axisX - len;
      const valX = r.pct >= 0 ? axisX + len + 8 : axisX - len - 8;
      const anchor = r.pct >= 0 ? 'start' : 'end';
      const sign = r.pct >= 0 ? '+' : '';
      const priceStr = r.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `  <text x="22" y="${y + 18}" fill="#e2e8f0" font-size="15" font-weight="600" font-family="Arial, sans-serif">${r.name}</text>
  <text x="22" y="${y + 37}" fill="#94a3b8" font-size="12" font-family="Arial, sans-serif">$${priceStr}/oz</text>
  <rect x="${x.toFixed(1)}" y="${y + 4}" width="${len.toFixed(1)}" height="26" rx="4" fill="${color(r.pct)}" opacity="0.85" />
  <text x="${valX.toFixed(1)}" y="${y + 22}" fill="${color(r.pct)}" font-size="13" font-weight="700" text-anchor="${anchor}" font-family="Arial, sans-serif">${sign}${r.pct.toFixed(2)}%</text>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="auto" role="img" aria-label="Precious metals ${usingWeekly ? 'weekly' : 'daily'} performance chart">
  <rect width="${W}" height="${H}" fill="#0b0b12" rx="12" />
  <text x="22" y="32" fill="#e2e8f0" font-size="16" font-weight="700" font-family="Arial, sans-serif">Metals performance — ${usingWeekly ? 'this week' : 'latest session'}</text>
  <line x1="${axisX}" y1="48" x2="${axisX}" y2="${H - 12}" stroke="#334155" stroke-width="1" stroke-dasharray="3 3" />
${bars}
</svg>`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let articles: NewsArticle[] = [];
  if (existsSync(NEWS_FILE)) {
    try {
      articles = JSON.parse(readFileSync(NEWS_FILE, 'utf-8'));
    } catch {
      console.warn('Could not parse existing news.json, starting fresh');
    }
  }

  const allTickers = [...Object.values(METAL_TICKERS), ...Object.values(MACRO_TICKERS)];
  console.log(`Fetching ${allTickers.length} quotes from TradingView scanner...`);
  const quotes = await fetchScan(allTickers);

  const prev = articles[0];
  const data = buildMarketData(quotes, prev);

  const body = (await generateWithGemini(data)) ?? generateTemplate(data);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const article: NewsArticle = {
    slug: `${dateStr}-metals-weekly`,
    titleSlug: slugify(body.title) || 'metals-weekly',
    title: body.title,
    date: dateStr,
    summary: body.summary,
    intro: body.intro,
    sections: body.sections,
    keyTakeaways: body.keyTakeaways,
    chartSvg: buildChartSvg(data),
    prices: {
      gold: data.metals.gold.price,
      silver: data.metals.silver.price,
      platinum: data.metals.platinum.price,
      palladium: data.metals.palladium.price,
    },
    macro: {
      dollarIndex: data.dollarIndex.price,
      us10y: data.us10y.price,
      crude: data.crude.price,
    },
  };

  if (articles.some((a) => a.date === article.date)) {
    console.log(`Article for ${article.date} already exists, skipping`);
    return;
  }

  articles.unshift(article);
  if (articles.length > 52) articles = articles.slice(0, 52);

  writeFileSync(NEWS_FILE, JSON.stringify(articles, null, 2) + '\n');
  console.log(`Wrote ${NEWS_FILE}`);
  console.log(`Title: ${article.title}`);
  console.log(`Articles total: ${articles.length}`);
}

main().catch((err) => {
  console.error('generate-news failed:', err);
  process.exit(1);
});
