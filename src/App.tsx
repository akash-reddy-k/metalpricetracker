import { useState, useEffect } from 'react';
import type { SpotPrices, MetalType, CurrencyType, WeightUnit } from './types/metals';
import { BASE_PRICES } from './services/priceEngine';
import { EXCHANGE_RATES, COUNTRIES } from './data/countries';
import { LivePriceCards } from './components/LivePriceCards';
import { Calculator } from './components/Calculator';
import { AnalyticsChart } from './components/AnalyticsChart';
import { AdSlot } from './components/AdSlot';
import { Coins, ShieldCheck } from 'lucide-react';
import './index.css';

// Read backend URL from environment variables, defaulting to local port 3000
const HONO_SERVER_URL = import.meta.env.VITE_HONO_SERVER_URL || 'http://localhost:3000';

function App() {
  // Main price state
  const [prices, setPrices] = useState<SpotPrices>(() => ({
    gold: BASE_PRICES.gold,
    silver: BASE_PRICES.silver,
    platinum: BASE_PRICES.platinum,
    palladium: BASE_PRICES.palladium,
    timestamp: Date.now(),
  }));

  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType>('USD');
  const [activeMetal, setActiveMetal] = useState<MetalType>('gold');
  const [refreshInterval, setRefreshInterval] = useState<number>(60); // seconds
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('oz');
  const [reconnectTrigger, setReconnectTrigger] = useState<number>(0);

  // Dynamic exchange rates from Yahoo Finance
  const [exchangeRates, setExchangeRates] = useState<Record<CurrencyType, number>>(EXCHANGE_RATES);

  // Fetch status
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(true);

  // Auto-detect user country on initial load using resilient fallback APIs
  useEffect(() => {
    const detectGeoLocation = async () => {
      try {
        let countryCode = '';

        // 1. Try FreeIPAPI (HTTPS, fast, no auth)
        try {
          const response = await fetch('https://freeipapi.com/api/json');
          if (response.ok) {
            const data = await response.json();
            countryCode = data.countryCode;
          }
        } catch (e) {
          console.warn('FreeIPAPI failed, trying ipapi.co:', e);
        }

        // 2. Try ipapi.co (Fallback)
        if (!countryCode) {
          try {
            const response = await fetch('https://ipapi.co/json/');
            if (response.ok) {
              const data = await response.json();
              countryCode = data.country_code;
            }
          } catch (e) {
            console.warn('ipapi.co failed, trying ipinfo.io:', e);
          }
        }

        // 3. Try ipinfo.io (Secondary Fallback)
        if (!countryCode) {
          try {
            const response = await fetch('https://ipinfo.io/json');
            if (response.ok) {
              const data = await response.json();
              countryCode = data.country;
            }
          } catch (e) {
            console.warn('ipinfo.io failed:', e);
          }
        }

        if (countryCode) {
          const matched = COUNTRIES.find((c) => c.code.toUpperCase() === countryCode.toUpperCase());
          if (matched) {
            setSelectedCurrency(matched.currency);
            console.log(`Auto-detected location: ${matched.name} (${matched.currency})`);
          }
        }
      } catch (err) {
        console.warn('Failed to auto-detect country location, falling back to USD default:', err);
      }
    };
    detectGeoLocation();
  }, []);

  // SSE streaming connection effect
  useEffect(() => {
    setIsFetching(true);
    setFetchError(null);

    const symbols =
      'GC=F,SI=F,PL=F,PA=F,INR=X,EUR=X,GBP=X,JPY=X,CAD=X,AUD=X,AED=X,CHF=X,CNY=X,RUB=X,IDR=X,ZAR=X';
    const sseUrl = `${HONO_SERVER_URL}/live-quotes?s=${symbols}&i=${refreshInterval * 1000}`;

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setIsFetching(false);
        setFetchError(null);
      };

      eventSource.onerror = (err) => {
        console.error('SSE stream error:', err);
        setFetchError(
          `Failed to stream from Hono server. Falling back to local market simulations.`
        );
        setIsFetching(false);
      };

      eventSource.addEventListener('quote', (event: MessageEvent) => {
        try {
          const quote = JSON.parse(event.data);
          const { symbol, price } = quote;
          if (price && typeof price === 'number') {
            if (symbol.endsWith('=X')) {
              // Parse currency ticker e.g. "INR=X"
              const currency = symbol.split('=')[0] as CurrencyType;
              if (currency) {
                setExchangeRates((prev) => ({
                  ...prev,
                  [currency]: price,
                }));
                // Dynamically cache into the default EXCHANGE_RATES reference
                EXCHANGE_RATES[currency] = price;
              }
            } else {
              setPrices((prev) => {
                const next = { ...prev, timestamp: Date.now() };
                if (symbol === 'GC=F') {
                  next.gold = price;
                  BASE_PRICES.gold = price;
                }
                if (symbol === 'SI=F') {
                  next.silver = price;
                  BASE_PRICES.silver = price;
                }
                if (symbol === 'PL=F') {
                  next.platinum = price;
                  BASE_PRICES.platinum = price;
                }
                if (symbol === 'PA=F') {
                  next.palladium = price;
                  BASE_PRICES.palladium = price;
                }
                return next;
              });
            }
            setLastUpdated(new Date());
          }
        } catch (parseErr) {
          console.error('Error parsing quote SSE data:', parseErr);
        }
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setFetchError(errorMsg);
      setIsFetching(false);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [refreshInterval, reconnectTrigger]);

  // Resilient offline fallback: hold exact cached rates if SSE fails (prevent ticking simulated random prices)
  useEffect(() => {
    if (!fetchError) return;

    // Set prices to exactly the in-memory cached BASE_PRICES (which was updated on every successful quote fetch)
    setPrices({
      gold: BASE_PRICES.gold,
      silver: BASE_PRICES.silver,
      platinum: BASE_PRICES.platinum,
      palladium: BASE_PRICES.palladium,
      timestamp: Date.now(),
    });
    setLastUpdated(new Date());
  }, [fetchError]);

  // Sync global weight unit with country's default weight unit when currency changes in header
  useEffect(() => {
    const matchingCountry = COUNTRIES.find((c) => c.currency === selectedCurrency);
    if (matchingCountry && matchingCountry.defaultUnit) {
      setWeightUnit(matchingCountry.defaultUnit);
    }
  }, [selectedCurrency]);

  const handleReconnect = () => {
    setReconnectTrigger((prev) => prev + 1);
  };

  return (
    <>
      {/* Top Header */}
      <header className="app-header">
        <div className="logo-section">
          <div
            className="logo-symbol"
            onClick={handleReconnect}
            style={{ cursor: 'pointer' }}
            title="Click to reconnect/re-sync"
          >
            <Coins size={22} className={isFetching ? 'spinning-sparkle' : ''} />
          </div>
          <div className="app-title-block">
            <h1>MetalPrices.Online</h1>
            <p>Precious Metals Live Spot Rates & Global Cost Calculator</p>
          </div>
        </div>

        <div className="header-controls">
          {/* Status Indicator */}
          <div
            className="currency-selector-wrapper"
            onClick={handleReconnect}
            style={{ cursor: 'pointer' }}
            title="Click to reconnect"
          >
            <span
              className={`status-dot ${isFetching ? 'connecting' : fetchError ? 'offline' : 'online'}`}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isFetching ? '#f59e0b' : fetchError ? '#ef4444' : '#10b981',
                boxShadow: isFetching
                  ? '0 0 8px #f59e0b'
                  : fetchError
                    ? '0 0 8px #ef4444'
                    : '0 0 8px #10b981',
                display: 'inline-block',
                marginRight: '6px',
              }}
            ></span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {isFetching
                ? 'Connecting'
                : fetchError
                  ? 'Offline Mode'
                  : `Live • ${lastUpdated?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
            </span>
          </div>

          {/* Target Currency */}
          <div
            className="currency-selector-wrapper"
            title="Select the target currency for all conversions and calculations across the dashboard. This also determines the destination country's tax profile."
          >
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
              <option value="CNY">CNY (元)</option>
              <option value="RUB">RUB (₽)</option>
              <option value="IDR">IDR (Rp)</option>
              <option value="ZAR">ZAR (R)</option>
            </select>
          </div>

          {/* Weight Unit */}
          <div
            className="currency-selector-wrapper"
            title="Select the global weight unit (Troy Ounces, Grams, Kilograms) used to scale prices in cards and analytics charts."
          >
            <label htmlFor="unit-select-main">Weight Unit</label>
            <select
              id="unit-select-main"
              className="currency-select"
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
            >
              <option value="oz">oz (troy)</option>
              <option value="g">g (grams)</option>
              <option value="kg">kg (kilos)</option>
              <option value="tola">tola (10g)</option>
              <option value="tael">tael (37.5g)</option>
              <option value="baht">baht (15.244g)</option>
              <option value="mesghal">mesghal (4.6083g)</option>
              <option value="dwt">dwt (pennyweight)</option>
            </select>
          </div>

          {/* Update Interval */}
          <div
            className="currency-selector-wrapper"
            title="Select the live pricing data refresh frequency for streaming quotes from Yahoo Finance."
          >
            <label htmlFor="refresh-select-main">Update Rate</label>
            <select
              id="refresh-select-main"
              className="currency-select"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10))}
            >
              <option value={30}>30s (Fast)</option>
              <option value={60}>60s (Default)</option>
              <option value={300}>5m</option>
              <option value={600}>10m</option>
              <option value={1800}>30m</option>
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
          weightUnit={weightUnit}
          exchangeRates={exchangeRates}
        />

        {/* Mock Banner Ad Slot */}
        <div style={{ gridColumn: '1 / -1' }}>
          <AdSlot id="ad-banner-top" type="banner" />
        </div>

        {/* 2. Global Tax Cost Localization Calculator */}
        <Calculator
          activeMetal={activeMetal}
          setActiveMetal={setActiveMetal}
          spotPrices={prices}
          selectedCurrency={selectedCurrency}
          weightUnit={weightUnit}
          exchangeRates={exchangeRates}
        />

        {/* 3. Interactive Charting Overlay */}
        <AnalyticsChart
          activeMetal={activeMetal}
          selectedCurrency={selectedCurrency}
          spotPrices={prices}
          weightUnit={weightUnit}
          exchangeRates={exchangeRates}
        />

        {/* Bottom Banner Ad Slot */}
        <div style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
          <AdSlot
            id="ad-banner-bottom"
            type="banner"
            title="Premium Precious Metal IRA Custody"
            description="Protect your retirement savings with physical gold and silver tax-free. Get a free kit today."
            sponsor="Goldco Bullion"
          />
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="app-footer">
        <div>
          <span>
            © 2026 MetalPrices.Online Inc. All calculations are for
            informational purposes.
          </span>
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
