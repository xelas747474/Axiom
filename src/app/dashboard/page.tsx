import Card from "@/components/Card";
import Button from "@/components/Button";
import AISummaryBlock from "@/components/AISummaryBlock";
import AlertItem from "@/components/AlertItem";
import ChartContainer from "@/components/ChartContainer";
import {
  marketOverview,
  aiMarketSummary,
  topGainers,
  topLosers,
  alerts,
  quickInsights,
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

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-10">
      {/* Section 1: Hero */}
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Axiom —{" "}
          <span className="bg-gradient-to-r from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] bg-clip-text text-transparent">
            AI Crypto Intelligence
          </span>
        </h1>
        <p className="mt-4 text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto">
          Comprends le marché crypto en temps réel grâce à l&apos;IA
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button variant="primary" size="lg">
            Voir le marché
          </Button>
          <Button variant="secondary" size="lg">
            Analyse IA
          </Button>
        </div>
      </section>

      {/* Section 2: Market Overview */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">Market Overview</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Card>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              Bitcoin
            </p>
            <p className="mt-2 text-2xl font-bold text-white">
              ${marketOverview.bitcoin.price.toLocaleString()}
            </p>
            <p
              className={`mt-1 text-sm font-medium ${
                marketOverview.bitcoin.change24h >= 0
                  ? "text-[var(--color-positive)]"
                  : "text-[var(--color-negative)]"
              }`}
            >
              {marketOverview.bitcoin.change24h >= 0 ? "+" : ""}
              {marketOverview.bitcoin.change24h}%
            </p>
          </Card>

          <Card>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              Ethereum
            </p>
            <p className="mt-2 text-2xl font-bold text-white">
              ${marketOverview.ethereum.price.toLocaleString()}
            </p>
            <p
              className={`mt-1 text-sm font-medium ${
                marketOverview.ethereum.change24h >= 0
                  ? "text-[var(--color-positive)]"
                  : "text-[var(--color-negative)]"
              }`}
            >
              {marketOverview.ethereum.change24h >= 0 ? "+" : ""}
              {marketOverview.ethereum.change24h}%
            </p>
          </Card>

          <Card>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              Market Cap
            </p>
            <p className="mt-2 text-2xl font-bold text-white">
              ${marketOverview.marketCap}T
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Total
            </p>
          </Card>

          <Card>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              BTC Dominance
            </p>
            <p className="mt-2 text-2xl font-bold text-white">
              {marketOverview.btcDominance}%
            </p>
            <p className="mt-1 text-sm text-[var(--color-accent-blue)]">
              En hausse
            </p>
          </Card>

          <Card>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              Fear & Greed
            </p>
            <p className="mt-2 text-2xl font-bold text-white">
              {marketOverview.fearGreedIndex}
            </p>
            <p className="mt-1 text-sm text-[var(--color-warning)]">
              {marketOverview.fearGreedLabel}
            </p>
          </Card>
        </div>
      </section>

      {/* Section 3: AI Market Summary */}
      <section>
        <AISummaryBlock summary={aiMarketSummary} />
      </section>

      {/* Section 4: Top Movers */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">Top Movers</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h3 className="text-sm font-semibold text-[var(--color-positive)] uppercase tracking-wider mb-4">
              Top Gainers
            </h3>
            <div className="space-y-3">
              {topGainers.map((coin) => (
                <div
                  key={coin.symbol}
                  className="flex items-center justify-between rounded-lg bg-[var(--color-bg-primary)]/50 px-4 py-3"
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
                    <p className="text-sm font-medium text-white">
                      ${coin.price.toLocaleString()}
                    </p>
                    <p className="text-xs font-medium text-[var(--color-positive)]">
                      +{coin.change24h}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-[var(--color-negative)] uppercase tracking-wider mb-4">
              Top Losers
            </h3>
            <div className="space-y-3">
              {topLosers.map((coin) => (
                <div
                  key={coin.symbol}
                  className="flex items-center justify-between rounded-lg bg-[var(--color-bg-primary)]/50 px-4 py-3"
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
                    <p className="text-sm font-medium text-white">
                      ${coin.price < 0.01 ? coin.price.toFixed(8) : coin.price.toLocaleString()}
                    </p>
                    <p className="text-xs font-medium text-[var(--color-negative)]">
                      {coin.change24h}%
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
        <ChartContainer />
      </section>

      {/* Section 6: Alerts */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">Alertes récentes</h2>
        <div className="space-y-3">
          {alerts.slice(0, 3).map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      </section>

      {/* Section 7: Quick Insights */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">Insights rapides</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickInsights.map((insight) => (
            <Card key={insight.title}>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                {insight.title}
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${statusColors[insight.status]}`}
              >
                {insight.value}
              </p>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                {insight.description}
              </p>
              <div className="mt-3">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusBg[insight.status]} ${statusColors[insight.status]}`}
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
