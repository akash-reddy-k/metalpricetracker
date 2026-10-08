import React, { useEffect } from 'react';
import { useParams, useOutletContext, Navigate, Link } from 'react-router-dom';
import type { MetalType, AppOutletContext } from '../types/metals';
import { findCountryBySlug, countrySlug as toCountrySlug } from '../data/countries';
import { MetalPurityDetails } from '../components/MetalPurityDetails';
import { Calculator } from '../components/Calculator';

const VALID_METALS: MetalType[] = ['gold', 'silver', 'platinum', 'palladium'];

const METAL_LABEL: Record<MetalType, string> = {
  gold: 'Gold', silver: 'Silver', platinum: 'Platinum', palladium: 'Palladium',
};

const MetalPage: React.FC = () => {
  const { country: countrySlugParam, metal: metalParam, city: cityParam } = useParams<{
    country: string;
    metal: string;
    city?: string;
  }>();
  const ctx = useOutletContext<AppOutletContext>();

  const matchedCountry = countrySlugParam ? findCountryBySlug(countrySlugParam) : undefined;
  const metal = metalParam as MetalType;
  const validMetal = VALID_METALS.includes(metal);

  // Derive a display name from the city slug (e.g. "new-york" → "New York")
  const cityName = cityParam
    ? cityParam.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : undefined;

  useEffect(() => {
    if (matchedCountry) {
      ctx.setSelectedCurrency(matchedCountry.currency);
    }
    if (validMetal) {
      ctx.setActiveMetal(metal);
    }
  }, [countrySlugParam, metalParam]);

  if (!matchedCountry || !validMetal) {
    return <Navigate to="/" replace />;
  }

  const slug = toCountrySlug(matchedCountry);

  return (
    <main className="dashboard-grid">
      {/* City context banner — shown only on city-level pages */}
      {cityName && (
        <div className="city-banner card-panel" style={{
          padding: '14px 20px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Home</Link>
              {' › '}
              <Link to={`/${slug}/${metal}/`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                {METAL_LABEL[metal]} in {matchedCountry.name}
              </Link>
              {' › '}
            </span>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {matchedCountry.flag} {METAL_LABEL[metal]} Price in {cityName}
            </span>
          </div>
        </div>
      )}

      <MetalPurityDetails
        activeMetal={metal}
        spotPrices={ctx.prices}
        selectedCurrency={ctx.selectedCurrency}
        weightUnit={ctx.weightUnit}
        exchangeRates={ctx.exchangeRates}
      />

      <Calculator
        activeMetal={metal}
        setActiveMetal={ctx.setActiveMetal}
        spotPrices={ctx.prices}
        selectedCurrency={ctx.selectedCurrency}
        weightUnit={ctx.weightUnit}
        exchangeRates={ctx.exchangeRates}
      />
    </main>
  );
};

export default MetalPage;
