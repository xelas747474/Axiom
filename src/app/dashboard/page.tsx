"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { AnimatedPrice } from "@/components/AnimatedPrice";
import AISummaryBlock from "@/components/AISummaryBlock";
import AlertItem from "@/components/AlertItem";
import ChartContainer from "@/components/ChartContainer";
import { useAuth } from "@/lib/auth";
import {
  type CryptoAsset,
  type Alert as AlertType,
  type InsightCard as InsightCardType,
} from "@/data/mock";

const statusColors = {
  positive: "text-[var(--color-positive)]",
  negative: "text-[var(--color-negative)]",
  neutral: "text-[var(--color-warning)]",
};

const statusBg = {
  positive: "bg-[var(--color-positive)]/10",
  negative: "bg-[var(--color-negative)]/10",
  neutral: "bg-[var(--color-warning)]/10",
};

// Fear & Greed color based on value
function fearGreedColor(value: number): string {
  if (value <= 25) return "text-[var(--color-negative)]";
  if (value <= 45) return "text-[var(--color-warning)]";
  if (value <= 55) return "text-[var(--color-text-secondary)]";
  if (value <= 75) return "text-[var(--color-positive)]";
  return "text-[var(--color-positive)]";
}

function fearGreedLabel(value: number): string {
  if (value <= 25) return "Extreme Fear";
  if (value <= 45) return "Fear";
  if (value <= 55) return "Neutral";
  if (value <= 75) return "Greed";
  return "Extreme Greed";
}

