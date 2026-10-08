import React from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, ArrowRight } from 'lucide-react';
import { newsArticles, newsPath, formatNewsDate } from '../data/news';

export const WeeklyReports: React.FC = () => {
  return (
    <div id="weekly-reports" className="blog-panel card-panel">
      <div className="panel-title">
        <Newspaper size={20} className="glow-gold-text" />
        <h2>Weekly Market News</h2>
      </div>
      <p className="panel-subtitle">
        Automated weekly analysis of gold, silver, platinum, and palladium price movements.
      </p>

      <div className="news-list">
        {newsArticles.map((article) => (
          <Link key={article.slug} to={newsPath(article)} className="news-card">
            <time className="blog-date">{formatNewsDate(article.date)}</time>
            <h3>{article.title}</h3>
            <p className="news-card-summary">{article.summary}</p>
            <span className="news-card-readmore">
              Read full report <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};
