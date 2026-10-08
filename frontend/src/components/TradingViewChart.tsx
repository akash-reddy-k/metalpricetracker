import React, { useEffect, useRef, memo } from 'react';
import type { MetalType } from '../types/metals';

interface TradingViewChartProps {
  activeMetal: MetalType;
}

const TV_SYMBOLS: Record<MetalType, string> = {
  gold: 'TVC:GOLD',
  silver: 'TVC:SILVER',
  platinum: 'TVC:PLATINUM',
  palladium: 'TVC:PALLADIUM',
};

const METAL_LABEL: Record<MetalType, string> = {
  gold: 'Gold',
  silver: 'Silver',
  platinum: 'Platinum',
  palladium: 'Palladium',
};

/**
 * Embeds TradingView's Advanced Chart Widget (free tier).
 * The widget loads via an external script and renders a full-featured
 * interactive chart with candlesticks, indicators, drawing tools, and
 * multiple timeframes — matching what users expect from financial sites.
 */
const TradingViewChart: React.FC<TradingViewChartProps> = ({ activeMetal }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear any previous widget instance
    container.innerHTML = '';

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
      symbol: TV_SYMBOLS[activeMetal],
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
      details: true,
    });

    container.appendChild(script);

    return () => {
      // Cleanup on unmount or metal change
      if (container) container.innerHTML = '';
    };
  }, [activeMetal]);

  return (
    <div className="tradingview-chart-section card-panel">
      <div className="panel-title" style={{ marginBottom: '12px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="glow-purple-text">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <h2>{METAL_LABEL[activeMetal]} Price Chart — Live</h2>
      </div>
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        style={{
          height: '500px',
          width: '100%',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}
      />
    </div>
  );
};

export default memo(TradingViewChart);
