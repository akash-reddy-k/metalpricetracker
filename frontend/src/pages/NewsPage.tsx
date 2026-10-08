import React from 'react';
import { WeeklyReports } from '../components/WeeklyReports';

const NewsPage: React.FC = () => {
  return (
    <main className="dashboard-grid">
      <WeeklyReports />
    </main>
  );
};

export default NewsPage;
