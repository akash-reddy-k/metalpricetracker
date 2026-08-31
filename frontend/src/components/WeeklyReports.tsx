import React, { useState } from 'react';
import { WEEKLY_REPORTS } from '../data/content';
import { Newspaper, ChevronDown } from 'lucide-react';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export const WeeklyReports: React.FC = () => {
  // Newest report is expanded by default; the rest collapse to their summary.
  const [openSlug, setOpenSlug] = useState<string | null>(WEEKLY_REPORTS[0]?.slug ?? null);

  return (
    <div id="weekly-reports" className="blog-panel card-panel">
      <div className="panel-title">
        <Newspaper size={20} className="glow-gold-text" />
        <h2>Weekly Market Reports</h2>
      </div>
      <p className="panel-subtitle">
        Our take on what moved gold, silver, platinum, and palladium each week.
      </p>

      <div className="blog-list">
        {WEEKLY_REPORTS.map((report) => {
          const isOpen = openSlug === report.slug;
          return (
            <article key={report.slug} className={`blog-item ${isOpen ? 'open' : ''}`}>
              <button
                className="blog-header"
                onClick={() => setOpenSlug(isOpen ? null : report.slug)}
                aria-expanded={isOpen}
              >
                <div className="blog-header-text">
                  <time className="blog-date">{formatDate(report.date)}</time>
                  <h3>{report.title}</h3>
                </div>
                <ChevronDown size={18} className={`blog-chevron ${isOpen ? 'rotated' : ''}`} />
              </button>

              {isOpen ? (
                <div className="blog-body">
                  {report.paragraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              ) : (
                <p className="blog-summary">{report.summary}</p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
