import React, { useEffect, lazy, Suspense } from 'react';
import { useParams, useOutletContext, Navigate } from 'react-router-dom';
import type { MetalType, AppOutletContext } from '../types/metals';
import { findCountryBySlug } from '../data/countries';
import { MetalPurityDetails } from '../components/MetalPurityDetails';
import { Calculator } from '../components/Calculator';

const TradingViewChart = lazy(() => import('../components/TradingViewChart'));

const ChartFallback = () => (
  <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
    Loading chart...
  </div>
);

const VALID_METALS: MetalType[] = ['gold', 'silver', 'platinum', 'palladium'];

const MetalPage: React.FC = () => {
  const { country: countrySlug, metal: metalParam } = useParams<{
    country: string;
    metal: string;
  }>();
  const ctx = useOutletContext<AppOutletContext>();

  const matchedCountry = countrySlug ? findCountryBySlug(countrySlug) : undefined;
  const metal = metalParam as MetalType;
  const validMetal = VALID_METALS.includes(metal);

  useEffect(() => {
    if (matchedCountry) {
      ctx.setSelectedCurrency(matchedCountry.currency);
    }
    if (validMetal) {
      ctx.setActiveMetal(metal);
    }
  }, [countrySlug, metalParam]);

  if (!matchedCountry || !validMetal) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="dashboard-grid">
      <MetalPurityDetails
        activeMetal={metal}
        spotPrices={ctx.prices}
        selectedCurrency={ctx.selectedCurrency}
        weightUnit={ctx.weightUnit}
        exchangeRates={ctx.exchangeRates}
      />

      <Suspense fallback={<ChartFallback />}>
        <TradingViewChart activeMetal={metal} selectedCurrency={ctx.selectedCurrency} />
      </Suspense>

      <Calculator
        activeMetal={metal}
        setActiveMetal={ctx.setActiveMetal}
        spotPrices={ctx.prices}
        selectedCurrency={ctx.selectedCurrency}
        weightUnit={ctx.weightUnit}
        exchangeRates={ctx.exchangeRates}
      />
    </main>
  );
};

export default MetalPage;
