import React from 'react';
import { WeeklyReports } from '../components/WeeklyReports';

const BlogsPage: React.FC = () => {
  return (
    <main className="dashboard-grid">
      <WeeklyReports />
    </main>
  );
};

export default BlogsPage;
