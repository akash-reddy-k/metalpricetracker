export interface ArticleSection {
  heading: string;
  paragraphs: string[];
}

export interface NewsArticle {
  /** Unique identifier = the article's file stem (publish timestamp, e.g.
   *  "2026-10-12T11-34-42Z"). Used for React keys and sorting. */
  id: string;
  slug: string;
  /** URL-safe slug derived from the title; used in the detail URL. */
  titleSlug: string;
  title: string;
  date: string; // ISO YYYY-MM-DD
  /** Full ISO publish timestamp; primary sort key (newest first). */
  publishedAt: string;
  summary: string;
  /** Long-form body: a lede, headed sections and practical key takeaways. */
  intro: string;
  sections: ArticleSection[];
  keyTakeaways: string[];
  /** Self-contained inline SVG performance chart. */
  chartSvg: string;
  prices?: {
    gold: number;
    silver: number;
    platinum: number;
    palladium: number;
  };
  macro?: {
    dollarIndex: number;
    us10y: number;
    crude: number;
  };
  /** Which path produced this article ('gemini' or 'template'). Set by the
   *  generator script; optional here since older articles predate the field. */
  generator?: 'gemini' | 'template';
}

/** Curated further-reading links shown at the foot of every article. */
export interface ReferenceLink {
  label: string;
  href: string;
}

export const REFERENCE_LINKS: ReferenceLink[] = [
  { label: 'US Dollar Index (DXY) live chart — TradingView', href: 'https://www.tradingview.com/symbols/TVC-DXY/' },
  { label: 'US 10-Year Treasury yield — TradingView', href: 'https://www.tradingview.com/symbols/TVC-US10Y/' },
  { label: 'WTI crude oil price — TradingView', href: 'https://www.tradingview.com/symbols/NYMEX-CL1!/' },
  { label: 'What moves the gold price? — World Gold Council', href: 'https://www.gold.org/goldhub/research/market-primer/drivers-of-gold' },
  { label: 'Federal Reserve: monetary policy & interest rates', href: 'https://www.federalreserve.gov/monetarypolicy.htm' },
];

// Each article is its own JSON file under ./news/, named by its publish
// timestamp (e.g. news/2026-10-12T11-34-42Z.json). Vite inlines them all at
// build time; no network fetch happens at runtime.
const newsModules = import.meta.glob<NewsArticle>('./news/*.json', {
  eager: true,
  import: 'default',
});

/** Newest-first list of all generated news articles. */
export const newsArticles: NewsArticle[] = Object.values(newsModules).sort((a, b) =>
  (b.publishedAt ?? b.date).localeCompare(a.publishedAt ?? a.date),
);

/** Canonical in-app path for an article's detail page: /news/{date}/{titleSlug}. */
export const newsPath = (a: Pick<NewsArticle, 'date' | 'titleSlug'>): string =>
  `/news/${a.date}/${a.titleSlug}`;

/** Finds an article by its date and title slug, or undefined if none matches. */
export const findArticle = (
  date: string | undefined,
  titleSlug: string | undefined,
): NewsArticle | undefined =>
  newsArticles.find((a) => a.date === date && a.titleSlug === titleSlug);

export const formatNewsDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export const formatNewsUSD = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
