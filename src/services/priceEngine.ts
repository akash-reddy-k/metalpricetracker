import type { SpotPrices, HistoricalPricePoint } from '../types/metals';

// Base prices in USD per troy ounce
export const BASE_PRICES = {
  gold: 2354.2,
  silver: 29.85,
  platinum: 978.5,
  palladium: 945.1,
};

// Seeded random number generator for reproducible history
function createRandom(seed: number) {
  let h = seed ^ 0xdeadbeef;
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function generateHistoricalData(
  timeframe: '24h' | '7d' | '30d' | '1y' | '5y',
  currentPrices: SpotPrices
): HistoricalPricePoint[] {
  const now = currentPrices.timestamp;

  let pointsCount = 30;
  let intervalMs = 24 * 60 * 60 * 1000; // 1 day default

  switch (timeframe) {
    case '24h':
      pointsCount = 24;
      intervalMs = 60 * 60 * 1000; // 1 hour
      break;
    case '7d':
      pointsCount = 42;
      intervalMs = 4 * 60 * 60 * 1000; // 4 hours
      break;
    case '30d':
      pointsCount = 30;
      intervalMs = 24 * 60 * 60 * 1000; // 1 day
      break;
    case '1y':
      pointsCount = 52;
      intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
      break;
    case '5y':
      pointsCount = 60;
      intervalMs = 30 * 24 * 60 * 60 * 1000; // 1 month
      break;
  }

  // Use a fixed seed based on the timeframe to keep the historical lines stable,
  // but end precisely at the current spot prices.
  const seedString = timeframe;
  let seedValue = 0;
  for (let i = 0; i < seedString.length; i++) {
    seedValue += seedString.charCodeAt(i) * (i + 1);
  }
  const rng = createRandom(seedValue);

  // Generate backwards from now
  const tempPoints: HistoricalPricePoint[] = [];

  // Start tracking prices backwards
  const prices = {
    gold: currentPrices.gold,
    silver: currentPrices.silver,
    platinum: currentPrices.platinum,
    palladium: currentPrices.palladium,
  };

  // Define trend coefficients depending on the timeframe
  // e.g., 5y has a positive long term trend.
  let goldTrend = -0.0008; // going backwards, so negative trend means going forward is positive
  let silverTrend = -0.0004;
  let platinumTrend = -0.0002;
  let palladiumTrend = 0.0003; // palladium went down somewhat

  if (timeframe === '24h') {
    goldTrend = -0.00005;
    silverTrend = -0.00002;
    platinumTrend = 0.00001;
    palladiumTrend = -0.00002;
  }

  // Add the current point first
  tempPoints.push({
    timestamp: now,
    prices: { ...prices },
  });

  for (let i = 1; i < pointsCount; i++) {
    const timestamp = now - i * intervalMs;

    // Calculate random fluctuations (Brownian motion)
    const goldVolatility =
      timeframe === '24h'
        ? 0.002
        : timeframe === '7d'
          ? 0.006
          : timeframe === '30d'
            ? 0.012
            : 0.025;
    const silverVolatility = goldVolatility * 1.5; // Silver is more volatile
    const platVol = goldVolatility * 1.2;
    const pallVol = goldVolatility * 1.4;

    // Apply fluctuations backwards
    prices.gold = prices.gold * (1 - (goldTrend + (rng() - 0.5) * goldVolatility));
    prices.silver = prices.silver * (1 - (silverTrend + (rng() - 0.5) * silverVolatility));
    prices.platinum = prices.platinum * (1 - (platinumTrend + (rng() - 0.5) * platVol));
    prices.palladium = prices.palladium * (1 - (palladiumTrend + (rng() - 0.5) * pallVol));

    // Safeguard prices from dropping below 0
    prices.gold = Math.max(100, prices.gold);
    prices.silver = Math.max(2, prices.silver);
    prices.platinum = Math.max(50, prices.platinum);
    prices.palladium = Math.max(50, prices.palladium);

    tempPoints.push({
      timestamp,
      prices: { ...prices },
    });
  }

  // Reverse so history flows forward in time
  return tempPoints.reverse();
}

export function simulatePriceTick(currentPrices: SpotPrices): SpotPrices {
  const rng = Math.random;

  // Markets fluctuate slightly every tick (approx -0.15% to +0.15%)
  const fluctuate = (price: number, volatility = 0.0012) => {
    const changePercent = (rng() - 0.49) * 2 * volatility; // slightly positive bias to mimic long-term growth
    return Number((price * (1 + changePercent)).toFixed(2));
  };

  return {
    gold: fluctuate(currentPrices.gold, 0.0008),
    silver: fluctuate(currentPrices.silver, 0.0015),
    platinum: fluctuate(currentPrices.platinum, 0.001),
    palladium: fluctuate(currentPrices.palladium, 0.0012),
    timestamp: Date.now(),
  };
}

// Convert prices between ounces, grams, and kilograms
// 1 troy ounce = 31.1034768 grams
// 1 kilogram = 1000 grams = 32.1507466 troy ounces
export const WEIGHT_CONVERSIONS = {
  oz: 1,
  g: 1 / 31.1034768,
  kg: 32.1507466,
};

export function getPricePerUnit(pricePerOz: number, unit: 'oz' | 'g' | 'kg'): number {
  return pricePerOz * WEIGHT_CONVERSIONS[unit];
}