interface MarketData {
  bitcoin: { price: number; change24h: number };
  ethereum: { price: number; change24h: number };
  marketCap: number;
  btcDominance: number;
  fearGreedIndex: number;
  topGainers: CryptoAsset[];
  topLosers: CryptoAsset[];
  aiSummary: string;
  alerts: AlertType[];
  quickInsights: InsightCardType[];
  chartData: Record<string, number[]>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    async function fetchData() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch("/api/market", { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          setData(json);
          setIsLive(json.isLive ?? false);
          setFetchedAt(Date.now());
          retryCount = 0; // Reset on success
        }
      } catch {
        // Retry with backoff on failure
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(fetchData, 2000 * retryCount);
          return;
        }
        // After max retries, stay on fallback — it's already set
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(() => {
      retryCount = 0;
      fetchData();
    }, 30000); // Refresh every 30s
    const tick = setInterval(() => setNowTick(Date.now()), 5000);
    return () => {
      clearInterval(interval);
      clearInterval(tick);
    };
  }, []);

  const secondsAgo = fetchedAt > 0 ? Math.max(0, Math.floor((nowTick - fetchedAt) / 1000)) : null;
  const freshnessLabel =
    secondsAgo === null ? "—" :
    secondsAgo < 5 ? "à l'instant" :
    secondsAgo < 60 ? `il y a ${secondsAgo}s` :
    `il y a ${Math.floor(secondsAgo / 60)}min`;

  // Fallback mock data if API fails
  const fallback: MarketData = {
    bitcoin: { price: 67842.5, change24h: 2.34 },
    ethereum: { price: 3521.18, change24h: -0.87 },
    marketCap: 2.47,
    btcDominance: 54.2,
    fearGreedIndex: 62,
    topGainers: [
      { name: "Solana", symbol: "SOL", price: 178.42, change24h: 8.56 },
      { name: "Avalanche", symbol: "AVAX", price: 42.18, change24h: 6.23 },
      { name: "Chainlink", symbol: "LINK", price: 18.95, change24h: 5.12 },
      { name: "Render", symbol: "RNDR", price: 11.24, change24h: 4.87 },
      { name: "Injective", symbol: "INJ", price: 35.67, change24h: 4.15 },
    ],
    topLosers: [
      { name: "Dogecoin", symbol: "DOGE", price: 0.1234, change24h: -5.67 },
      { name: "Shiba Inu", symbol: "SHIB", price: 0.00002345, change24h: -4.89 },
      { name: "Cardano", symbol: "ADA", price: 0.5678, change24h: -3.45 },
      { name: "Polkadot", symbol: "DOT", price: 7.89, change24h: -2.98 },
      { name: "Cosmos", symbol: "ATOM", price: 9.12, change24h: -2.34 },
    ],
    aiSummary:
      "Le marché est en phase de consolidation. La dominance BTC augmente à 54.2%, indiquant une rotation du capital depuis les altcoins vers Bitcoin. Prudence à court terme recommandée.",
    alerts: [
      { id: "1", type: "volatility", title: "Forte volatilité BTC", description: "Variation de 4.2% en 2h.", timestamp: "Il y a 12 min", severity: "high" },
      { id: "2", type: "breakout", title: "Breakout potentiel ETH", description: "Résistance à $3,600.", timestamp: "Il y a 34 min", severity: "medium" },
      { id: "3", type: "risk", title: "Risque de liquidation", description: "$500M à risque sous $66,000.", timestamp: "Il y a 1h", severity: "high" },
    ],
    quickInsights: [
      { title: "Market Sentiment", value: "62/100", description: "Cupidité modérée", status: "positive" },
      { title: "Pump Alert", value: "SOL +8.5%", description: "Volume 3x supérieur", status: "positive" },
      { title: "Trend Direction", value: "Haussier", description: "Tendance 7j haussière", status: "positive" },
      { title: "Risk Level", value: "Modéré", description: "Volatilité en hausse", status: "neutral" },
    ],
    chartData: {
      "1H": [67500, 67550, 67600, 67580, 67450, 67520, 67700, 67650, 67680, 67800, 67750, 67842],
      "1D": [66800, 66950, 67100, 67050, 66900, 67000, 67200, 67400, 67350, 67200, 67300, 67600, 67500, 67450, 67550, 67650, 67700, 67600, 67700, 67750, 67800, 67780, 67820, 67842],
      "1W": [64000, 64300, 64600, 65200, 65000, 64800, 65100, 65400, 65800, 66200, 66500, 66300, 65900, 66100, 66400, 66700, 67000, 67200, 67100, 66800, 66900, 67100, 67300, 67500, 67400, 67300, 67500, 67600, 67700, 67842],
      "1M": [58000, 58500, 59200, 60500, 60000, 59000, 59500, 60200, 61000, 61800, 63000, 62500, 61500, 62000, 62800, 63500, 64200, 65000, 64500, 64000, 64800, 65500, 66200, 66800, 67000, 67200, 67500, 67842],
      "1Y": [28000, 30000, 32000, 35000, 33000, 37000, 42000, 40000, 38000, 41000, 43000, 45000, 44000, 47000, 49000, 52000, 50000, 53000, 55000, 57000, 60000, 62000, 64000, 66000, 67842],
    },
  };

  const d = data ?? fallback;
  const fgi = d.fearGreedIndex;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-12">
      {/* Section 1: Hero */}
      <section className="text-center py-16 animate-fade-in-up relative">
        {/* Background decorations */}
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-64 w-96 rounded-full bg-[var(--color-accent-blue)]/5 blur-[100px]" />
        {user ? (
          <>
            <h1 className="relative text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Bonjour {user.name.split(" ")[0]}{" "}
              <span className="bg-gradient-to-r from-[var(--color-accent-blue)] via-[var(--color-accent-purple)] to-[var(--color-accent-cyan)] bg-clip-text text-transparent gradient-text-animated bg-[length:200%_auto]">
                !
              </span>
            </h1>
            <p className="relative mt-5 text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "200ms" }}>
              Votre tableau de bord crypto — signaux IA en temps réel
            </p>
          </>
        ) : (
          <>
            <h1 className="relative text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Axiom —{" "}
              <span className="bg-gradient-to-r from-[var(--color-accent-blue)] via-[var(--color-accent-purple)] to-[var(--color-accent-cyan)] bg-clip-text text-transparent gradient-text-animated bg-[length:200%_auto]">
                AI Crypto Intelligence
              </span>
            </h1>
            <p className="relative mt-5 text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "200ms" }}>
              Comprends le marché crypto en temps réel grâce à l&apos;IA
            </p>
          </>
        )}
        <div className="relative mt-10 flex items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <Link href="#market-overview">
            <Button variant="primary" size="lg">
              Voir le marché
            </Button>
          </Link>
          <Link href="/ai-insights">
            <Button variant="secondary" size="lg">
              Analyse IA
            </Button>
          </Link>
        </div>
      </section>

      {/* Section 2: Market Overview */}
      <section id="market-overview" className="animate-fade-in-up scroll-mt-24" style={{ animationDelay: "100ms" }}>
        <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-xl font-bold text-white">Market Overview</h2>
          <div className="flex items-center gap-3 text-xs">
            {isLive ? (
              <span className="flex items-center gap-1.5 text-[var(--color-positive)] font-medium">
                <span className="live-dot" />
                Live — {freshnessLabel}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)]" />
                {loading ? "Chargement..." : "Cache"}
              </span>
            )}
            <span className="text-[var(--color-text-muted)]">
              Source&nbsp;: <span className="text-white/80 font-medium">Binance</span>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 stagger-children">
          <div className="premium-card premium-card-btc p-5 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Bitcoin</p>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">BTC</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-white tabular-nums">
              <AnimatedPrice value={d.bitcoin.price} />
            </p>
            <div className="mt-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                d.bitcoin.change24h >= 0
                  ? "bg-[var(--color-positive)]/15 text-[var(--color-positive)]"
                  : "bg-[var(--color-negative)]/15 text-[var(--color-negative)]"
              }`}>
                {d.bitcoin.change24h >= 0 ? "▲" : "▼"} {Math.abs(d.bitcoin.change24h).toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="premium-card premium-card-eth p-5 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Ethereum</p>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">ETH</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-white tabular-nums">
              <AnimatedPrice value={d.ethereum.price} />
            </p>
            <div className="mt-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                d.ethereum.change24h >= 0
                  ? "bg-[var(--color-positive)]/15 text-[var(--color-positive)]"
                  : "bg-[var(--color-negative)]/15 text-[var(--color-negative)]"
              }`}>
                {d.ethereum.change24h >= 0 ? "▲" : "▼"} {Math.abs(d.ethereum.change24h).toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="premium-card p-5 animate-fade-in-up">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Market Cap</p>
            <p className="mt-2 text-2xl font-bold text-white tabular-nums">
              ${d.marketCap.toFixed(2)}T
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">Total capitalisation</p>
          </div>

          <div className="premium-card p-5 animate-fade-in-up">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">BTC Dominance</p>
            <p className="mt-2 text-2xl font-bold text-white tabular-nums">
              {d.btcDominance.toFixed(1)}%
            </p>
            <p className="mt-2 text-xs text-[var(--color-accent-blue)]">En hausse</p>
          </div>

          <div className="premium-card p-5 animate-fade-in-up">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Fear &amp; Greed</p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${fearGreedColor(fgi)}`}>{fgi}</p>
            <p className={`mt-2 text-xs ${fearGreedColor(fgi)}`}>{fearGreedLabel(fgi)}</p>
          </div>
        </div>
      </section>

      {/* Section 3: AI Market Summary */}
      <section>
        <AISummaryBlock summary={d.aiSummary} loading={loading} />
      </section>

      {/* Section 4: Top Movers */}
      <section className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <h2 className="text-xl font-bold text-white mb-5">Top Movers</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h3 className="text-sm font-semibold text-[var(--color-positive)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--color-positive)]" />
              Top Gainers
            </h3>
            <div className="space-y-2 stagger-children">
              {d.topGainers.map((coin) => (
                <div
                  key={coin.symbol}
                  className="flex items-center justify-between rounded-lg bg-[var(--color-bg-primary)]/50 px-4 py-3 transition-all duration-300 hover:bg-[var(--color-bg-primary)] hover:translate-x-1 animate-slide-in-right"
                >
                  <div>
                    <span className="font-semibold text-white">
                      {coin.symbol}
                    </span>
                    <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                      {coin.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white tabular-nums">
                      ${coin.price.toLocaleString()}
                    </p>
                    <p className="text-xs font-medium text-[var(--color-positive)] tabular-nums">
                      +{coin.change24h.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-[var(--color-negative)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--color-negative)]" />
              Top Losers
            </h3>
            <div className="space-y-2 stagger-children">
              {d.topLosers.map((coin) => (
                <div
                  key={coin.symbol}
                  className="flex items-center justify-between rounded-lg bg-[var(--color-bg-primary)]/50 px-4 py-3 transition-all duration-300 hover:bg-[var(--color-bg-primary)] hover:translate-x-1 animate-slide-in-right"
                >
                  <div>
                    <span className="font-semibold text-white">
                      {coin.symbol}
                    </span>
                    <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                      {coin.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white tabular-nums">
                      $
                      {coin.price < 0.01
                        ? coin.price.toFixed(8)
                        : coin.price.toLocaleString()}
                    </p>
                    <p className="text-xs font-medium text-[var(--color-negative)] tabular-nums">
                      {coin.change24h.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* Section 5: BTC Chart */}
      <section>
        <ChartContainer
          data={d.chartData}
          currentPrice={d.bitcoin.price}
        />
      </section>

      {/* Section 6: Alerts */}
      <section className="animate-fade-in-up">
        <h2 className="text-xl font-bold text-white mb-5">Alertes récentes</h2>
        <div className="space-y-3 stagger-children">
          {d.alerts.slice(0, 3).map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      </section>

      {/* Section 7: Quick Insights */}
      <section className="animate-fade-in-up">
        <h2 className="text-xl font-bold text-white mb-5">Insights rapides</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
          {d.quickInsights.map((insight) => (
            <Card key={insight.title} className="animate-fade-in-up group">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                {insight.title}
              </p>
              <p
                className={`mt-2 text-2xl font-bold tabular-nums ${statusColors[insight.status]} transition-transform duration-300 group-hover:scale-105 origin-left`}
              >
                {insight.value}
              </p>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                {insight.description}
              </p>
              <div className="mt-3">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase transition-all duration-300 ${statusBg[insight.status]} ${statusColors[insight.status]}`}
                >
                  {insight.status === "positive"
                    ? "Favorable"
                    : insight.status === "negative"
                      ? "Défavorable"
                      : "À surveiller"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
