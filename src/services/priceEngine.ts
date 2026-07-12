import type { SpotPrices, HistoricalPricePoint, MetalType, ApiConfig } from '../types/metals';

// Base prices in USD per troy ounce
export const BASE_PRICES = {
  gold: 2354.20,
  silver: 29.85,
  platinum: 978.50,
  palladium: 945.10,
};

// Seeded random number generator for reproducible history
function createRandom(seed: number) {
  let h = seed ^ 0xdeadbeef;
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function generateHistoricalData(timeframe: '24h' | '7d' | '30d' | '1y' | '5y', currentPrices: SpotPrices): HistoricalPricePoint[] {
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
    prices: { ...prices }
  });

  for (let i = 1; i < pointsCount; i++) {
    const timestamp = now - i * intervalMs;
    
    // Calculate random fluctuations (Brownian motion)
    const goldVolatility = timeframe === '24h' ? 0.002 : timeframe === '7d' ? 0.006 : timeframe === '30d' ? 0.012 : 0.025;
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
      prices: { ...prices }
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
    platinum: fluctuate(currentPrices.platinum, 0.0010),
    palladium: fluctuate(currentPrices.palladium, 0.0012),
    timestamp: Date.now(),
  };
}

// Fetch prices from real APIs if user provides an API key
export async function fetchLivePrices(config: ApiConfig): Promise<SpotPrices> {
  if (config.provider === 'simulated' || !config.apiKey) {
    throw new Error('Using simulated data');
  }

  if (config.provider === 'goldapi') {
    // GoldAPI.io requires headers for access token
    // Example: https://www.goldapi.io/api/XAU/USD
    // We need to make 4 requests (one for each metal)
    const metalsMap: Record<MetalType, string> = {
      gold: 'XAU',
      silver: 'XAG',
      platinum: 'XPT',
      palladium: 'XPD'
    };

    const fetchMetal = async (symbol: string): Promise<number> => {
      const response = await fetch(`https://www.goldapi.io/api/${symbol}/USD`, {
        headers: {
          'x-access-token': config.apiKey,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`GoldAPI failed for ${symbol}: ${response.statusText}`);
      }
      const data = await response.json();
      return data.price;
    };

    try {
      const [gold, silver, platinum, palladium] = await Promise.all([
        fetchMetal(metalsMap.gold),
        fetchMetal(metalsMap.silver),
        fetchMetal(metalsMap.platinum),
        fetchMetal(metalsMap.palladium)
      ]);

      return {
        gold,
        silver,
        platinum,
        palladium,
        timestamp: Date.now()
      };
    } catch (err) {
      console.error('GoldAPI error:', err);
      throw err;
    }
  } else if (config.provider === 'metalpriceapi') {
    // MetalpriceAPI provides all rates relative to base
    // Example endpoint: https://api.metalpriceapi.com/v1/latest?api_key=API_KEY&base=USD&currencies=XAU,XAG,XPT,XPD
    // Rates are returned as 1 USD = X ounces of metal. So price per ounce is 1 / rate.
    try {
      const response = await fetch(
        `https://api.metalpriceapi.com/v1/latest?api_key=${config.apiKey}&base=USD&currencies=XAU,XAG,XPT,XPD`
      );
      if (!response.ok) {
        throw new Error(`MetalpriceAPI failed: ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.success || !data.rates) {
        throw new Error(data.error?.info || 'Failed to fetch rates from MetalpriceAPI');
      }

      // Rates are 1 USD = X metal.
      // Gold (XAU), Silver (XAG), Platinum (XPT), Palladium (XPD)
      const rates = data.rates;
      const getPrice = (symbol: string) => {
        const rate = rates[symbol];
        if (!rate) throw new Error(`Rate for ${symbol} not found`);
        return Number((1 / rate).toFixed(2));
      };

      return {
        gold: getPrice('XAU'),
        silver: getPrice('XAG'),
        platinum: getPrice('XPT'),
        palladium: getPrice('XPD'),
        timestamp: Date.now()
      };
    } catch (err) {
      console.error('MetalpriceAPI error:', err);
      throw err;
    }
  }

  throw new Error('Unsupported provider');
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
