"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Card from "@/components/Card";
import CryptoSelector from "@/components/CryptoSelector";
import AISignalPanel from "@/components/AISignalPanel";
import SignalScreener from "@/components/SignalScreener";
import { fetchOHLCV } from "@/lib/binance";
import { computeAISignal } from "@/lib/indicators/scoring";
import { useAuth } from "@/lib/auth";
import {
  SUPPORTED_CRYPTOS,
  TIMEFRAMES,
  type OHLCV,
  type CryptoSymbol,
  type TimeframeLabel,
  type AISignalResult,
  type SignalStrength,
} from "@/lib/indicators/types";

// Dynamic import for chart (no SSR — uses DOM APIs)
const TradingChart = dynamic(() => import("@/components/TradingChart"), { ssr: false });

interface ScreenerEntry {
  score: number;
  signal: SignalStrength;
  price: number;
  change: number;
}

export default function TradingPage() {
  const { user, updatePreferences } = useAuth();
  const [selectedSymbol, setSelectedSymbol] = useState<CryptoSymbol>(
    (user?.preferences.lastCrypto as CryptoSymbol) || "BTCUSDT"
  );
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeLabel>(
    (user?.preferences.lastTimeframe as TimeframeLabel) || "1D"
  );
  const [candles, setCandles] = useState<OHLCV[]>([]);
  const [signal, setSignal] = useState<AISignalResult | null>(null);
  const [screenerSignals, setScreenerSignals] = useState<Record<string, ScreenerEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const selectedCrypto = SUPPORTED_CRYPTOS.find((c) => c.symbol === selectedSymbol)!;

  // Fetch candles and compute signal
  const fetchAndCompute = useCallback(async (symbol: CryptoSymbol, tf: TimeframeLabel) => {
    try {
      setError(null);
      const data = await fetchOHLCV(symbol, tf);
      setCandles(data);

      // Compute AI signal
      const sig = computeAISignal(data);
      setSignal(sig);

      return { data, sig };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Save last selection to preferences
  useEffect(() => {
    if (user) {
      updatePreferences({ lastCrypto: selectedSymbol, lastTimeframe: selectedTimeframe });
    }
  }, [selectedSymbol, selectedTimeframe, user, updatePreferences]);

  // Load main chart data
  useEffect(() => {
    setLoading(true);
    fetchAndCompute(selectedSymbol, selectedTimeframe);

    // Auto-refresh every 60s
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fetchAndCompute(selectedSymbol, selectedTimeframe);
    }, 60000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedSymbol, selectedTimeframe, fetchAndCompute]);

  // Load screener data (all cryptos, 1D timeframe)
  useEffect(() => {
    async function loadScreener() {
      const results: Record<string, ScreenerEntry> = {};

      // Load in batches of 3 to avoid rate limits
      for (let i = 0; i < SUPPORTED_CRYPTOS.length; i += 3) {
        const batch = SUPPORTED_CRYPTOS.slice(i, i + 3);
        const promises = batch.map(async (crypto) => {
          try {
            const data = await fetchOHLCV(crypto.symbol, "1D");
            const sig = computeAISignal(data);
            const lastCandle = data[data.length - 1];
            const prevCandle = data[data.length - 2];
            const change = prevCandle ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100 : 0;

            results[crypto.symbol] = {
              score: sig.globalScore,
              signal: sig.signal,
              price: lastCandle.close,
              change: Math.round(change * 100) / 100,
            };
          } catch {
            // Skip failed ones
          }
        });
        await Promise.all(promises);
        // Small delay between batches
        if (i + 3 < SUPPORTED_CRYPTOS.length) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      setScreenerSignals(results);
    }

    loadScreener();
    const screenerInterval = setInterval(loadScreener, 120000); // Refresh every 2 min
    return () => clearInterval(screenerInterval);
  }, []);

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const prevClose = candles.length > 1 ? candles[candles.length - 2].close : currentPrice;
  const priceChange = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] text-sm shadow-lg shadow-[var(--color-accent-blue)]/25">
              AI
            </span>
            Trading Pro
            <span className="flex items-center gap-1.5 text-xs font-normal text-[var(--color-positive)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-positive)] animate-live-pulse" />
              Live
            </span>
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Analyse technique IA en temps réel — signaux Buy/Sell automatiques
          </p>
        </div>

        {/* Price header */}
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-xs text-[var(--color-text-muted)] uppercase">{selectedCrypto.name}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{selectedCrypto.label}/USDT</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {currentPrice > 0 ? (currentPrice >= 1 ? `$${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `$${currentPrice.toFixed(6)}`) : "—"}
          </p>
          <p className={`text-sm font-semibold tabular-nums ${priceChange >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
            {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
          </p>
        </div>
      </section>

      {/* Crypto selector */}
      <section className="animate-fade-in" style={{ animationDelay: "100ms" }}>
        <CryptoSelector
          selected={selectedSymbol}
          onSelect={(s) => { setSelectedSymbol(s as CryptoSymbol); setLoading(true); }}
          signals={screenerSignals}
        />
      </section>

      {/* Main content: Chart + Signal Panel */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Chart section */}
        <Card className="p-0 overflow-hidden animate-fade-in-up" style={{ animationDelay: "150ms" }}>
          {/* Timeframe selector */}
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)]/50 px-4 py-2.5">
            <div className="flex gap-0.5 rounded-lg bg-[var(--color-bg-primary)] p-0.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.label}
                  onClick={() => { setSelectedTimeframe(tf.label); setLoading(true); }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    selectedTimeframe === tf.label
                      ? "bg-[var(--color-bg-card)] text-white shadow-sm"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1"><span className="h-2 w-0.5 rounded bg-[rgba(245,158,11,0.7)]" /> SMA50</span>
              <span className="flex items-center gap-1"><span className="h-2 w-0.5 rounded bg-[rgba(59,130,246,0.7)]" /> SMA200</span>
              <span className="flex items-center gap-1"><span className="h-2 w-0.5 rounded bg-[rgba(139,92,246,0.4)]" style={{ borderStyle: "dotted" }} /> BB</span>
            </div>
          </div>

          {/* Chart */}
          <div className="relative min-h-[500px]">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--color-bg-card)]/60">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent-blue)]/30 border-t-[var(--color-accent-blue)]" />
                  <span className="text-xs text-[var(--color-text-muted)]">Chargement {selectedCrypto.label} {selectedTimeframe}...</span>
                </div>
              </div>
            )}
            {error && !loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center">
                  <p className="text-sm text-[var(--color-negative)]">{error}</p>
                  <button onClick={() => { setLoading(true); fetchAndCompute(selectedSymbol, selectedTimeframe); }}
                    className="mt-3 text-xs text-[var(--color-accent-blue)] hover:underline">
                    Réessayer
                  </button>
                </div>
              </div>
            )}
            {candles.length > 0 && (
              <TradingChart
                key={`${selectedSymbol}-${selectedTimeframe}`}
                candles={candles}
                signal={signal ?? undefined}
                height={500}
              />
            )}
          </div>
        </Card>

        {/* AI Signal Panel */}
        <Card className="animate-fade-in-up h-fit lg:sticky lg:top-24" style={{ animationDelay: "200ms" }}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] text-[10px]">AI</span>
            Signal Panel — {selectedCrypto.label}
          </h3>
          {signal ? (
            <AISignalPanel signal={signal} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent-blue)]/30 border-t-[var(--color-accent-blue)]" />
            </div>
          )}
        </Card>
      </div>

      {/* Screener */}
      <section className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
        <Card>
          <SignalScreener
            signals={screenerSignals}
            onSelect={(s) => { setSelectedSymbol(s as CryptoSymbol); setLoading(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          />
        </Card>
      </section>
    </div>
  );
}
