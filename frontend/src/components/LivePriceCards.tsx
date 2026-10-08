import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { SpotPrices, MetalType, CurrencyType, WeightUnit } from '../types/metals';
import { getPricePerUnit } from '../services/priceEngine';
import { COUNTRIES, countrySlug, getMetalImportDuty } from '../data/countries';
import { Sparkles, Activity, ArrowUpRight } from 'lucide-react';

interface LivePriceCardsProps {
  prices: SpotPrices;
  selectedCurrency: CurrencyType;
  activeMetal: MetalType;
  setActiveMetal: (metal: MetalType) => void;
  weightUnit: WeightUnit;
  exchangeRates: Record<CurrencyType, number>;
  /** Session change percent per metal, as reported by the upstream feed. */
  changePercents: Record<MetalType, number>;
}

const METAL_DETAILS: Record<
  MetalType,
  {
    name: string;
    description: string;
    glowClass: string;
    gradientClass: string;
    color: string;
    textGlow: string;
    priceGradient: string;
  }
> = {
  gold: {
    name: 'Gold',
    description: 'XAU • Safe Haven Asset',
    glowClass: 'shadow-gold',
    gradientClass:
      'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.03) 100%)',
    color: '#EAB308',
    textGlow: '0 0 10px rgba(234, 179, 8, 0.4)',
    priceGradient: 'linear-gradient(135deg, #FFE082 0%, #F59E0B 100%)',
  },
  silver: {
    name: 'Silver',
    description: 'XAG • Industrial Catalyst',
    glowClass: 'shadow-silver',
    gradientClass:
      'linear-gradient(135deg, rgba(156, 163, 175, 0.1) 0%, rgba(229, 231, 235, 0.03) 100%)',
    color: '#9CA3AF',
    textGlow: '0 0 10px rgba(156, 163, 175, 0.4)',
    priceGradient: 'linear-gradient(135deg, #F4F4F5 0%, #A1A1AA 100%)',
  },
  platinum: {
    name: 'Platinum',
    description: 'XPT • Automotive & Jewelry',
    glowClass: 'shadow-platinum',
    gradientClass:
      'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(224, 242, 254, 0.03) 100%)',
    color: '#38BDF8',
    textGlow: '0 0 10px rgba(56, 189, 248, 0.4)',
    priceGradient: 'linear-gradient(135deg, #BAE6FD 0%, #38BDF8 100%)',
  },
  palladium: {
    name: 'Palladium',
    description: 'XPD • Electronics & Autocatalysts',
    glowClass: 'shadow-palladium',
    gradientClass:
      'linear-gradient(135deg, rgba(167, 139, 250, 0.1) 0%, rgba(221, 214, 254, 0.03) 100%)',
    color: '#A78BFA',
    textGlow: '0 0 10px rgba(167, 139, 250, 0.4)',
    priceGradient: 'linear-gradient(135deg, #DDD6FE 0%, #A78BFA 100%)',
  },
};

