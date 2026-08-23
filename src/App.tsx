import { useState, useEffect, useMemo } from 'react';
import type { SpotPrices, MetalType, CurrencyType, WeightUnit } from './types/metals';
import { FALLBACK_SPOT_PRICES } from './services/priceEngine';
import { EXCHANGE_RATES, COUNTRIES } from './data/countries';
import { LivePriceCards } from './components/LivePriceCards';
import { Calculator } from './components/Calculator';
import { AnalyticsChart } from './components/AnalyticsChart';
import { useLiveQuotes } from './hooks/useLiveQuotes';
import { METAL_TICKERS, TICKER_TO_CURRENCY } from './services/api';
import { Coins, ShieldCheck } from 'lucide-react';
import './index.css';

function App() {
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType>('USD');
  const [activeMetal, setActiveMetal] = useState<MetalType>('gold');
  const [refreshInterval, setRefreshInterval] = useState<number>(60); // seconds
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('oz');

  const { quotes, status, lastUpdated, stale, reconnect } = useLiveQuotes(refreshInterval * 1000);

  // Spot prices fall back to the last shipped snapshot until the first quote lands.
  const prices = useMemo<SpotPrices>(() => {
    const read = (metal: MetalType) =>
      quotes[METAL_TICKERS[metal]]?.price ?? FALLBACK_SPOT_PRICES[metal];
    return {
      gold: read('gold'),
      silver: read('silver'),
      platinum: read('platinum'),
      palladium: read('palladium'),
      timestamp: lastUpdated?.getTime() ?? 0,
    };
  }, [quotes, lastUpdated]);

  const changePercents = useMemo<Record<MetalType, number>>(() => {
    const read = (metal: MetalType) => quotes[METAL_TICKERS[metal]]?.changePercent ?? 0;
    return {
      gold: read('gold'),
      silver: read('silver'),
      platinum: read('platinum'),
      palladium: read('palladium'),
    };
  }, [quotes]);

  const exchangeRates = useMemo<Record<CurrencyType, number>>(() => {
    const rates = { ...EXCHANGE_RATES };
    for (const [ticker, quote] of Object.entries(quotes)) {
      const currency = TICKER_TO_CURRENCY[ticker];
      if (currency) rates[currency] = quote.price;
    }
    return rates;
  }, [quotes]);

  const isFetching = status === 'connecting';

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


  // Sync global weight unit with country's default weight unit when currency changes in header
  useEffect(() => {
    const matchingCountry = COUNTRIES.find((c) => c.currency === selectedCurrency);
    if (matchingCountry && matchingCountry.defaultUnit) {
      setWeightUnit(matchingCountry.defaultUnit);
    }
  }, [selectedCurrency]);

  const statusColor =
    status === 'live' && !stale
      ? '#10b981'
      : status === 'offline'
        ? '#ef4444'
        : '#f59e0b';

  const statusLabel =
    status === 'connecting'
      ? 'Connecting'
      : status === 'reconnecting'
        ? 'Reconnecting'
        : status === 'offline'
          ? 'Offline'
          : stale
            ? 'Stale feed'
            : `Live • ${lastUpdated?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

  return (
    <>
      {/* Top Header */}
      <header className="app-header">
        <div className="logo-section">
          <div
            className="logo-symbol"
            onClick={reconnect}
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
            onClick={reconnect}
            style={{ cursor: 'pointer' }}
            title="Click to reconnect"
          >
            <span
              className={`status-dot ${status}`}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: statusColor,
                boxShadow: `0 0 8px ${statusColor}`,
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
              {statusLabel}
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
            title="Select the live pricing data refresh frequency for streaming quotes from TradingView."
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
          changePercents={changePercents}
        />

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
