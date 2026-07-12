import React, { useState, useMemo, useCallback } from 'react';
import type { MetalType, CurrencyType, CountryTaxConfig, WeightUnit } from '../types/metals';
import { COUNTRIES, CURRENCY_SYMBOLS, isGoldVatExempt } from '../data/countries';
import { generateHistoricalData, WEIGHT_CONVERSIONS } from '../services/priceEngine';
import { TrendingUp, Percent, ArrowLeftRight, Layers } from 'lucide-react';

interface AnalyticsChartProps {
  activeMetal: MetalType;
  selectedCurrency: CurrencyType;
  spotPrices: {
    gold: number;
    silver: number;
    platinum: number;
    palladium: number;
    timestamp: number;
  };
  weightUnit: WeightUnit;
  exchangeRates: Record<CurrencyType, number>;
}

const TIMEFRAMES: Array<{ label: string; value: '24h' | '7d' | '30d' | '1y' | '5y' }> = [
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '1 Year', value: '1y' },
  { label: '5 Years', value: '5y' },
];

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  activeMetal,
  selectedCurrency,
  spotPrices,
  weightUnit,
  exchangeRates,
}) => {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | '1y' | '5y'>('30d');

  // Country comparison selection (Default A: India/IN, Default B: US)
  const [countryACode, setCountryACode] = useState<string>('IN');
  const [countryBCode, setCountryBCode] = useState<string>('US');
  const [compareEnabled, setCompareEnabled] = useState<boolean>(true);

  // Tooltip tracking
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const countryA = COUNTRIES.find((c) => c.code === countryACode) || COUNTRIES[0];
  const countryB = COUNTRIES.find((c) => c.code === countryBCode) || COUNTRIES[1];

  // 1. Generate core historical spot prices in USD
  const historyData = useMemo(() => {
    return generateHistoricalData(timeframe, spotPrices);
  }, [timeframe, spotPrices]);

  // Dynamic formula to calculate total retail markup / duty / VAT localized cost
  const getFinalPriceInActiveCurrency = useCallback(
    (spotPriceUSD: number, country: CountryTaxConfig): number => {
      // 1. Convert spot USD to country currency
      const rateToCountry = exchangeRates[country.currency];
      const spotPriceCountry = spotPriceUSD * rateToCountry;

      // 2. Adjust for purity (compare 24k/fine 99.9% as benchmark for arbitrage)
      const rawValueCountry = spotPriceCountry * 0.999;

      // 3. Import duty
      const importDuty = rawValueCountry * (country.importDuty / 100);

      // 4. VAT/GST
      const isExempt = activeMetal === 'gold' && isGoldVatExempt(country.code);
      const vatPercent = isExempt ? 0 : country.vatGst;
      const vatGst = (rawValueCountry + importDuty) * (vatPercent / 100);

      // 5. Dealer premium
      const premium =
        rawValueCountry * (country.dealerPremium / 100) + country.fixedMintFeePerOz * rateToCountry;

      // Final price in country local currency
      const finalPriceCountry = rawValueCountry + importDuty + vatGst + premium;

      // 6. Convert final price back to the dashboard's active currency
      const rateToActive = exchangeRates[selectedCurrency];
      const finalPriceActiveCurrency = (finalPriceCountry / rateToCountry) * rateToActive;

      return finalPriceActiveCurrency;
    },
    [activeMetal, exchangeRates, selectedCurrency]
  );

  // Convert history data points
  const chartPoints = useMemo(() => {
    const activeRate = exchangeRates[selectedCurrency];
    const unitMultiplier = WEIGHT_CONVERSIONS[weightUnit];

    return historyData.map((pt) => {
      const spotUSD = pt.prices[activeMetal];
      const spotPriceActive = spotUSD * activeRate * unitMultiplier;

      const priceA = getFinalPriceInActiveCurrency(spotUSD, countryA) * unitMultiplier;
      const priceB = compareEnabled
        ? getFinalPriceInActiveCurrency(spotUSD, countryB) * unitMultiplier
        : 0;

      return {
        timestamp: pt.timestamp,
        spotPrice: spotPriceActive,
        priceA,
        priceB,
      };
    });
  }, [
    historyData,
    countryA,
    countryB,
    compareEnabled,
    activeMetal,
    selectedCurrency,
    weightUnit,
    exchangeRates,
    getFinalPriceInActiveCurrency,
  ]);

  // Chart bounds & scales
  const chartWidth = 780;
  const chartHeight = 280;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  // Find min/max values to scale Y-axis
  const { minY, maxY } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    chartPoints.forEach((pt) => {
      min = Math.min(min, pt.spotPrice, pt.priceA, compareEnabled ? pt.priceB : pt.spotPrice);
      max = Math.max(max, pt.spotPrice, pt.priceA, compareEnabled ? pt.priceB : pt.spotPrice);
    });

    // Add padding to margins
    const delta = max - min;
    return {
      minY: Math.max(0, min - delta * 0.15),
      maxY: max + delta * 0.15,
    };
  }, [chartPoints, compareEnabled]);

  // Project points into SVG viewport coordinates
  const svgCoords = useMemo(() => {
    if (chartPoints.length === 0) return [];

    return chartPoints.map((pt, index) => {
      const x = paddingLeft + (index / (chartPoints.length - 1)) * innerWidth;

      const ySpot =
        paddingTop + innerHeight - ((pt.spotPrice - minY) / (maxY - minY)) * innerHeight;
      const yA = paddingTop + innerHeight - ((pt.priceA - minY) / (maxY - minY)) * innerHeight;
      const yB = compareEnabled
        ? paddingTop + innerHeight - ((pt.priceB - minY) / (maxY - minY)) * innerHeight
        : ySpot;

      return { x, ySpot, yA, yB, ...pt };
    });
  }, [chartPoints, minY, maxY, innerWidth, innerHeight, compareEnabled]);

  // Path generators
  const getLinePath = (coords: Array<{ x: number; y: number }>) => {
    if (coords.length === 0) return '';
    return coords.reduce((path, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`;
    }, '');
  };

  const getAreaPath = (coords: Array<{ x: number; y: number }>) => {
    if (coords.length === 0) return '';
    const linePath = getLinePath(coords);
    const last = coords[coords.length - 1];
    const first = coords[0];
    const bottomY = paddingTop + innerHeight;
    return `${linePath} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  };

  // Format timestamps for X axis
  const formatXLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeframe === '24h') {
      return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: false,
      });
    }
    if (timeframe === '7d') {
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'numeric',
        day: 'numeric',
      });
    }
    if (timeframe === '30d') {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString(undefined, { year: '2-digit', month: 'short' });
  };

  const xTicksIndices = useMemo(() => {
    const len = chartPoints.length;
    if (len <= 5) return chartPoints.map((_, i) => i);
    return [0, Math.floor(len / 4), Math.floor(len / 2), Math.floor((3 * len) / 4), len - 1];
  }, [chartPoints]);

  const yTicks = useMemo(() => {
    const ticks = [];
    const step = (maxY - minY) / 4;
    for (let i = 0; i <= 4; i++) {
      ticks.push(minY + step * i);
    }
    return ticks;
  }, [minY, maxY]);

  const activeSymbol = CURRENCY_SYMBOLS[selectedCurrency];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    // Find closest index in coords
    let closestIndex = 0;
    let minDistance = Infinity;

    svgCoords.forEach((p, idx) => {
      const dist = Math.abs(p.x - x);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    setHoverIndex(closestIndex);
  };

  // Hovered item calculations
  const hoveredPoint = hoverIndex !== null ? svgCoords[hoverIndex] : null;

  // Metal theme colors
  const metalColorMap: Record<MetalType, string> = {
    gold: '#F59E0B',
    silver: '#9CA3AF',
    platinum: '#38BDF8',
    palladium: '#A78BFA',
  };
  const metalColor = metalColorMap[activeMetal];

  return (
    <div className="analytics-container card-panel">
      <div className="analytics-header">
        <div className="panel-title">
          <TrendingUp size={20} className="glow-purple-text" />
          <h2>Interactive Analytics Dashboard</h2>
        </div>
        <div className="timeframe-toggles">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              className={`tf-btn ${timeframe === tf.value ? 'active' : ''}`}
              onClick={() => setTimeframe(tf.value)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Controls */}
      <div className="comparison-bar">
        <div className="compare-checkbox-wrapper">
          <input
            id="compare-enabled-chk"
            type="checkbox"
            checked={compareEnabled}
            onChange={(e) => setCompareEnabled(e.target.checked)}
          />
          <label htmlFor="compare-enabled-chk" className="compare-chk-label">
            <ArrowLeftRight size={14} /> Compare Arbitrage (Overlay Two Countries)
          </label>
        </div>

        {compareEnabled && (
          <div className="compare-selectors-flex">
            <div className="comp-select-grp">
              <span className="dot-indicator country-a"></span>
              <select
                aria-label="Country A"
                value={countryACode}
                onChange={(e) => setCountryACode(e.target.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="vs-txt">vs</span>

            <div className="comp-select-grp">
              <span className="dot-indicator country-b"></span>
              <select
                aria-label="Country B"
                value={countryBCode}
                onChange={(e) => setCountryBCode(e.target.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Chart SVG Canvas */}
      <div className="chart-canvas-wrapper" style={{ position: 'relative' }}>
        <svg
          className="analytics-svg"
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metalColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={metalColor} stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="area-a" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.20" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="area-b" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((val, idx) => {
            const y = paddingTop + innerHeight - ((val - minY) / (maxY - minY)) * innerHeight;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  fill="var(--text)"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="var(--mono)"
                >
                  {activeSymbol}
                  {Math.round(val).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* X ticks */}
          {xTicksIndices.map((idx) => {
            if (idx >= svgCoords.length) return null;
            const pt = svgCoords[idx];
            return (
              <g key={idx}>
                <line
                  x1={pt.x}
                  y1={paddingTop + innerHeight}
                  x2={pt.x}
                  y2={paddingTop + innerHeight + 6}
                  stroke="var(--border)"
                  strokeWidth="1.5"
                />
                <text
                  x={pt.x}
                  y={paddingTop + innerHeight + 20}
                  fill="var(--text)"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {formatXLabel(pt.timestamp)}
                </text>
              </g>
            );
          })}

          {/* Base Spot Price Line */}
          {!compareEnabled && (
            <>
              <path
                d={getAreaPath(svgCoords.map((c) => ({ x: c.x, y: c.ySpot })))}
                fill="url(#area-grad)"
              />
              <path
                d={getLinePath(svgCoords.map((c) => ({ x: c.x, y: c.ySpot })))}
                fill="none"
                stroke={metalColor}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Country A Cost Line */}
          {compareEnabled && (
            <>
              <path
                d={getAreaPath(svgCoords.map((c) => ({ x: c.x, y: c.yA })))}
                fill="url(#area-a)"
              />
              <path
                d={getLinePath(svgCoords.map((c) => ({ x: c.x, y: c.yA })))}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3.0"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Country B Cost Line */}
          {compareEnabled && (
            <>
              <path
                d={getAreaPath(svgCoords.map((c) => ({ x: c.x, y: c.yB })))}
                fill="url(#area-b)"
              />
              <path
                d={getLinePath(svgCoords.map((c) => ({ x: c.x, y: c.yB })))}
                fill="none"
                stroke="#10B981"
                strokeWidth="3.0"
                strokeLinecap="round"
                strokeDasharray="1"
              />
            </>
          )}

          {/* Interactive vertical hover guide line */}
          {hoveredPoint && (
            <line
              x1={hoveredPoint.x}
              y1={paddingTop}
              x2={hoveredPoint.x}
              y2={paddingTop + innerHeight}
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          )}

          {/* Hover dots */}
          {hoveredPoint && (
            <>
              {!compareEnabled && (
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.ySpot}
                  r="5"
                  fill={metalColor}
                  stroke="var(--bg)"
                  strokeWidth="2"
                />
              )}
              {compareEnabled && (
                <>
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.yA}
                    r="5"
                    fill="var(--accent)"
                    stroke="var(--bg)"
                    strokeWidth="2"
                  />
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.yB}
                    r="5"
                    fill="#10B981"
                    stroke="var(--bg)"
                    strokeWidth="2"
                  />
                </>
              )}
            </>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className="chart-tooltip"
            style={{
              position: 'absolute',
              top: `${Math.min(100, Math.max(10, mousePos.y - 150))}px`,
              left: `${hoveredPoint.x > chartWidth / 2 ? hoveredPoint.x - 260 : hoveredPoint.x + 20}px`,
              zIndex: 10,
            }}
          >
            <div className="tooltip-time">
              {new Date(hoveredPoint.timestamp).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
            <div className="tooltip-divider"></div>

            <div className="tooltip-row spot">
              <span>Spot Price ({weightUnit}):</span>
              <strong>
                {activeSymbol}
                {hoveredPoint.spotPrice.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>

            {compareEnabled ? (
              <>
                <div className="tooltip-row country-a-val">
                  <span>
                    {countryA.flag} {countryA.name} ({weightUnit}):
                  </span>
                  <strong>
                    {activeSymbol}
                    {hoveredPoint.priceA.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>

                <div className="tooltip-row country-b-val">
                  <span>
                    {countryB.flag} {countryB.name} ({weightUnit}):
                  </span>
                  <strong>
                    {activeSymbol}
                    {hoveredPoint.priceB.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>

                <div className="tooltip-divider"></div>

                {/* Arbitrage Metrics */}
                {(() => {
                  const difference = Math.abs(hoveredPoint.priceA - hoveredPoint.priceB);
                  const lower = Math.min(hoveredPoint.priceA, hoveredPoint.priceB);
                  const diffPct = lower > 0 ? (difference / lower) * 100 : 0;
                  const isAOverB = hoveredPoint.priceA > hoveredPoint.priceB;
                  const premiumCountry = isAOverB ? countryA : countryB;
                  const discountCountry = isAOverB ? countryB : countryA;

                  return (
                    <div className="tooltip-arbitrage">
                      <div className="arb-title">
                        <Layers size={11} /> Arbitrage & Tax-Gap Info
                      </div>
                      <div className="arb-row">
                        <span>Price Spread:</span>
                        <strong className="spread-accent">
                          {activeSymbol}
                          {difference.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </div>
                      <div className="arb-row">
                        <span>Gap Percentage:</span>
                        <strong>{diffPct.toFixed(2)}%</strong>
                      </div>
                      <div className="arb-suggestion">
                        {premiumCountry.flag} is {diffPct.toFixed(1)}% more expensive than{' '}
                        {discountCountry.flag} due to local tax rates & import tariffs.
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="tooltip-row">
                <span style={{ color: metalColor }}>
                  {activeMetal.toUpperCase()} ({weightUnit}):
                </span>
                <strong>
                  {activeSymbol}
                  {hoveredPoint.priceA.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Arbitrage Insight Summary card */}
      {compareEnabled && (
        <div className="arbitrage-insight-footer">
          <div className="insight-icon-box">
            <Percent size={18} />
          </div>
          <div className="insight-content">
            <h4>
              Global Price Disparity Analysis ({countryA.name} vs. {countryB.name})
            </h4>
            <p>
              Under current policies, {countryA.name} imposes an import duty of{' '}
              {countryA.importDuty}% and a local tax of{' '}
              {isGoldVatExempt(countryA.code) && activeMetal === 'gold'
                ? '0% (Gold exempt)'
                : `${countryA.vatGst}%`}
              . In comparison, {countryB.name} has a duty of {countryB.importDuty}% and local tax of{' '}
              {isGoldVatExempt(countryB.code) && activeMetal === 'gold'
                ? '0% (Gold exempt)'
                : `${countryB.vatGst}%`}
              . This causes a persistent price gap between physical metal retail quotes in these
              countries.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
