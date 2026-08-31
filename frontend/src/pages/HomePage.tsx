import React from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppOutletContext } from '../types/metals';
import { LivePriceCards } from '../components/LivePriceCards';
import { Calculator } from '../components/Calculator';
import { AnalyticsChart } from '../components/AnalyticsChart';

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

      <Calculator
        activeMetal={ctx.activeMetal}
        setActiveMetal={ctx.setActiveMetal}
        spotPrices={ctx.prices}
        selectedCurrency={ctx.selectedCurrency}
        weightUnit={ctx.weightUnit}
        exchangeRates={ctx.exchangeRates}
      />

      <AnalyticsChart
        activeMetal={ctx.activeMetal}
        setActiveMetal={ctx.setActiveMetal}
        selectedCurrency={ctx.selectedCurrency}
        spotPrices={ctx.prices}
        weightUnit={ctx.weightUnit}
        exchangeRates={ctx.exchangeRates}
      />
    </main>
  );
};
