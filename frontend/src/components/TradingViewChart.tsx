import React, { useEffect, useRef, memo } from 'react';
import type { MetalType, CurrencyType } from '../types/metals';

interface TradingViewChartProps {
  activeMetal: MetalType;
  selectedCurrency: CurrencyType;
}

/** Base USD-denominated symbols on TradingView */
const TV_BASE: Record<MetalType, string> = {
  gold: 'TVC:GOLD',
  silver: 'TVC:SILVER',
  platinum: 'TVC:PLATINUM',
  palladium: 'TVC:PALLADIUM',
};

/**
 * Forex pair multipliers to convert USD metal prices into local currencies.
 * TradingView supports symbol math: `TVC:GOLD*FX_IDC:USDINR` shows gold in INR.
 *
 * - For currencies quoted as USD/XXX (USDINR, USDJPY, etc.) we multiply.
 * - For currencies quoted as XXX/USD (EURUSD, GBPUSD, etc.) we divide.
 * - USD itself needs no conversion.
 */
const CURRENCY_FX: Record<CurrencyType, { op: '' | '*' | '/'; pair: string }> = {
  USD: { op: '',  pair: '' },
  INR: { op: '*', pair: 'FX_IDC:USDINR' },
  JPY: { op: '*', pair: 'FX_IDC:USDJPY' },
  AED: { op: '*', pair: 'FX_IDC:USDAED' },
  CNY: { op: '*', pair: 'FX_IDC:USDCNY' },
  RUB: { op: '*', pair: 'FX_IDC:USDRUB' },
  IDR: { op: '*', pair: 'FX_IDC:USDIDR' },
  ZAR: { op: '*', pair: 'FX_IDC:USDZAR' },
  CAD: { op: '*', pair: 'FX_IDC:USDCAD' },
  CHF: { op: '*', pair: 'FX_IDC:USDCHF' },
  EUR: { op: '/', pair: 'FX:EURUSD' },
  GBP: { op: '/', pair: 'FX:GBPUSD' },
  AUD: { op: '/', pair: 'FX:AUDUSD' },
};

/** Build the TradingView symbol expression for a given metal + currency. */
function buildSymbol(metal: MetalType, currency: CurrencyType): string {
  const base = TV_BASE[metal];
  const fx = CURRENCY_FX[currency];
  if (!fx.op) return base; // USD — no conversion needed
  return `${base}${fx.op}${fx.pair}`;
}

const METAL_LABEL: Record<MetalType, string> = {
  gold: 'Gold',
  silver: 'Silver',
  platinum: 'Platinum',
  palladium: 'Palladium',
};

/**
 * Inner widget that mounts TradingView's Advanced Chart Widget exactly once.
 * The parent passes a React `key` so when the metal or currency changes,
 * React fully unmounts this component and mounts a fresh instance —
 * guaranteeing the external script runs in a clean DOM node every time.
 */
const TradingViewWidget: React.FC<{ symbol: string }> = ({ symbol }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create the widget container div that TradingView expects
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1', // Candlestick
      locale: 'en',
      backgroundColor: 'rgba(9, 9, 15, 1)',
      gridColor: 'rgba(30, 41, 59, 0.5)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: true,
      support_host: 'https://www.tradingview.com',
      studies: [
        'STD;SMA'   // Simple Moving Average overlay — helpful default
      ],
      withdateranges: true,
      details: false,
    });

    container.appendChild(script);

    return () => {
      if (container) container.innerHTML = '';
    };
  }, []); // Runs once on mount — key-driven remount handles changes

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height: '100%', width: '100%' }}
    />
  );
};

/**
 * Embeds TradingView's Advanced Chart Widget (free tier).
 * Automatically converts the price axis to the user's selected currency
 * using TradingView's symbol-math expressions (e.g. TVC:GOLD*FX_IDC:USDINR).
 */
const TradingViewChart: React.FC<TradingViewChartProps> = ({ activeMetal, selectedCurrency }) => {
  const tvSymbol = buildSymbol(activeMetal, selectedCurrency);

  return (
    <div className="tradingview-chart-section card-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <div className="panel-title" style={{ marginBottom: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="glow-purple-text">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <h2>{METAL_LABEL[activeMetal]} Price Chart — Live</h2>
        </div>
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border-color)',
          padding: '4px 10px',
          borderRadius: '6px',
        }}>
          {selectedCurrency} / troy oz
        </span>
      </div>
      <div className="tv-chart-wrapper">
        {/* key changes on metal OR currency → full widget remount */}
        <TradingViewWidget key={`${activeMetal}-${selectedCurrency}`} symbol={tvSymbol} />
      </div>
    </div>
  );
};

export default memo(TradingViewChart);
