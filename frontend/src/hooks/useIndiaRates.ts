import { useEffect, useState } from 'react';
import { fetchIndiaRates, type IndiaRatesResponse } from '../services/api';

const REFRESH_MS = 30_000;

/**
 * Polls the server's Indian bullion rate table. Returns null while disabled or
 * before the first successful response, which callers treat as "fall back to
 * the generic spot-plus-duty derivation".
 */
export function useIndiaRates(enabled: boolean): IndiaRatesResponse | null {
  const [rates, setRates] = useState<IndiaRatesResponse | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRates(null);
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      try {
        setRates(await fetchIndiaRates(controller.signal));
      } catch {
        // Keep whatever we last had; freshness is checked at the call site.
      }
    };

    load();
    const timer = setInterval(load, REFRESH_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [enabled]);

  return rates;
}
