"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Card from "@/components/Card";
import MarketHeatmap from "@/components/insights/MarketHeatmap";
import FearGreedSection from "@/components/insights/FearGreedSection";
import AIScoreCards from "@/components/insights/AIScoreCards";
import RadarChart from "@/components/insights/RadarChart";
import CorrelationMatrix from "@/components/insights/CorrelationMatrix";
import EventsTimeline from "@/components/insights/EventsTimeline";
import AIReport from "@/components/insights/AIReport";

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
  return (
    <div className={`animate-pulse rounded-xl bg-white/[0.03] ${className}`} />
  );
}

export default function AIInsightsPage() {
  const [data, setData] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const retryCount = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("/api/market/overview", { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        // Validate that we got meaningful data
        if (json && json.heatmapCoins && json.aiScores) {
          setData(json);
          setError(false);
          retryCount.current = 0;
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      // Auto-retry up to 3 times with backoff
      if (retryCount.current < 3 && !data) {
        retryCount.current++;
        const delay = retryCount.current * 2000;
        setTimeout(fetchData, delay);
        return;
      }
      if (!data) setError(true);
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      retryCount.current = 0;
      fetchData();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      {/* ============ HEADER ============ */}
      <section className="text-center py-6 relative">
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-48 w-72 rounded-full bg-[var(--color-accent-purple)]/5 blur-[80px]" />
        <div
          className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] mb-4 shadow-lg shadow-[var(--color-accent-blue)]/25 animate-float"
        >
          <span className="text-2xl">🧠</span>
        </div>
        <h1 className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Analyse IA du Marché
        </h1>
        <p className="relative mt-3 text-[var(--color-text-secondary)] max-w-xl mx-auto">
          Intelligence artificielle appliquée à l&apos;analyse des marchés crypto — données en direct, signaux avancés et rapport IA généré.
        </p>
        {data?.isLive && (
          <div className="mt-3 flex justify-center items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-medium">Données en direct</span>
          </div>
        )}
        {loading && !data && (
          <div className="mt-4 flex justify-center items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs text-gray-400">Chargement des données...</span>
          </div>
        )}
        {error && !data && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <span className="text-xs text-red-400">Impossible de charger les données</span>
            <button
              onClick={() => { retryCount.current = 0; setLoading(true); setError(false); fetchData(); }}
              className="text-xs text-blue-400 underline hover:text-blue-300"
            >
              Réessayer
            </button>
          </div>
        )}
      </section>

      {/* ============ AI REPORT ============ */}
      <Card highlight>
        <AIReport />
      </Card>

      {/* ============ HEATMAP + FEAR & GREED (2 cols) ============ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card highlight>
          {!data ? (
            <div>
              <div className="h-6 w-40 rounded bg-white/5 mb-4" />
              <SkeletonBlock className="h-[350px]" />
            </div>
          ) : (
            <MarketHeatmap coins={data.heatmapCoins} />
          )}
        </Card>

        <Card highlight>
          {!data ? (
            <div>
              <div className="h-6 w-64 rounded bg-white/5 mb-4" />
              <SkeletonBlock className="h-[350px]" />
            </div>
          ) : (
            <FearGreedSection
              currentValue={data.fearGreedIndex}
              history={data.fngHistory}
            />
          )}
        </Card>
      </div>

      {/* ============ AI SCORE CARDS ============ */}
      <Card highlight>
        {!data ? (
          <div>
            <div className="h-6 w-56 rounded bg-white/5 mb-4" />
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map(i => <SkeletonBlock key={i} className="h-[320px]" />)}
            </div>
          </div>
        ) : (
          <AIScoreCards scores={data.aiScores} />
        )}
      </Card>

      {/* ============ RADAR + CORRELATION (2 cols) ============ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card highlight>
          {!data ? (
            <div>
              <div className="h-6 w-72 rounded bg-white/5 mb-4" />
              <SkeletonBlock className="h-[340px]" />
            </div>
          ) : (
            <RadarChart
              cryptos={data.aiScores.map(s => ({
                symbol: s.symbol,
                name: s.name ?? s.symbol,
                categories: s.categories,
              }))}
            />
          )}
        </Card>

        <Card highlight>
          {!data ? (
            <div>
              <div className="h-6 w-60 rounded bg-white/5 mb-4" />
              <SkeletonBlock className="h-[340px]" />
            </div>
          ) : (
            <CorrelationMatrix coins={data.heatmapCoins} />
          )}
        </Card>
      </div>

      {/* ============ EVENTS TIMELINE ============ */}
      <Card highlight>
        {!data ? (
          <div>
            <div className="h-6 w-64 rounded bg-white/5 mb-4" />
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map(i => <SkeletonBlock key={i} className="h-16" />)}
            </div>
          </div>
        ) : (
          <EventsTimeline
            coins={data.heatmapCoins}
            fearGreedIndex={data.fearGreedIndex}
            btcDominance={data.btcDominance}
          />
        )}
      </Card>
    </div>
  );
}
