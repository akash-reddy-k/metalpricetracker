import { useState, useEffect } from 'react';
import type { SpotPrices, MetalType, CurrencyType, ApiConfig } from './types/metals';
import { BASE_PRICES, simulatePriceTick } from './services/priceEngine';
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
    serverUrl: 'http://localhost:3000',
  });
  const [refreshInterval, setRefreshInterval] = useState<number>(60); // seconds
  const [reconnectTrigger, setReconnectTrigger] = useState<number>(0);

  // Fetch status
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  // Interval polling or SSE streaming effect
  useEffect(() => {
    if (apiConfig.provider === 'simulated') {
      setIsFetching(false);
      setFetchError(null);

      const runSimTick = () => {
        setPrices((prev) => {
          const next = simulatePriceTick(prev);
          setLastUpdated(new Date());
          return next;
        });
      };

      // Initial simulation tick
      runSimTick();

      const intervalId = setInterval(runSimTick, refreshInterval * 1000);
      return () => clearInterval(intervalId);
    } else {
      setIsFetching(true);
      setFetchError(null);

      const symbols = 'GC=F,SI=F,PL=F,PA=F';
      const sseUrl = `${apiConfig.serverUrl}/live-quotes?s=${symbols}&i=${refreshInterval * 1000}`;
      
      let eventSource: EventSource | null = null;

      try {
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          setIsFetching(false);
          setFetchError(null);
        };

        eventSource.onerror = (err) => {
          console.error("SSE stream error:", err);
          setFetchError(`Failed to stream from Hono server at ${apiConfig.serverUrl}. Please ensure the Hono backend is running (npx tsx server.ts).`);
          setIsFetching(false);
          
          // Trigger a fallback simulated tick so the UI stays updated
          setPrices((prev) => {
            const next = simulatePriceTick(prev);
            setLastUpdated(new Date());
            return next;
          });
        };

        eventSource.addEventListener('quote', (event: MessageEvent) => {
          try {
            const quote = JSON.parse(event.data);
            const { symbol, price } = quote;
            if (price && typeof price === 'number') {
              setPrices((prev) => {
                const next = { ...prev, timestamp: Date.now() };
                if (symbol === 'GC=F') next.gold = price;
                if (symbol === 'SI=F') next.silver = price;
                if (symbol === 'PL=F') next.platinum = price;
                if (symbol === 'PA=F') next.palladium = price;
                return next;
              });
              setLastUpdated(new Date());
            }
          } catch (parseErr) {
            console.error("Error parsing quote SSE data:", parseErr);
          }
        });

      } catch (err: any) {
        setFetchError(err.message || 'Failed to initialize Hono SSE connection');
        setIsFetching(false);
      }

      return () => {
        if (eventSource) {
          eventSource.close();
        }
      };
    }
  }, [apiConfig, refreshInterval, reconnectTrigger]);

  const handleManualFetch = () => {
    setReconnectTrigger((prev) => prev + 1);
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
