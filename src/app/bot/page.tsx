"use client";

import { useEffect, useState, useCallback, Component, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useBot } from "@/lib/bot/context";
import BotHeader from "@/components/bot/BotHeader";
import BotStats from "@/components/bot/BotStats";
import BotConfig from "@/components/bot/BotConfig";
import BotPortfolioChart from "@/components/bot/BotPortfolioChart";
import BotPositions from "@/components/bot/BotPositions";
import BotHistory from "@/components/bot/BotHistory";
import BotLogs from "@/components/bot/BotLogs";
import BotAnalytics from "@/components/bot/BotAnalytics";
import BacktestPanel from "@/components/bot/BacktestPanel";
import BacktestResults from "@/components/bot/BacktestResults";
import StrategyComparison from "@/components/bot/StrategyComparison";
import ExportButton from "@/components/bot/ExportButton";
import type { BacktestResult } from "@/components/bot/BacktestPanel";

// ============================================
// Bot Page — Premium tab-based layout
// Tabs: Dashboard / Backtest / Comparer / Historique / Analytics
// ============================================

class ErrorBoundary extends Component<{ children: ReactNode; label: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; label: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400">Erreur de chargement : {this.props.label}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function ResetHistoryButton() {
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleReset = useCallback(async () => {
    if (!confirm("Réinitialiser tout l'historique du bot avec les vrais prix historiques ? Cette action est irréversible.")) return;

    setResetting(true);
    setResult(null);

    try {
      const res = await fetch("/api/bot/reset-history", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.success) {
        setResult(`${data.tradesGenerated} trades générés (${data.wins}W/${data.losses}L) — Portfolio: $${data.finalValue}`);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setResult(`Erreur: ${data.error ?? "Échec"}`);
      }
    } catch {
      setResult("Erreur réseau");
    } finally {
      setResetting(false);
    }
  }, []);

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-orange-400">Réinitialiser l&apos;historique</p>
          <p className="text-xs text-gray-400 mt-0.5">Régénère les trades avec les vrais prix Binance des 7 derniers jours</p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="shrink-0 rounded-lg bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-400 transition hover:bg-orange-500/30 disabled:opacity-50"
        >
          {resetting ? "Réinitialisation..." : "Réinitialiser"}
        </button>
      </div>
      {result && (
        <p className={`mt-2 text-xs ${result.startsWith("Erreur") ? "text-red-400" : "text-green-400"}`}>
          {result}
        </p>
      )}
    </div>
  );
}

type TabKey = "dashboard" | "backtest" | "compare" | "history" | "analytics";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "backtest", label: "Backtest", icon: "🧪" },
  { key: "compare", label: "Comparer", icon: "⚖️" },
  { key: "history", label: "Historique", icon: "📜" },
  { key: "analytics", label: "Analytics", icon: "📈" },
];

function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <div className="relative flex gap-1 rounded-xl bg-[var(--color-bg-primary)]/40 p-1 border border-[var(--color-border-subtle)]">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
            active === tab.key
              ? "bg-[var(--color-accent-blue)]/15 text-white shadow-sm"
              : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5"
          }`}
        >
          <span className="text-base">{tab.icon}</span>
          <span className="hidden sm:inline">{tab.label}</span>
          {active === tab.key && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--color-accent-blue)]" />
          )}
        </button>
      ))}
    </div>
  );
}

function DashboardTab({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="space-y-6">
      <ErrorBoundary label="Stats"><BotStats /></ErrorBoundary>
      <ErrorBoundary label="Portfolio"><BotPortfolioChart /></ErrorBoundary>
      <ErrorBoundary label="Config"><BotConfig /></ErrorBoundary>
      <ErrorBoundary label="Positions"><BotPositions /></ErrorBoundary>
      <ErrorBoundary label="Logs"><BotLogs /></ErrorBoundary>
      {isAdmin && <ResetHistoryButton />}
    </div>
  );
}

function BacktestTab() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [, setRunning] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4">
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5 sticky top-4">
          <h3 className="text-sm font-semibold text-white mb-4">Configuration</h3>
          <BacktestPanel onResult={setResult} onRunning={setRunning} />
        </div>
      </div>
      <div className="lg:col-span-8">
        {result ? (
          <BacktestResults result={result} />
        ) : (
          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-12 text-center">
            <div className="text-4xl mb-3 opacity-30">🧪</div>
            <p className="text-sm text-[var(--color-text-muted)]">
              Configurez et lancez un backtest pour voir les résultats
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareTab() {
  return (
    <ErrorBoundary label="Comparaison">
      <StrategyComparison />
    </ErrorBoundary>
  );
}

function HistoryTab() {
  const { history } = useBot();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Historique des Trades</h3>
        <ExportButton trades={history} />
      </div>
      <ErrorBoundary label="Historique"><BotHistory /></ErrorBoundary>
    </div>
  );
}

function AnalyticsTab() {
  return (
    <ErrorBoundary label="Analytics"><BotAnalytics /></ErrorBoundary>
  );
}

export default function BotPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent-blue)]/30 border-t-[var(--color-accent-blue)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-lg font-bold text-white mb-2">Accès restreint</p>
          <p className="text-sm text-[var(--color-text-muted)]">Connectez-vous pour accéder au bot de trading.</p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      <ErrorBoundary label="Header"><BotHeader /></ErrorBoundary>

      {/* Tab navigation */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div className="animate-fade-in-up" key={activeTab}>
        {activeTab === "dashboard" && <DashboardTab isAdmin={isAdmin} />}
        {activeTab === "backtest" && <BacktestTab />}
        {activeTab === "compare" && <CompareTab />}
        {activeTab === "history" && <HistoryTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
}
