import { useState, useEffect } from 'react';
import type { SpotPrices, MetalType, CurrencyType } from './types/metals';
import { BASE_PRICES, simulatePriceTick } from './services/priceEngine';
import { LivePriceCards } from './components/LivePriceCards';
import { Calculator } from './components/Calculator';
import { AnalyticsChart } from './components/AnalyticsChart';
import { Coins, ShieldCheck } from 'lucide-react';
import './index.css';

// Read backend URL from environment variables, defaulting to local port 3000
const HONO_SERVER_URL = import.meta.env.VITE_HONO_SERVER_URL || 'http://localhost:3000';

function App() {
  // Main price state
  const [prices, setPrices] = useState<SpotPrices>({
    gold: BASE_PRICES.gold,
    silver: BASE_PRICES.silver,
    platinum: BASE_PRICES.platinum,
    palladium: BASE_PRICES.palladium,
    timestamp: Date.now(),
  });

  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType>('USD');
  const [activeMetal, setActiveMetal] = useState<MetalType>('gold');
  const [refreshInterval, setRefreshInterval] = useState<number>(60); // seconds
  const [reconnectTrigger, setReconnectTrigger] = useState<number>(0);

  // Fetch status
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(true);

  // SSE streaming connection effect
  useEffect(() => {
    setIsFetching(true);
    setFetchError(null);

    const symbols = 'GC=F,SI=F,PL=F,PA=F';
    const sseUrl = `${HONO_SERVER_URL}/live-quotes?s=${symbols}&i=${refreshInterval * 1000}`;
    
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setIsFetching(false);
        setFetchError(null);
      };

      eventSource.onerror = (err) => {
        console.error("SSE stream error:", err);
        setFetchError(`Failed to stream from Hono server. Falling back to local market simulations.`);
        setIsFetching(false);
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
  }, [refreshInterval, reconnectTrigger]);

  // Resilient offline fallback: run simulations if SSE fails
  useEffect(() => {
    if (!fetchError) return;

    // Run first simulation tick immediately when falling offline
    setPrices((prev) => {
      const next = simulatePriceTick(prev);
      setLastUpdated(new Date());
      return next;
    });

    const intervalId = setInterval(() => {
      setPrices((prev) => {
        const next = simulatePriceTick(prev);
        setLastUpdated(new Date());
        return next;
      });
    }, refreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [fetchError, refreshInterval]);

  const handleReconnect = () => {
    setReconnectTrigger((prev) => prev + 1);
  };

  return (
    <>
      {/* Top Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-symbol" onClick={handleReconnect} style={{ cursor: 'pointer' }} title="Click to reconnect/re-sync">
            <Coins size={22} className={isFetching ? 'spinning-sparkle' : ''} />
          </div>
          <div className="app-title-block">
            <h1>MetalPriceTracker</h1>
            <p>Precious Metals Live Spot Rates & Global Cost Calculator</p>
          </div>
        </div>

        <div className="header-controls">
          {/* Status Indicator */}
          <div className="currency-selector-wrapper" onClick={handleReconnect} style={{ cursor: 'pointer' }} title="Click to reconnect">
            <span className={`status-dot ${isFetching ? 'connecting' : fetchError ? 'offline' : 'online'}`} style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isFetching ? '#f59e0b' : fetchError ? '#ef4444' : '#10b981',
              boxShadow: isFetching ? '0 0 8px #f59e0b' : fetchError ? '0 0 8px #ef4444' : '0 0 8px #10b981',
              display: 'inline-block',
              marginRight: '6px'
            }}></span>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isFetching ? 'Connecting' : fetchError ? 'Offline Mode' : `Live • ${lastUpdated?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
            </span>
          </div>

          {/* Update Interval */}
          <div className="currency-selector-wrapper">
            <label htmlFor="refresh-select-main">Update Rate</label>
            <select
              id="refresh-select-main"
              className="currency-select"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10))}
            >
              <option value={10}>10s (Fast)</option>
              <option value={30}>30s</option>
              <option value={60}>60s (Default)</option>
              <option value={300}>5m</option>
            </select>
          </div>

          {/* Target Currency */}
          <div className="currency-selector-wrapper">
            <label htmlFor="currency-select-main">Currency</label>
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
          <span>© 2026 MetalPriceTracker Inc. Powered by Yahoo Finance. All calculations are for informational purposes.</span>
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
