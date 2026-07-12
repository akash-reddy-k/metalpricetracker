import React, { useState, useEffect } from 'react';
import type { MetalType, CurrencyType, WeightUnit, CalculationResult } from '../types/metals';
import { COUNTRIES, PURITY_OPTIONS, CURRENCY_SYMBOLS, isGoldVatExempt } from '../data/countries';
import { WEIGHT_CONVERSIONS } from '../services/priceEngine';
import { Calculator as CalcIcon, FileText, Info, Award, Scale } from 'lucide-react';

interface CalculatorProps {
  activeMetal: MetalType;
  setActiveMetal: (metal: MetalType) => void;
  spotPrices: { gold: number; silver: number; platinum: number; palladium: number };
  selectedCurrency: CurrencyType;
  weightUnit: WeightUnit;
  exchangeRates: Record<CurrencyType, number>;
}

export const Calculator: React.FC<CalculatorProps> = ({
  activeMetal,
  setActiveMetal,
  spotPrices,
  selectedCurrency,
  weightUnit,
  exchangeRates,
}) => {
  const [weight, setWeight] = useState<number>(1);
  const [localWeightUnit, setLocalWeightUnit] = useState<WeightUnit>(weightUnit);

  // Purity option index
  const purities = PURITY_OPTIONS[activeMetal];
  const [selectedPurityIndex, setSelectedPurityIndex] = useState<number>(0);

  // Product format & consolidated dealer charges percentage override (empty means use default)
  const [productType, setProductType] = useState<'bullion' | 'jewellery'>('bullion');
  const [dealerCharges, setDealerCharges] = useState<string>('');

  // Custom fixed mint/processing fee (only for bullion)
  const [customMintFee, setCustomMintFee] = useState<string>('');

  const currentCountry = COUNTRIES.find((c) => c.currency === selectedCurrency) || COUNTRIES[0];

  // Sync local weight unit when global header weight unit changes
  useEffect(() => {
    setLocalWeightUnit(weightUnit);
  }, [weightUnit]);

  // Sync purity index when metal changes
  useEffect(() => {
    setSelectedPurityIndex(0);
  }, [activeMetal]);

  // Reset local weight and unit when country changes
  useEffect(() => {
    if (currentCountry.defaultWeight !== undefined) {
      setWeight(currentCountry.defaultWeight);
    }
    if (currentCountry.defaultUnit !== undefined) {
      setLocalWeightUnit(currentCountry.defaultUnit);
    }
  }, [currentCountry]);

  // Calculation Logic
  const calculateCosts = (): CalculationResult => {
    const spotPriceUSD = spotPrices[activeMetal];
    const exchangeRate = exchangeRates[selectedCurrency];
    const spotPriceTarget = spotPriceUSD * exchangeRate;

    // Convert weight to ounces based on localWeightUnit
    let weightInOz = weight;
    if (localWeightUnit === 'g') {
      weightInOz = weight * WEIGHT_CONVERSIONS.g;
    } else if (localWeightUnit === 'kg') {
      weightInOz = weight * WEIGHT_CONVERSIONS.kg;
    }

    const baseSpotValue = spotPriceTarget * weightInOz;

    // Purity adjustment
    const activePurity = purities[selectedPurityIndex]?.value ?? 1;
    const rawMetalValue = baseSpotValue * activePurity;

    // Government levies
    const dutyPercent = currentCountry.importDuty;
    const importDutyValue = rawMetalValue * (dutyPercent / 100);

    // Dealer charges vs Making charges (Consolidated and mutually exclusive)
    const chargesPercent =
      dealerCharges !== ''
        ? parseFloat(dealerCharges) || 0
        : productType === 'bullion'
          ? currentCountry.dealerPremium
          : 0;

    let dealerPremiumValue = 0;
    let makingChargesValue = 0;

    if (productType === 'bullion') {
      // Bullion Premium adds country percentage premium + fixed mint fee per localWeightUnit (both configurable by user)
      const defaultMintFee =
        currentCountry.fixedMintFeePerOz * exchangeRate * WEIGHT_CONVERSIONS[localWeightUnit];
      const mintFeeTarget = customMintFee !== '' ? parseFloat(customMintFee) || 0 : defaultMintFee;
      dealerPremiumValue = rawMetalValue * (chargesPercent / 100) + mintFeeTarget * weight;
    } else {
      // Jewellery Making Charges adds custom percentage fee only
      makingChargesValue = rawMetalValue * (chargesPercent / 100);
    }

    // VAT/GST: Applied on (Raw Metal Value + Import Duty + Making Charges)
    // Gold is only VAT exempt if it is investment bullion. Jewellery gold carries standard VAT/GST!
    const isExempt =
      activeMetal === 'gold' && isGoldVatExempt(currentCountry.code) && productType === 'bullion';
    const vatPercent = isExempt ? 0 : currentCountry.vatGst;
    const vatGstValue = (rawMetalValue + importDutyValue + makingChargesValue) * (vatPercent / 100);

    // Final consumer price
    const finalPrice =
      rawMetalValue + importDutyValue + makingChargesValue + vatGstValue + dealerPremiumValue;

    return {
      metal: activeMetal,
      weight,
      weightUnit: localWeightUnit,
      purity: activePurity,
      purityLabel: purities[selectedPurityIndex]?.label ?? 'Fine',
      currency: selectedCurrency,
      spotPricePerOzUSD: spotPriceUSD,
      spotPricePerOzTarget: spotPriceTarget,
      weightInOz,
      baseSpotValue,
      rawMetalValue,
      importDutyValue,
      makingChargesValue,
      vatGstValue,
      dealerPremiumValue,
      finalPrice,
      exchangeRate,
    };
  };

  const chargesPercent =
    dealerCharges !== ''
      ? parseFloat(dealerCharges) || 0
      : productType === 'bullion'
        ? currentCountry.dealerPremium
        : 0;
  const defaultMintFee =
    currentCountry.fixedMintFeePerOz *
    exchangeRates[selectedCurrency] *
    WEIGHT_CONVERSIONS[localWeightUnit];
  const mintFeeTarget = customMintFee !== '' ? parseFloat(customMintFee) || 0 : defaultMintFee;
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
  const premPct =
    res.finalPrice > 0
      ? ((res.dealerPremiumValue + res.makingChargesValue) / res.finalPrice) * 100
      : 0;

  return (
    <div className="calculator-wrapper">
      <div className="card-panel">
        <div className="panel-title">
          <CalcIcon size={20} className="glow-purple-text" />
          <h2>Tax & Localization Calculator</h2>
        </div>
        <p className="panel-subtitle">
          Compute final retail prices including global tariffs, state VAT/GST, and premiums.
        </p>

        <div className="calc-inputs-grid">
          {/* Weight Unit Selector - replaces Country */}
          <div className="input-group">
            <label htmlFor="calc-unit">Weight Unit</label>
            <select
              id="calc-unit"
              value={localWeightUnit}
              onChange={(e) => setLocalWeightUnit(e.target.value as WeightUnit)}
            >
              <option value="oz">oz (troy)</option>
              <option value="g">g (grams)</option>
              <option value="kg">kg (kilos)</option>
            </select>
          </div>

          {/* Product Format */}
          <div className="input-group">
            <label htmlFor="calc-product-type">Product Format</label>
            <select
              id="calc-product-type"
              value={productType}
              onChange={(e) => {
                setProductType(e.target.value as 'bullion' | 'jewellery');
                setDealerCharges(''); // Clear overrides when format changes
                setCustomMintFee('');
              }}
            >
              <option value="bullion">Bullion (Coins/Bars)</option>
              <option value="jewellery">Jewellery (Fine Goods)</option>
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

          {/* Weight Amount */}
          <div className="input-group">
            <label htmlFor="calc-weight">
              <Scale size={14} /> Weight Amount
            </label>
            <input
              id="calc-weight"
              type="number"
              min="0.001"
              step="any"
              value={weight}
              onChange={(e) => setWeight(Math.max(0.001, parseFloat(e.target.value) || 0))}
            />
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

          {/* Consolidated Dealer Charges input (dynamic label and placeholder) */}
          <div className="input-group">
            <label htmlFor="calc-charges">
              {productType === 'bullion' ? 'Premium Override (%)' : 'Dealer Making Charges (%)'}
            </label>
            <input
              id="calc-charges"
              type="number"
              placeholder={
                productType === 'bullion'
                  ? `${currentCountry.dealerPremium}% (Default)`
                  : '0% (Default)'
              }
              value={dealerCharges}
              min="0"
              max="100"
              step="0.1"
              onChange={(e) => setDealerCharges(e.target.value)}
            />
          </div>

          {/* Mint Fee / Handling override (Bullion only) */}
          {productType === 'bullion' && (
            <div className="input-group">
              <label htmlFor="calc-mint-fee">
                Mint Fee / Markup ({symbol}/{localWeightUnit})
              </label>
              <input
                id="calc-mint-fee"
                type="number"
                placeholder={`${defaultMintFee.toFixed(2)} (Default)`}
                value={customMintFee}
                min="0"
                step="0.01"
                onChange={(e) => setCustomMintFee(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Local Rate Details */}
        <div className="tax-info-box">
          <div className="info-badge">
            <Award size={14} style={{ color: 'var(--accent)' }} />
            <span>Country Tax Profile:</span>
          </div>
          <div className="rates-summary-flex">
            <span>
              Import Duty: <strong>{currentCountry.importDuty}%</strong>
            </span>
            <span>
              VAT/GST:{' '}
              <strong>
                {activeMetal === 'gold' &&
                isGoldVatExempt(currentCountry.code) &&
                productType === 'bullion'
                  ? '0% (Exempt)'
                  : `${currentCountry.vatGst}%`}
              </strong>
            </span>
            {productType === 'bullion' ? (
              <span>
                Mint Premium:{' '}
                <strong>
                  {dealerCharges !== '' ? `${dealerCharges}%` : `${currentCountry.dealerPremium}%`}{' '}
                  + {symbol}
                  {mintFeeTarget.toFixed(2)}/{localWeightUnit}
                </strong>
              </span>
            ) : (
              <span>
                Making Charges: <strong>{dealerCharges !== '' ? `${dealerCharges}%` : '0%'}</strong>
              </span>
            )}
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
              <small>
                {res.weight} {res.weightUnit} @ {res.purityLabel}
              </small>
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

          {productType === 'jewellery' && (
            <div className="receipt-row">
              <div>
                <span>Jewellery Making Charges</span>
                <small>{dealerCharges !== '' ? dealerCharges : '0'}% dealer fabrication fee</small>
              </div>
              <span>{formatCost(res.makingChargesValue)}</span>
            </div>
          )}

          <div className="receipt-row">
            <div>
              <span>Value Added Tax (VAT / GST)</span>
              <small>
                {activeMetal === 'gold' &&
                isGoldVatExempt(currentCountry.code) &&
                productType === 'bullion'
                  ? 'Exempt (Investment Gold)'
                  : `${currentCountry.vatGst}% on (Metal + Duty${res.makingChargesValue > 0 ? ' + Making' : ''})`}
              </small>
            </div>
            <span
              className={
                activeMetal === 'gold' &&
                isGoldVatExempt(currentCountry.code) &&
                productType === 'bullion'
                  ? 'exempt-text'
                  : ''
              }
            >
              {formatCost(res.vatGstValue)}
            </span>
          </div>

          {productType === 'bullion' && (
            <div className="receipt-row">
              <div>
                <span>Dealer & Mint Premium</span>
                <small>
                  {chargesPercent}% markup + {symbol}
                  {mintFeeTarget.toFixed(2)}/{localWeightUnit} fee
                </small>
              </div>
              <span>{formatCost(res.dealerPremiumValue)}</span>
            </div>
          )}

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
              <span className="lbl-premium">Premium & Charges ({premPct.toFixed(1)}%)</span>
            </div>
            <div className="stacked-bar">
              <div
                className="bar-chunk metal"
                style={{ width: `${rawPct}%` }}
                title="Raw Metal Value"
              ></div>
              <div
                className="bar-chunk tax"
                style={{ width: `${taxPct}%` }}
                title="Govt Tariffs & Taxes"
              ></div>
              <div
                className="bar-chunk premium"
                style={{ width: `${premPct}%` }}
                title="Dealer Premiums & Making Charges"
              ></div>
            </div>
          </div>

          {/* Arbitrage/Exemption info note */}
          <div className="tax-note">
            <Info size={12} className="note-icon" />
            <p>
              Prices are calculated using the live exchange rate of 1 USD ={' '}
              {res.exchangeRate.toFixed(4)} {selectedCurrency}. Local dealer premiums and minting
              charges vary based on physical product format (coins vs. bars).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
