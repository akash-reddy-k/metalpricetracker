import React, { useState, useEffect } from 'react';
import type { MetalType, CurrencyType, WeightUnit, CalculationResult } from '../types/metals';
import { COUNTRIES, PURITY_OPTIONS, EXCHANGE_RATES, CURRENCY_SYMBOLS, isGoldVatExempt } from '../data/countries';
import { WEIGHT_CONVERSIONS } from '../services/priceEngine';
import { Calculator as CalcIcon, FileText, Info, Award, Globe, Scale } from 'lucide-react';

interface CalculatorProps {
  activeMetal: MetalType;
  setActiveMetal: (metal: MetalType) => void;
  spotPrices: { gold: number; silver: number; platinum: number; palladium: number };
  selectedCurrency: CurrencyType;
  setSelectedCurrency: (currency: CurrencyType) => void;
}

export const Calculator: React.FC<CalculatorProps> = ({
  activeMetal,
  setActiveMetal,
  spotPrices,
  selectedCurrency,
  setSelectedCurrency,
}) => {
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('US');
  const [weight, setWeight] = useState<number>(1);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('oz');
  
  // Purity option index
  const purities = PURITY_OPTIONS[activeMetal];
  const [selectedPurityIndex, setSelectedPurityIndex] = useState<number>(0);
  
  // Custom dealer premium percentage override (null means use country default)
  const [customPremium, setCustomPremium] = useState<string>('');

  const currentCountry = COUNTRIES.find((c) => c.code === selectedCountryCode) || COUNTRIES[0];

  // Sync country currency with selected currency
  useEffect(() => {
    setSelectedCurrency(currentCountry.currency);
  }, [selectedCountryCode, currentCountry]);

  // Sync purity index when metal changes
  useEffect(() => {
    setSelectedPurityIndex(0);
  }, [activeMetal]);

  // Calculation Logic
  const calculateCosts = (): CalculationResult => {
    const spotPriceUSD = spotPrices[activeMetal];
    const exchangeRate = EXCHANGE_RATES[selectedCurrency];
    const spotPriceTarget = spotPriceUSD * exchangeRate;

    // Convert weight to ounces
    let weightInOz = weight;
    if (weightUnit === 'g') {
      weightInOz = weight * WEIGHT_CONVERSIONS.g;
    } else if (weightUnit === 'kg') {
      weightInOz = weight * WEIGHT_CONVERSIONS.kg;
    }

    const baseSpotValue = spotPriceTarget * weightInOz;
    
    // Purity adjustment
    const activePurity = purities[selectedPurityIndex]?.value ?? 1;
    const rawMetalValue = baseSpotValue * activePurity;

    // Government levies
    const dutyPercent = currentCountry.importDuty;
    const importDutyValue = rawMetalValue * (dutyPercent / 100);

    // VAT/GST: Applied on (Raw Metal Value + Import Duty)
    const isExempt = activeMetal === 'gold' && isGoldVatExempt(currentCountry.code);
    const vatPercent = isExempt ? 0 : currentCountry.vatGst;
    const vatGstValue = (rawMetalValue + importDutyValue) * (vatPercent / 100);

    // Dealer premium
    const premiumPercent = customPremium !== '' ? parseFloat(customPremium) || 0 : currentCountry.dealerPremium;
    const dealerPremiumValue = rawMetalValue * (premiumPercent / 100) + (currentCountry.fixedMintFeePerOz * weightInOz * exchangeRate);

    // Final consumer price
    const finalPrice = rawMetalValue + importDutyValue + vatGstValue + dealerPremiumValue;

    return {
      metal: activeMetal,
      weight,
      weightUnit,
      purity: activePurity,
      purityLabel: purities[selectedPurityIndex]?.label ?? 'Fine',
      currency: selectedCurrency,
      spotPricePerOzUSD: spotPriceUSD,
      spotPricePerOzTarget: spotPriceTarget,
      weightInOz,
      baseSpotValue,
      rawMetalValue,
      importDutyValue,
      vatGstValue,
      dealerPremiumValue,
      finalPrice,
      exchangeRate,
    };
  };

  const res = calculateCosts();
  const symbol = CURRENCY_SYMBOLS[selectedCurrency];

  const formatCost = (val: number) => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: selectedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Percentages for bar chart
  const taxSum = res.importDutyValue + res.vatGstValue;
  const rawPct = res.finalPrice > 0 ? (res.rawMetalValue / res.finalPrice) * 100 : 0;
  const taxPct = res.finalPrice > 0 ? (taxSum / res.finalPrice) * 100 : 0;
  const premPct = res.finalPrice > 0 ? (res.dealerPremiumValue / res.finalPrice) * 100 : 0;

  return (
    <div className="calculator-wrapper">
      <div className="card-panel">
        <div className="panel-title">
          <CalcIcon size={20} className="glow-purple-text" />
          <h2>Tax & Localization Calculator</h2>
        </div>
        <p className="panel-subtitle">Compute final retail prices including global tariffs, state VAT/GST, and premiums.</p>

        <div className="calc-inputs-grid">
          {/* Target Country */}
          <div className="input-group">
            <label htmlFor="calc-country">
              <Globe size={14} /> Destination Country
            </label>
            <select
              id="calc-country"
              value={selectedCountryCode}
              onChange={(e) => setSelectedCountryCode(e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Metal Type */}
          <div className="input-group">
            <label htmlFor="calc-metal">Precious Metal</label>
            <select
              id="calc-metal"
              value={activeMetal}
              onChange={(e) => setActiveMetal(e.target.value as MetalType)}
            >
              <option value="gold">Gold (XAU)</option>
              <option value="silver">Silver (XAG)</option>
              <option value="platinum">Platinum (XPT)</option>
              <option value="palladium">Palladium (XPD)</option>
            </select>
          </div>

          {/* Weight */}
          <div className="input-group">
            <label htmlFor="calc-weight">
              <Scale size={14} /> Weight Amount
            </label>
            <div className="weight-input-wrapper">
              <input
                id="calc-weight"
                type="number"
                min="0.001"
                step="any"
                value={weight}
                onChange={(e) => setWeight(Math.max(0.001, parseFloat(e.target.value) || 0))}
              />
              <select
                aria-label="Weight Unit"
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
              >
                <option value="oz">oz (troy)</option>
                <option value="g">g (grams)</option>
                <option value="kg">kg (kilos)</option>
              </select>
            </div>
          </div>

          {/* Purity */}
          <div className="input-group">
            <label htmlFor="calc-purity">Fineness / Purity</label>
            <select
              id="calc-purity"
              value={selectedPurityIndex}
              onChange={(e) => setSelectedPurityIndex(parseInt(e.target.value, 10))}
            >
              {purities.map((p, idx) => (
                <option key={idx} value={idx}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dealer Premium Override */}
          <div className="input-group">
            <label htmlFor="calc-premium">
              Premium Override (%)
            </label>
            <input
              id="calc-premium"
              type="number"
              placeholder={`${currentCountry.dealerPremium}% (Default)`}
              value={customPremium}
              min="0"
              max="100"
              step="0.1"
              onChange={(e) => setCustomPremium(e.target.value)}
            />
          </div>
        </div>

        {/* Local Rate Details */}
        <div className="tax-info-box">
          <div className="info-badge">
            <Award size={14} style={{ color: 'var(--accent)' }} />
            <span>Country Tax Profile:</span>
          </div>
          <div className="rates-summary-flex">
            <span>Import Duty: <strong>{currentCountry.importDuty}%</strong></span>
            <span>VAT/GST: <strong>{activeMetal === 'gold' && isGoldVatExempt(currentCountry.code) ? '0% (Exempt)' : `${currentCountry.vatGst}%`}</strong></span>
            <span>Mint Premium: <strong>{customPremium !== '' ? `${customPremium}%` : `${currentCountry.dealerPremium}%`} + {symbol}{(currentCountry.fixedMintFeePerOz * EXCHANGE_RATES[selectedCurrency]).toFixed(2)}/oz</strong></span>
          </div>
        </div>
      </div>

      {/* Itemized Receipt Output */}
      <div className="receipt-panel">
        <div className="panel-title">
          <FileText size={20} className="glow-gold-text" />
          <h2>Itemized Cost Receipt</h2>
        </div>
        <p className="panel-subtitle">Financial breakdown of localized acquisition cost.</p>

        <div className="receipt-sheet">
          <div className="receipt-row header">
            <span>Description</span>
            <span>Subtotal ({selectedCurrency})</span>
          </div>

          <div className="receipt-row">
            <div>
              <span>Raw Metal Spot Value</span>
              <small>{res.weight} {res.weightUnit} @ {res.purityLabel}</small>
            </div>
            <span>{formatCost(res.rawMetalValue)}</span>
          </div>

          <div className="receipt-row">
            <div>
              <span>Import Tariffs & Duties</span>
              <small>{currentCountry.importDuty}% of Metal Value</small>
            </div>
            <span>{formatCost(res.importDutyValue)}</span>
          </div>

          <div className="receipt-row">
            <div>
              <span>Value Added Tax (VAT / GST)</span>
              <small>
                {activeMetal === 'gold' && isGoldVatExempt(currentCountry.code)
                  ? 'Exempt (Investment Gold)'
                  : `${currentCountry.vatGst}% on (Metal + Duty)`}
              </small>
            </div>
            <span className={activeMetal === 'gold' && isGoldVatExempt(currentCountry.code) ? 'exempt-text' : ''}>
              {formatCost(res.vatGstValue)}
            </span>
          </div>

          <div className="receipt-row">
            <div>
              <span>Dealer & Mint Premium</span>
              <small>Processing, handling, and broker markup</small>
            </div>
            <span>{formatCost(res.dealerPremiumValue)}</span>
          </div>

          <div className="receipt-divider"></div>

          <div className="receipt-row total">
            <span>Total Consumer Cost</span>
            <span>{formatCost(res.finalPrice)}</span>
          </div>

          {/* Proportional cost visualizer */}
          <div className="proportional-cost-bar">
            <div className="bar-labels">
              <span className="lbl-metal">Metal Value ({rawPct.toFixed(1)}%)</span>
              <span className="lbl-tax">Govt Taxes ({taxPct.toFixed(1)}%)</span>
              <span className="lbl-premium">Premium ({premPct.toFixed(1)}%)</span>
            </div>
            <div className="stacked-bar">
              <div className="bar-chunk metal" style={{ width: `${rawPct}%` }} title="Raw Metal Value"></div>
              <div className="bar-chunk tax" style={{ width: `${taxPct}%` }} title="Govt Tariffs & Taxes"></div>
              <div className="bar-chunk premium" style={{ width: `${premPct}%` }} title="Dealer/Broker Premiums"></div>
            </div>
          </div>

          {/* Arbitrage/Exemption info note */}
          <div className="tax-note">
            <Info size={12} className="note-icon" />
            <p>
              Prices are calculated using the live exchange rate of 1 USD = {res.exchangeRate.toFixed(4)} {selectedCurrency}. 
              Local dealer premiums and minting charges vary based on physical product format (coins vs. bars).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
