import React, { useEffect, useState, useRef } from 'react';
import type { SpotPrices, MetalType, CurrencyType, WeightUnit } from '../types/metals';
import { getPricePerUnit, BASE_PRICES } from '../services/priceEngine';
import { Sparkles, Activity } from 'lucide-react';

interface LivePriceCardsProps {
  prices: SpotPrices;
  selectedCurrency: CurrencyType;
  activeMetal: MetalType;
  setActiveMetal: (metal: MetalType) => void;
  weightUnit: WeightUnit;
  exchangeRates: Record<CurrencyType, number>;
}

const METAL_DETAILS: Record<MetalType, { 
  name: string; 
  description: string;
  glowClass: string; 
  gradientClass: string; 
  color: string;
  textGlow: string;
}> = {
  gold: {
    name: 'Gold',
    description: 'XAU • Safe Haven Asset',
    glowClass: 'shadow-gold',
    gradientClass: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.03) 100%)',
    color: '#EAB308',
    textGlow: '0 0 10px rgba(234, 179, 8, 0.4)',
  },
  silver: {
    name: 'Silver',
    description: 'XAG • Industrial Catalyst',
    glowClass: 'shadow-silver',
    gradientClass: 'linear-gradient(135deg, rgba(156, 163, 175, 0.1) 0%, rgba(229, 231, 235, 0.03) 100%)',
    color: '#9CA3AF',
    textGlow: '0 0 10px rgba(156, 163, 175, 0.4)',
  },
  platinum: {
    name: 'Platinum',
    description: 'XPT • Automotive & Jewelry',
    glowClass: 'shadow-platinum',
    gradientClass: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(224, 242, 254, 0.03) 100%)',
    color: '#38BDF8',
    textGlow: '0 0 10px rgba(56, 189, 248, 0.4)',
  },
  palladium: {
    name: 'Palladium',
    description: 'XPD • Electronics & Autocatalysts',
    glowClass: 'shadow-palladium',
    gradientClass: 'linear-gradient(135deg, rgba(167, 139, 250, 0.1) 0%, rgba(221, 214, 254, 0.03) 100%)',
    color: '#A78BFA',
    textGlow: '0 0 10px rgba(167, 139, 250, 0.4)',
  },
};

export const LivePriceCards: React.FC<LivePriceCardsProps> = ({
  prices,
  selectedCurrency,
  activeMetal,
  setActiveMetal,
  weightUnit,
  exchangeRates,
}) => {
  const previousPrices = useRef<SpotPrices | null>(null);
  const [pulseStates, setPulseStates] = useState<Record<MetalType, 'up' | 'down' | null>>({
    gold: null,
    silver: null,
    platinum: null,
    palladium: null,
  });

  const currencyRate = exchangeRates[selectedCurrency];

  useEffect(() => {
    if (!previousPrices.current) {
      previousPrices.current = prices;
      return;
    }

    const newPulseStates = { ...pulseStates };
    let changed = false;

    (Object.keys(prices) as Array<keyof SpotPrices>).forEach((key) => {
      if (key === 'timestamp') return;
      const metal = key as MetalType;
      const currentVal = prices[metal];
      const prevVal = previousPrices.current?.[metal] ?? currentVal;

      if (currentVal > prevVal) {
        newPulseStates[metal] = 'up';
        changed = true;
      } else if (currentVal < prevVal) {
        newPulseStates[metal] = 'down';
        changed = true;
      }
    });

    if (changed) {
      setPulseStates(newPulseStates);
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
        const basePriceUSD = BASE_PRICES[metal];
        
        // Calculate total % change from the day's baseline
        const changePercent = ((currentPriceUSD - basePriceUSD) / basePriceUSD) * 100;
        const isPositive = changePercent >= 0;

        const pulse = pulseStates[metal];
        const isSelected = activeMetal === metal;

        return (
          <div
            key={metal}
            className={`metal-card ${isSelected ? 'active' : ''} ${pulse ? `pulse-${pulse}` : ''}`}
            style={{
              background: details.gradientClass,
              border: isSelected ? `2px solid ${details.color}` : '1px solid var(--border)',
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
                  border: `1px solid ${details.color}30`
                }}
              >
                {isSelected ? <Sparkles size={12} className="spinning-sparkle" /> : <Activity size={12} />}
                <span style={{ marginLeft: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                  {isSelected ? 'Active' : 'Select'}
                </span>
              </div>
            </div>

            <div className="price-primary">
              <span className="price-main-val">
                {formatPrice(currentPriceUSD, getPricePerUnit(1, weightUnit))}
              </span>
              <span className="price-unit-oz">/ {weightUnit}</span>
            </div>

            <div className="price-change-row">
              <span className={`change-badge ${isPositive ? 'positive' : 'negative'}`}>
                {isPositive ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
              </span>
              <span className="price-sub-label">vs baseline</span>
            </div>

            <div className="price-breakdown-mini">
              {((unit: WeightUnit) => {
                const secondary = unit === 'oz' 
                  ? [{ label: 'Per Gram', u: 'g' as WeightUnit }, { label: 'Per Kilo', u: 'kg' as WeightUnit }]
                  : unit === 'g'
                  ? [{ label: 'Per Ounce', u: 'oz' as WeightUnit }, { label: 'Per Kilo', u: 'kg' as WeightUnit }]
                  : [{ label: 'Per Ounce', u: 'oz' as WeightUnit }, { label: 'Per Gram', u: 'g' as WeightUnit }];
                
                return secondary.map((sec) => (
                  <div key={sec.u} className="mini-row">
                    <span className="mini-lbl">{sec.label}</span>
                    <span className="mini-val">{formatPrice(currentPriceUSD, getPricePerUnit(1, sec.u))}</span>
                  </div>
                ));
              })(weightUnit)}
            </div>

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
