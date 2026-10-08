import React, { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import {
  findArticle,
  formatNewsDate,
  formatNewsUSD,
  REFERENCE_LINKS,
} from '../data/news';

const NewsArticlePage: React.FC = () => {
  const { date, slug } = useParams<{ date: string; slug: string }>();
  const article = findArticle(date, slug);

  useEffect(() => {
    if (!article) return;
    const prevTitle = document.title;
    document.title = `${article.title.split(' — ')[0]} | MetalPrices.Online`;
    return () => {
      document.title = prevTitle;
    };
  }, [article]);

  if (!article) {
    return <Navigate to="/news" replace />;
  }

  return (
    <main className="dashboard-grid">
      <article className="blog-panel card-panel news-article">
        <Link to="/news" className="news-back-link">
          <ArrowLeft size={15} /> All news
        </Link>

        <time className="blog-date">{formatNewsDate(article.date)}</time>
        <h1 className="news-article-title">{article.title}</h1>

        <p className="news-article-intro">{article.intro}</p>

        {article.prices && (
          <div className="news-price-strip">
            <span style={{ color: 'var(--gold)' }}>Gold {formatNewsUSD(article.prices.gold)}</span>
            <span style={{ color: 'var(--silver)' }}>Silver {formatNewsUSD(article.prices.silver)}</span>
            <span style={{ color: 'var(--platinum)' }}>Platinum {formatNewsUSD(article.prices.platinum)}</span>
            <span style={{ color: 'var(--palladium)' }}>Palladium {formatNewsUSD(article.prices.palladium)}</span>
          </div>
        )}

        {article.macro && (
          <div className="news-macro-strip">
            <span>Dollar Index {article.macro.dollarIndex.toFixed(2)}</span>
            <span>US 10Y Yield {article.macro.us10y.toFixed(2)}%</span>
            <span>WTI Crude {formatNewsUSD(article.macro.crude)}</span>
          </div>
        )}

        {article.chartSvg && (
          <figure
            className="news-chart"
            dangerouslySetInnerHTML={{ __html: article.chartSvg }}
          />
        )}

        <div className="news-article-body">
          {article.sections.map((section, i) => (
            <section key={i} className="news-section">
              <h2>{section.heading}</h2>
              {section.paragraphs.map((para, j) => (
                <p key={j}>{para}</p>
              ))}
            </section>
          ))}
        </div>

        {article.keyTakeaways.length > 0 && (
          <aside className="news-takeaways">
            <h2>Key takeaways</h2>
            <ul>
              {article.keyTakeaways.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </aside>
        )}

        <section className="news-references">
          <h2>Further reading &amp; live data</h2>
          <ul>
            {REFERENCE_LINKS.map((ref) => (
              <li key={ref.href}>
                <a href={ref.href} target="_blank" rel="noopener noreferrer">
                  {ref.label} <ExternalLink size={13} />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <p className="news-article-disclaimer">
          This automated summary is for general information only and is not financial advice.
          Prices are international spot levels in USD; your local price depends on your currency,
          taxes, and dealer premiums.
        </p>
      </article>
    </main>
  );
};

export default NewsArticlePage;
