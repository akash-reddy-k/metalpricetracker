import React, { lazy, Suspense } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppOutletContext } from '../types/metals';
import { LivePriceCards } from '../components/LivePriceCards';
import { Calculator } from '../components/Calculator';

// Lazy-load heavy chart components so above-the-fold content paints first.
const TradingViewChart = lazy(() => import('../components/TradingViewChart'));
const AnalyticsChart = lazy(() => import('../components/AnalyticsChart'));

const ChartFallback = () => (
  <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
    Loading chart...
  </div>
);

export const HomePage: React.FC = () => {
  const ctx = useOutletContext<AppOutletContext>();

  return (
    <main className="dashboard-grid">
      <LivePriceCards
        prices={ctx.prices}
        selectedCurrency={ctx.selectedCurrency}
        activeMetal={ctx.activeMetal}
        setActiveMetal={ctx.setActiveMetal}
        weightUnit={ctx.weightUnit}
        exchangeRates={ctx.exchangeRates}
        changePercents={ctx.changePercents}
      />

      {/* TradingView professional chart — candlesticks, indicators, drawing tools */}
      <Suspense fallback={<ChartFallback />}>
        <TradingViewChart activeMetal={ctx.activeMetal} />
      </Suspense>

      <Calculator
        activeMetal={ctx.activeMetal}
        setActiveMetal={ctx.setActiveMetal}
        spotPrices={ctx.prices}
        selectedCurrency={ctx.selectedCurrency}
        weightUnit={ctx.weightUnit}
        exchangeRates={ctx.exchangeRates}
      />

      {/* Country price comparison / arbitrage chart — unique feature */}
      <Suspense fallback={<ChartFallback />}>
        <AnalyticsChart
          activeMetal={ctx.activeMetal}
          setActiveMetal={ctx.setActiveMetal}
          selectedCurrency={ctx.selectedCurrency}
          spotPrices={ctx.prices}
          weightUnit={ctx.weightUnit}
          exchangeRates={ctx.exchangeRates}
        />
      </Suspense>
    </main>
  );
};
