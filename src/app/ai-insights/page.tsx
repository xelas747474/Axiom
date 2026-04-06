"use client";

import { useEffect, useState, useCallback, useRef, Component, Suspense, type ReactNode } from "react";
import MarketHeatmap from "@/components/insights/MarketHeatmap";
import FearGreedSection from "@/components/insights/FearGreedSection";
import AIScoreCards from "@/components/insights/AIScoreCards";
import RadarChart from "@/components/insights/RadarChart";
import CorrelationMatrix from "@/components/insights/CorrelationMatrix";
import EventsTimeline from "@/components/insights/EventsTimeline";
import AIReport from "@/components/insights/AIReport";

// ---- Error Boundary ----
class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400">Erreur de chargement de cette section</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---- Types ----
interface HeatmapCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change1h: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume: number;
  sparkline7d: number[];
}

interface CategoryResult {
  category: string;
  score: number;
  details: string;
}

interface AIScoreData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  sparkline7d: number[];
  score: number;
  categories: CategoryResult[];
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
}

interface FngDataPoint {
  value: number;
  timestamp: number;
  classification: string;
}

interface MarketOverview {
  bitcoin: { price: number; change24h: number };
  ethereum: { price: number; change24h: number };
  marketCap: number;
  btcDominance: number;
  fearGreedIndex: number;
  heatmapCoins: HeatmapCoin[];
  fngHistory: FngDataPoint[];
  aiScores: AIScoreData[];
  isLive: boolean;
  timestamp: number;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.03] ${className}`} />;
}

export default function AIInsightsPage() {
  const [data, setData] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const retryRef = useRef(0);
  const dataRef = useRef<MarketOverview | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("/api/market/overview", { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json && json.heatmapCoins) {
          setData(json);
          dataRef.current = json;
          setError(false);
          retryRef.current = 0;
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      if (retryRef.current < 3 && !dataRef.current) {
        retryRef.current++;
        setTimeout(fetchData, retryRef.current * 2000);
        return;
      }
      if (!dataRef.current) setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      retryRef.current = 0;
      fetchData();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      {/* ============ HEADER ============ */}
      <section className="text-center py-6 relative">
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-48 w-72 rounded-full bg-[var(--color-accent-purple)]/5 blur-[80px]" />
        <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] mb-4 shadow-lg shadow-[var(--color-accent-blue)]/25 animate-float">
          <span className="text-2xl">🧠</span>
        </div>
        <h1 className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Analyse IA du Marché
        </h1>
        <p className="relative mt-3 text-[var(--color-text-secondary)] max-w-xl mx-auto">
          Intelligence artificielle appliquée à l&apos;analyse des marchés crypto — données en direct, signaux avancés et rapport IA généré.
        </p>
        {data && (
          <div className="mt-3 flex justify-center items-center gap-3">
            {data.isLive ? (
              <>
                <span className="live-dot" />
                <span className="text-xs text-[var(--color-positive)] font-medium">Données en direct</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-[var(--color-warning)]" />
                <span className="text-xs text-[var(--color-warning)] font-medium">Données en cache</span>
              </>
            )}
            <span className="text-xs text-[var(--color-text-muted)]">
              Mise à jour : {new Date(data.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
        {loading && !data && (
          <div className="mt-4 flex justify-center items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--color-accent-blue)] animate-pulse" />
            <span className="text-xs text-[var(--color-text-muted)]">Chargement des données...</span>
          </div>
        )}
        {error && !data && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <span className="text-xs text-[var(--color-negative)]">Impossible de charger les données</span>
            <button
              onClick={() => { retryRef.current = 0; setLoading(true); setError(false); fetchData(); }}
              className="text-xs text-[var(--color-accent-blue)] underline hover:opacity-80"
            >
              Réessayer
            </button>
          </div>
        )}
      </section>

      {/* ============ AI REPORT ============ */}
      <ErrorBoundary>
        <div className="premium-card p-5">
          <Suspense fallback={<SkeletonBlock className="h-[200px]" />}>
            <AIReport />
          </Suspense>
        </div>
      </ErrorBoundary>

      {/* ============ HEATMAP + FEAR & GREED ============ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ErrorBoundary>
          <div className="premium-card p-5">
            {!data ? (
              <div>
                <div className="h-6 w-40 rounded bg-white/5 mb-4" />
                <SkeletonBlock className="h-[350px]" />
              </div>
            ) : (
              <Suspense fallback={<SkeletonBlock className="h-[350px]" />}>
                <MarketHeatmap coins={data.heatmapCoins} />
              </Suspense>
            )}
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div className="premium-card p-5">
            {!data ? (
              <div>
                <div className="h-6 w-64 rounded bg-white/5 mb-4" />
                <SkeletonBlock className="h-[350px]" />
              </div>
            ) : (
              <Suspense fallback={<SkeletonBlock className="h-[350px]" />}>
                <FearGreedSection
                  currentValue={data.fearGreedIndex}
                  history={data.fngHistory}
                />
              </Suspense>
            )}
          </div>
        </ErrorBoundary>
      </div>

      {/* ============ AI SCORE CARDS ============ */}
      <ErrorBoundary>
        <div className="premium-card p-5">
          {!data ? (
            <div>
              <div className="h-6 w-56 rounded bg-white/5 mb-4" />
              <div className="grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map(i => <SkeletonBlock key={i} className="h-[320px]" />)}
              </div>
            </div>
          ) : (
            <Suspense fallback={<SkeletonBlock className="h-[320px]" />}>
              <AIScoreCards scores={data.aiScores} />
            </Suspense>
          )}
        </div>
      </ErrorBoundary>

      {/* ============ RADAR + CORRELATION ============ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ErrorBoundary>
          <div className="premium-card p-5">
            {!data ? (
              <div>
                <div className="h-6 w-72 rounded bg-white/5 mb-4" />
                <SkeletonBlock className="h-[340px]" />
              </div>
            ) : (
              <Suspense fallback={<SkeletonBlock className="h-[340px]" />}>
                <RadarChart
                  cryptos={data.aiScores.map(s => ({
                    symbol: s.symbol,
                    name: s.name ?? s.symbol,
                    categories: s.categories,
                  }))}
                />
              </Suspense>
            )}
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div className="premium-card p-5">
            {!data ? (
              <div>
                <div className="h-6 w-60 rounded bg-white/5 mb-4" />
                <SkeletonBlock className="h-[340px]" />
              </div>
            ) : (
              <Suspense fallback={<SkeletonBlock className="h-[340px]" />}>
                <CorrelationMatrix coins={data.heatmapCoins} />
              </Suspense>
            )}
          </div>
        </ErrorBoundary>
      </div>

      {/* ============ EVENTS TIMELINE ============ */}
      <ErrorBoundary>
        <div className="premium-card p-5">
          {!data ? (
            <div>
              <div className="h-6 w-64 rounded bg-white/5 mb-4" />
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map(i => <SkeletonBlock key={i} className="h-16" />)}
              </div>
            </div>
          ) : (
            <Suspense fallback={<SkeletonBlock className="h-[300px]" />}>
              <EventsTimeline
                coins={data.heatmapCoins}
                fearGreedIndex={data.fearGreedIndex}
                btcDominance={data.btcDominance}
              />
            </Suspense>
          )}
        </div>
      </ErrorBoundary>
    </div>
  );
}
