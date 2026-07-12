import { useState, useEffect, useRef, useCallback } from 'react';
import type { SpotPrices, MetalType, CurrencyType, ApiConfig } from './types/metals';
import { BASE_PRICES, simulatePriceTick, fetchLivePrices } from './services/priceEngine';
import { LivePriceCards } from './components/LivePriceCards';
import { Calculator } from './components/Calculator';
import { AnalyticsChart } from './components/AnalyticsChart';
import { SettingsPanel } from './components/SettingsPanel';
import { Coins, ShieldCheck } from 'lucide-react';
import './index.css';

function App() {
  // Main state
  const [prices, setPrices] = useState<SpotPrices>({
    gold: BASE_PRICES.gold,
    silver: BASE_PRICES.silver,
    platinum: BASE_PRICES.platinum,
    palladium: BASE_PRICES.palladium,
    timestamp: Date.now(),
  });

  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType>('USD');
  const [activeMetal, setActiveMetal] = useState<MetalType>('gold');
  
  // API Feed settings
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    provider: 'simulated',
    apiKey: '',
  });
  const [refreshInterval, setRefreshInterval] = useState<number>(60); // seconds

  // Fetch status
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  // Store prices in ref to avoid re-triggering polling effects unnecessarily
  const pricesRef = useRef<SpotPrices>(prices);
  useEffect(() => {
    pricesRef.current = prices;
  }, [prices]);

  // Fetching/Simulation executor
  const performUpdate = useCallback(async (currentConfig: ApiConfig) => {
    setIsFetching(true);
    setFetchError(null);
    try {
      if (currentConfig.provider === 'simulated' || !currentConfig.apiKey) {
        // Run simulated tick
        const nextPrices = simulatePriceTick(pricesRef.current);
        setPrices(nextPrices);
        setLastUpdated(new Date());
      } else {
        // Run external API fetch
        const nextPrices = await fetchLivePrices(currentConfig);
        setPrices(nextPrices);
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      console.error(err);
      setFetchError(err.message || 'An unexpected error occurred while fetching prices');
      // If live fails, fall back to simulation step so the app remains responsive
      const nextPrices = simulatePriceTick(pricesRef.current);
      setPrices(nextPrices);
    } finally {
      setIsFetching(false);
    }
  }, []);

  // Interval polling effect
  useEffect(() => {
    // Initial fetch/sync
    performUpdate(apiConfig);

    const intervalId = setInterval(() => {
      performUpdate(apiConfig);
    }, refreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [apiConfig, refreshInterval, performUpdate]);

  const handleManualFetch = () => {
    performUpdate(apiConfig);
  };

  return (
    <>
      {/* Top Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-symbol">
            <Coins size={22} />
          </div>
          <div className="app-title-block">
            <h1>MetalPriceTracker</h1>
            <p>Precious Metals Live Spot Rates & Global Cost Calculator</p>
          </div>
        </div>

        <div className="header-controls">
          {/* Target Currency */}
          <div className="currency-selector-wrapper">
            <label htmlFor="currency-select-main">Display Currency</label>
            <select
              id="currency-select-main"
              className="currency-select"
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value as CurrencyType)}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="AED">AED (د.إ)</option>
              <option value="CHF">CHF (CHF)</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <main className="dashboard-grid">
        
        {/* Settings Drawer Panel */}
        <SettingsPanel
          apiConfig={apiConfig}
          setApiConfig={setApiConfig}
          refreshInterval={refreshInterval}
          setRefreshInterval={setRefreshInterval}
          lastUpdated={lastUpdated}
          fetchError={fetchError}
          isFetching={isFetching}
          triggerManualFetch={handleManualFetch}
        />

        {/* 1. Live Price Grid */}
        <LivePriceCards
          prices={prices}
          selectedCurrency={selectedCurrency}
          activeMetal={activeMetal}
          setActiveMetal={setActiveMetal}
        />

        {/* 2. Interactive Charting Overlay */}
        <AnalyticsChart
          activeMetal={activeMetal}
          selectedCurrency={selectedCurrency}
          spotPrices={prices}
        />

        {/* 3. Global Tax Cost Localization Calculator */}
        <Calculator
          activeMetal={activeMetal}
          setActiveMetal={setActiveMetal}
          spotPrices={prices}
          selectedCurrency={selectedCurrency}
          setSelectedCurrency={setSelectedCurrency}
        />

      </main>

      {/* Bottom Footer */}
      <footer className="app-footer">
        <div>
          <span>© 2026 MetalPriceTracker Inc. All calculations are for information purposes.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={14} style={{ color: 'var(--up-green)' }} />
          <span>Encrypted calculations • Financial Grade Tax Database</span>
        </div>
      </footer>
    </>
  );
}

export default App;