export const LivePriceCards: React.FC<LivePriceCardsProps> = ({
  prices,
  selectedCurrency,
  activeMetal,
  setActiveMetal,
  weightUnit,
  exchangeRates,
  changePercents,
}) => {
  const previousPrices = useRef<SpotPrices | null>(null);
  const [pulseStates, setPulseStates] = useState<Record<MetalType, 'up' | 'down' | null>>({
    gold: null,
    silver: null,
    platinum: null,
    palladium: null,
  });

  const currencyRate = exchangeRates[selectedCurrency];
  const currentCountry = COUNTRIES.find((c) => c.currency === selectedCurrency) || COUNTRIES[0];

  useEffect(() => {
    if (!previousPrices.current) {
      previousPrices.current = prices;
      return;
    }

    const diffs: Record<MetalType, 'up' | 'down' | null> = {
      gold: null,
      silver: null,
      platinum: null,
      palladium: null,
    };
    let changed = false;

    (Object.keys(prices) as Array<keyof SpotPrices>).forEach((key) => {
      if (key === 'timestamp') return;
      const metal = key as MetalType;
      const currentVal = prices[metal];
      const prevVal = previousPrices.current?.[metal] ?? currentVal;

      if (currentVal > prevVal) {
        diffs[metal] = 'up';
        changed = true;
      } else if (currentVal < prevVal) {
        diffs[metal] = 'down';
        changed = true;
      }
    });

    if (changed) {
      setPulseStates((prev) => {
        const next = { ...prev };
        (Object.keys(diffs) as MetalType[]).forEach((m) => {
          if (diffs[m] !== null) {
            next[m] = diffs[m];
          }
        });
        return next;
      });

      const timer = setTimeout(() => {
        setPulseStates({
          gold: null,
          silver: null,
          platinum: null,
          palladium: null,
        });
      }, 1500); // Pulse lasts 1.5s

      previousPrices.current = prices;
      return () => clearTimeout(timer);
    } else {
      previousPrices.current = prices;
    }
  }, [prices]);

  const formatPrice = (valUSD: number, multiplier: number) => {
    const valConverted = valUSD * multiplier * currencyRate;
    // Format appropriately (more decimals for small silver prices, less for gold)
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: selectedCurrency,
      minimumFractionDigits: valConverted > 1000 ? 2 : 3,
      maximumFractionDigits: valConverted > 1000 ? 2 : 4,
    }).format(valConverted);
  };

  return (
    <div className="grid-metals">
      {(Object.keys(METAL_DETAILS) as MetalType[]).map((metal) => {
        const details = METAL_DETAILS[metal];
        const currentPriceUSD = prices[metal];
        const changePercent = changePercents[metal] ?? 0;
        const isPositive = changePercent >= 0;

        const pulse = pulseStates[metal];
        const isSelected = activeMetal === metal;

        // Base spot price scaled by weight unit
        const baseSpotPriceTarget = currentPriceUSD * currencyRate * getPricePerUnit(1, weightUnit);

        // Import duty
        const dutyPercent = getMetalImportDuty(currentCountry, metal);
        const importDutyVal = baseSpotPriceTarget * (dutyPercent / 100);
        const localPriceWithDuty = baseSpotPriceTarget + importDutyVal;

        return (
          <div
            key={metal}
            className={`metal-card ${isSelected ? 'active' : ''} ${pulse ? `pulse-${pulse}` : ''}`}
            style={{
              background: details.gradientClass,
              borderColor: isSelected ? details.color : 'var(--border-color)',
              boxShadow: isSelected ? `0 0 20px ${details.color}25` : 'none',
            }}
            onClick={() => setActiveMetal(metal)}
          >
            <div className="metal-card-header">
              <div>
                <h3>{details.name}</h3>
                <span className="metal-symbol">{details.description}</span>
              </div>
              <div
                className="metal-badge"
                style={{
                  backgroundColor: `${details.color}15`,
                  color: details.color,
                  border: `1px solid ${details.color}30`,
                }}
              >
                {isSelected ? (
                  <Sparkles size={12} className="spinning-sparkle" />
                ) : (
                  <Activity size={12} />
                )}
                <span style={{ marginLeft: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                  {isSelected ? 'Active' : 'Select'}
                </span>
              </div>
            </div>

            <div
              className="card-prices-section"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginTop: '14px',
                marginBottom: '14px',
              }}
            >
              {/* Highlighted Local Price Row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '24px',
                }}
                title={`This is the spot price of ${details.name} in ${selectedCurrency} including ${currentCountry.name}'s import duty (${dutyPercent}%) but before local VAT/GST and dealer markup.`}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}
                >
                  <span style={{ fontSize: '15px' }}>{currentCountry.flag}</span>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>
                    Local Spot (Duty Paid)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '15px',
                      fontWeight: '700',
                      background: details.priceGradient,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {new Intl.NumberFormat(undefined, {
                      style: 'currency',
                      currency: selectedCurrency,
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(localPriceWithDuty)}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    /{weightUnit}
                  </span>
                </div>
              </div>

              {/* Smaller International Spot Price Row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '22px',
                }}
                title={`This is the raw international spot price of ${details.name} in ${selectedCurrency} without any local tariffs, duties, or taxes.`}
              >
                <span
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    fontWeight: '500',
                    marginRight: '8px',
                  }}
                >
                  International Spot
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatPrice(currentPriceUSD, getPricePerUnit(1, weightUnit))}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    /{weightUnit}
                  </span>
                </div>
              </div>

              {/* Duty Breakdown Subtitle */}
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px dashed var(--border-color)',
                  paddingTop: '6px',
                  marginTop: '2px',
                  minHeight: '20px',
                }}
                title={`Calculation: Base spot value (${new Intl.NumberFormat(undefined, { style: 'currency', currency: selectedCurrency }).format(baseSpotPriceTarget)}) + ${dutyPercent}% Import Duty (${new Intl.NumberFormat(undefined, { style: 'currency', currency: selectedCurrency }).format(importDutyVal)})`}
              >
                <span style={{ marginRight: '8px' }}>Base (converted)</span>
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontWeight: '500',
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: selectedCurrency,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(baseSpotPriceTarget)}{' '}
                  + {dutyPercent}% Duty (
                  {new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: selectedCurrency,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(importDutyVal)}
                  )
                </span>
              </div>
            </div>

            <div className="price-change-row">
              <span className={`change-badge ${isPositive ? 'positive' : 'negative'}`}>
                {isPositive ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
              </span>
              <span className="price-sub-label">vs baseline</span>
            </div>

            <div className="price-breakdown-mini">
              {((unit: WeightUnit) => {
                const secondary =
                  unit === 'oz'
                    ? [
                        { label: 'Per Gram', u: 'g' as WeightUnit },
                        { label: 'Per Kilo', u: 'kg' as WeightUnit },
                      ]
                    : unit === 'g'
                      ? [
                          { label: 'Per Ounce', u: 'oz' as WeightUnit },
                          { label: 'Per Kilo', u: 'kg' as WeightUnit },
                        ]
                      : [
                          { label: 'Per Ounce', u: 'oz' as WeightUnit },
                          { label: 'Per Gram', u: 'g' as WeightUnit },
                        ];

                return secondary.map((sec) => (
                  <div
                    key={sec.u}
                    className="mini-row"
                    title={`Alternative international spot price for 1 ${sec.u} of ${details.name} in ${selectedCurrency}.`}
                  >
                    <span className="mini-lbl">{sec.label}</span>
                    <span className="mini-val">
                      {formatPrice(currentPriceUSD, getPricePerUnit(1, sec.u))}
                    </span>
                  </div>
                ));
              })(weightUnit)}
            </div>

            <Link
              to={`/${countrySlug(currentCountry)}/${metal}/`}
              className="metal-card-details-link"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '12px',
                padding: '8px 0',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '12px',
                fontWeight: 600,
                color: details.color,
                textDecoration: 'none',
                opacity: 0.8,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            >
              View {details.name} Prices <ArrowUpRight size={14} />
            </Link>

            {pulse && (
              <div className={`pulse-indicator ${pulse}`}>
                {pulse === 'up' ? '▲ Price Gained' : '▼ Price Dropped'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
