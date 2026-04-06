"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface CoinPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d: { price: number[] } | null;
}

interface PricesResponse {
  coins: CoinPrice[];
  source: "live" | "cache" | "stale-cache";
  fetchedAt: number;
}

const CACHE_KEY = "axiom_prices_cache";

/**
 * Stale-while-revalidate prices hook.
 * 1. Loads cached data from localStorage IMMEDIATELY (no skeleton).
 * 2. Triggers a background refresh from /api/prices.
 * 3. Re-fetches every `refreshInterval` ms.
 */
export function usePrices(refreshInterval = 15000) {
  const [prices, setPrices] = useState<CoinPrice[] | null>(null);
  const [source, setSource] = useState<string>("loading");
  const [fetchedAt, setFetchedAt] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchPrices = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("/api/prices", { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) return;

      const data: PricesResponse = await res.json();
      if (mountedRef.current && data.coins) {
        setPrices(data.coins);
        setSource(data.source);
        setFetchedAt(data.fetchedAt);
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ coins: data.coins, fetchedAt: data.fetchedAt, source: data.source })
          );
        } catch { /* quota exceeded, ignore */ }
      }
    } catch {
      // Silently fail — keep existing data
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Instant hydrate from localStorage
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { coins: CoinPrice[]; fetchedAt: number; source: string };
        if (parsed?.coins?.length) {
          setPrices(parsed.coins);
          setSource(parsed.source || "cache");
          setFetchedAt(parsed.fetchedAt || 0);
          setLoading(false);
        }
      }
    } catch { /* ignore corrupted cache */ }

    fetchPrices();
    const interval = setInterval(fetchPrices, refreshInterval);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchPrices, refreshInterval]);

  const getPrice = useCallback(
    (idOrSymbol: string): CoinPrice | undefined => {
      if (!prices) return undefined;
      const lower = idOrSymbol.toLowerCase();
      return prices.find(
        (c) => c.id === lower || c.symbol.toLowerCase() === lower,
      );
    },
    [prices],
  );

  const isStale = fetchedAt > 0 && Date.now() - fetchedAt > 60_000;

  return { prices, loading, source, fetchedAt, isStale, getPrice, refetch: fetchPrices };
}
