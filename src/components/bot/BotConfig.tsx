"use client";

import { useBot } from "@/lib/bot/context";
import { STRATEGIES, TRADED_CRYPTOS, type BotStrategy, type TradedCrypto } from "@/lib/bot/types";
import Card from "@/components/Card";

export default function BotConfig() {
  const { config, state, updateConfig, isRunning } = useBot();

  const pnlPct = config.initialCapital > 0
    ? ((state.portfolioValue - config.initialCapital) / config.initialCapital) * 100
    : 0;
  const isProfit = pnlPct >= 0;

  function handleAllocationChange(crypto: TradedCrypto, value: number) {
    const others = (Object.keys(config.allocations) as TradedCrypto[]).filter(
      (c) => c !== crypto && config.enabledCryptos[c]
    );
    const remaining = 100 - value;
    const othersTotal = others.reduce((s, c) => s + config.allocations[c], 0);

    const newAllocations = { ...config.allocations };
    newAllocations[crypto] = value;

    if (othersTotal > 0) {
      for (const c of others) {
        newAllocations[c] = Math.round((config.allocations[c] / othersTotal) * remaining);
      }
    } else if (others.length > 0) {
      const each = Math.round(remaining / others.length);
      for (const c of others) {
        newAllocations[c] = each;
      }
    }

    // Fix rounding to ensure sum is 100
    const sum = Object.values(newAllocations).reduce((s, v) => s + v, 0);
    if (sum !== 100 && others.length > 0) {
      newAllocations[others[0]] += 100 - sum;
    }

    updateConfig({ allocations: newAllocations });
  }

  function toggleCrypto(crypto: TradedCrypto) {
    const enabled = { ...config.enabledCryptos, [crypto]: !config.enabledCryptos[crypto] };
    const enabledList = (Object.keys(enabled) as TradedCrypto[]).filter((c) => enabled[c]);
    if (enabledList.length === 0) return; // Must have at least one

    const alloc = { ...config.allocations };
    if (!enabled[crypto]) {
      alloc[crypto] = 0;
      const each = Math.round(100 / enabledList.length);
      for (const c of enabledList) alloc[c] = each;
      const sum = enabledList.reduce((s, c) => s + alloc[c], 0);
      if (sum !== 100) alloc[enabledList[0]] += 100 - sum;
    } else {
      const each = Math.round(100 / enabledList.length);
      for (const c of enabledList) alloc[c] = each;
      const sum = enabledList.reduce((s, c) => s + alloc[c], 0);
      if (sum !== 100) alloc[enabledList[0]] += 100 - sum;
    }

    updateConfig({ enabledCryptos: enabled, allocations: alloc });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
      {/* Capital */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <span className="text-base">💰</span> Capital
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Capital initial (USDC)</label>
            <input
              type="number"
              min={100}
              max={10000}
              value={config.initialCapital}
              onChange={(e) => updateConfig({ initialCapital: Math.max(100, Math.min(10000, Number(e.target.value))) })}
              disabled={isRunning}
              className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-2 text-sm text-white font-mono tabular-nums focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-blue)] disabled:opacity-50"
            />
            <input
              type="range"
              min={100}
              max={10000}
              step={100}
              value={config.initialCapital}
              onChange={(e) => updateConfig({ initialCapital: Number(e.target.value) })}
              disabled={isRunning}
              className="w-full mt-2 accent-[var(--color-accent-blue)]"
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">Actuel:</span>
            <span className={`font-bold font-mono tabular-nums ${isProfit ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
              ${state.portfolioValue.toFixed(2)} ({isProfit ? "+" : ""}{pnlPct.toFixed(2)}%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--color-bg-primary)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.max(2, (state.portfolioValue / (config.initialCapital * 1.3)) * 100))}%`,
                background: isProfit
                  ? "linear-gradient(90deg, #22c55e, #4ade80)"
                  : "linear-gradient(90deg, #ef4444, #f87171)",
              }}
            />
          </div>
        </div>
      </Card>

      {/* Cryptos */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <span className="text-base">📊</span> Cryptos tradées
        </h3>
        <div className="space-y-3">
          {TRADED_CRYPTOS.map((crypto) => {
            const enabled = config.enabledCryptos[crypto.symbol];
            const alloc = config.allocations[crypto.symbol];
            const usdcAmount = (config.initialCapital * alloc) / 100;

            return (
              <div key={crypto.symbol} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => !isRunning && toggleCrypto(crypto.symbol)}
                    disabled={isRunning}
                    className="flex items-center gap-2 text-sm disabled:opacity-50"
                  >
                    <div
                      className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
                        enabled
                          ? "border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]"
                          : "border-[var(--color-border-subtle)]"
                      }`}
                    >
                      {enabled && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className={`font-bold ${enabled ? "text-white" : "text-[var(--color-text-muted)]"}`}>
                      {crypto.label}
                    </span>
                    <span className="text-[var(--color-text-muted)] text-xs">{crypto.name}</span>
                  </button>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-white font-bold font-mono tabular-nums">{alloc}%</span>
                    <span className="text-[var(--color-text-muted)] font-mono tabular-nums">(${usdcAmount.toFixed(0)})</span>
                  </div>
                </div>
                {enabled && (
                  <input
                    type="range"
                    min={5}
                    max={90}
                    value={alloc}
                    onChange={(e) => handleAllocationChange(crypto.symbol, Number(e.target.value))}
                    disabled={isRunning}
                    className="w-full accent-[var(--color-accent-blue)] disabled:opacity-50"
                  />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Strategy */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <span className="text-base">🎯</span> Stratégie
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(STRATEGIES) as BotStrategy[]).map((key) => {
            const s = STRATEGIES[key];
            const active = config.strategy === key;
            return (
              <button
                key={key}
                onClick={() => !isRunning && updateConfig({ strategy: key })}
                disabled={isRunning}
                className={`rounded-xl border p-3 text-center transition-all duration-300 disabled:opacity-50 ${
                  active
                    ? "border-[var(--color-accent-blue)]/50 bg-[var(--color-accent-blue)]/10"
                    : "border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)]"
                }`}
              >
                <div className="text-lg mb-1">{s.emoji}</div>
                <div className={`text-xs font-bold ${active ? "text-[var(--color-accent-blue)]" : "text-[var(--color-text-secondary)]"}`}>
                  {s.label}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] mt-1 space-y-0.5">
                  <div>SL: {s.stopLossPct}% / TP: {s.takeProfitPct}%</div>
                  <div>Win rate: ~{s.targetWinRate}%</div>
                  <div>{s.tradesPerDay[0]}-{s.tradesPerDay[1]} trades/j</div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Risk Management */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <span className="text-base">🛡️</span> Risk Management
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[var(--color-text-muted)]">Max drawdown</span>
              <span className="text-white font-bold font-mono">{config.maxDrawdownPct}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              value={config.maxDrawdownPct}
              onChange={(e) => updateConfig({ maxDrawdownPct: Number(e.target.value) })}
              disabled={isRunning}
              className="w-full accent-[var(--color-accent-blue)] disabled:opacity-50"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[var(--color-text-muted)]">Max trades simultanés</span>
              <span className="text-white font-bold font-mono">{config.maxConcurrentTrades}</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={config.maxConcurrentTrades}
              onChange={(e) => updateConfig({ maxConcurrentTrades: Number(e.target.value) })}
              disabled={isRunning}
              className="w-full accent-[var(--color-accent-blue)] disabled:opacity-50"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">Trailing stop</span>
            <button
              onClick={() => !isRunning && updateConfig({ trailingStop: !config.trailingStop })}
              disabled={isRunning}
              className={`relative h-6 w-11 rounded-full transition-colors duration-300 disabled:opacity-50 ${
                config.trailingStop ? "bg-[var(--color-accent-blue)]" : "bg-[var(--color-border-subtle)]"
              }`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${
                config.trailingStop ? "translate-x-[22px]" : "translate-x-0.5"
              }`} />
            </button>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[var(--color-text-muted)]">Cooldown après perte</span>
              <span className="text-white font-bold font-mono">{config.cooldownMinutes} min</span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={config.cooldownMinutes}
              onChange={(e) => updateConfig({ cooldownMinutes: Number(e.target.value) })}
              disabled={isRunning}
              className="w-full accent-[var(--color-accent-blue)] disabled:opacity-50"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
