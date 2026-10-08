import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import { HomePage } from './pages/HomePage.tsx';
import './index.css';

// Lazy-load non-critical routes — keeps the initial bundle small
const MetalPage = lazy(() => import('./pages/MetalPage.tsx'));
const NewsPage = lazy(() => import('./pages/NewsPage.tsx'));
const NewsArticlePage = lazy(() => import('./pages/NewsArticlePage.tsx'));
const TipsPage = lazy(() => import('./pages/TipsPage.tsx'));

const RouteSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
    <div className="spinning-sparkle" style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#F59E0B', borderRadius: '50%' }} />
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<HomePage />} />
          <Route path=":country/:metal" element={<Suspense fallback={<RouteSpinner />}><MetalPage /></Suspense>} />
          <Route path="news" element={<Suspense fallback={<RouteSpinner />}><NewsPage /></Suspense>} />
          <Route path="news/:date/:slug" element={<Suspense fallback={<RouteSpinner />}><NewsArticlePage /></Suspense>} />
          <Route path="tips" element={<Suspense fallback={<RouteSpinner />}><TipsPage /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
