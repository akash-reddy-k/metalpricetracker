import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { MetalPage } from './pages/MetalPage.tsx';
import { BlogsPage } from './pages/BlogsPage.tsx';
import { TipsPage } from './pages/TipsPage.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<HomePage />} />
          <Route path=":country/:metal" element={<MetalPage />} />
          <Route path="blogs" element={<BlogsPage />} />
          <Route path="tips" element={<TipsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
