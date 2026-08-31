import { useEffect, useState } from 'react';
import type { MetalType } from '../types/metals';
import { fetchHistory, type HistoryBar, type Timeframe } from '../services/api';

export interface HistoryPoint {
  timestamp: number; // epoch ms
  price: number; // USD per troy ounce
}

interface HistoryState {
  points: HistoryPoint[];
  loading: boolean;
  error: string | null;
}

const cache = new Map<string, HistoryPoint[]>();

/** Fetches real OHLC history for one metal, cached per metal+timeframe. */
export function usePriceHistory(metal: MetalType, timeframe: Timeframe): HistoryState {
  const key = `${metal}:${timeframe}`;
  const [state, setState] = useState<HistoryState>(() => ({
    points: cache.get(key) ?? [],
    loading: !cache.has(key),
    error: null,
  }));

  useEffect(() => {
    const cached = cache.get(key);
    if (cached) {
      setState({ points: cached, loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ points: [], loading: true, error: null });

    fetchHistory(metal, timeframe, controller.signal)
      .then((bars: HistoryBar[]) => {
        const points = bars.map((bar) => ({ timestamp: bar.t * 1000, price: bar.c }));
        cache.set(key, points);
        setState({ points, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          points: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load history',
        });
      });

    return () => controller.abort();
  }, [key, metal, timeframe]);

  return state;
}
