import React, { useState } from 'react';
import type { SpotPrices, MetalType, CurrencyType, WeightUnit } from '../types/metals';
import { getPricePerUnit } from '../services/priceEngine';
import {
  COUNTRIES,
  PURITY_OPTIONS,
  getMetalImportDuty,
  getMetalVatGst,
} from '../data/countries';
import { Gem, Layers } from 'lucide-react';

interface MetalPurityDetailsProps {
  activeMetal: MetalType;
  spotPrices: SpotPrices;
  selectedCurrency: CurrencyType;
  weightUnit: WeightUnit;
  exchangeRates: Record<CurrencyType, number>;
}

const METAL_LABELS: Record<MetalType, string> = {
  gold: 'Gold',
  silver: 'Silver',
  platinum: 'Platinum',
  palladium: 'Palladium',
};

export const MetalPurityDetails: React.FC<MetalPurityDetailsProps> = ({
  activeMetal,
  spotPrices,
  selectedCurrency,
  weightUnit,
  exchangeRates,
}) => {
  // VAT/GST is opt-in: the duty-paid price is always shown, the tax-inclusive column only when checked.
  const [includeVat, setIncludeVat] = useState<boolean>(false);

  const currentCountry = COUNTRIES.find((c) => c.currency === selectedCurrency) || COUNTRIES[0];
  const currencyRate = exchangeRates[selectedCurrency];
  const purities = PURITY_OPTIONS[activeMetal];

  const dutyPercent = getMetalImportDuty(currentCountry, activeMetal);
  const vatPercent = getMetalVatGst(currentCountry, activeMetal);

  // Base spot value for 1 target weight unit of pure (100%) metal, in local currency.
  const baseUnitValue = spotPrices[activeMetal] * currencyRate * getPricePerUnit(1, weightUnit);

  const formatCost = (val: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: selectedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);

  return (
    <div id="metal-purity-details" className="purity-panel card-panel">
      <div className="panel-title">
        <Gem size={20} className="glow-gold-text" />
        <h2>
          {METAL_LABELS[activeMetal]} Purity Prices — {currentCountry.flag} {currentCountry.name}
        </h2>
      </div>
      <p className="panel-subtitle">
        Duty-paid price per {weightUnit} for each {METAL_LABELS[activeMetal].toLowerCase()} fineness,
        converted to {selectedCurrency} including {currentCountry.name}'s {dutyPercent}% import duty.
      </p>

      <label className="vat-toggle purity-vat-toggle" htmlFor="purity-include-vat">
        <input
          id="purity-include-vat"
          type="checkbox"
          checked={includeVat}
          onChange={(e) => setIncludeVat(e.target.checked)}
        />
        <span>Include VAT / GST ({vatPercent}%)</span>
      </label>

      <div className="purity-table">
        <div className={`purity-row header ${includeVat ? 'with-vat' : ''}`}>
          <span>Fineness</span>
          <span>Duty Paid (excl. VAT)</span>
          {includeVat && <span>Incl. VAT/GST</span>}
        </div>
        {purities.map((p, idx) => {
          const rawValue = baseUnitValue * p.value;
          const dutyValue = rawValue * (dutyPercent / 100);
          const priceExVat = rawValue + dutyValue;
          const vatValue = priceExVat * (vatPercent / 100);
          const priceIncVat = priceExVat + vatValue;

          return (
            <div key={idx} className={`purity-row ${includeVat ? 'with-vat' : ''}`}>
              <div className="purity-label">
                <Layers size={13} className="purity-icon" />
                <span>{p.label}</span>
              </div>
              <span className="purity-price">{formatCost(priceExVat)}</span>
              {includeVat && <span className="purity-price incl">{formatCost(priceIncVat)}</span>}
            </div>
          );
        })}
      </div>

      <p className="purity-note">
        Prices are live international spot × {selectedCurrency} exchange rate × fineness, plus{' '}
        {dutyPercent}% import duty. VAT/GST and dealer premiums are excluded unless toggled. Use the
        calculator below for making charges and mint premiums.
      </p>
    </div>
  );
};
