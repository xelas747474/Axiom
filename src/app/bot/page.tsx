"use client";

import { useEffect, useState, useCallback, Component, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import BotHeader from "@/components/bot/BotHeader";
import BotStats from "@/components/bot/BotStats";
import BotConfig from "@/components/bot/BotConfig";
import BotPortfolioChart from "@/components/bot/BotPortfolioChart";
import BotPositions from "@/components/bot/BotPositions";
import BotHistory from "@/components/bot/BotHistory";
import BotLogs from "@/components/bot/BotLogs";
import BotAnalytics from "@/components/bot/BotAnalytics";

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
          <p className="text-xs text-gray-400 mt-0.5">Régénère les trades avec les vrais prix CoinGecko des 7 derniers jours</p>
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

export default function BotPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

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
          <p className="text-lg font-bold text-white mb-2">🔒 Accès restreint</p>
          <p className="text-sm text-[var(--color-text-muted)]">Connectez-vous pour accéder au bot de trading.</p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      <ErrorBoundary label="Header"><BotHeader /></ErrorBoundary>
      <ErrorBoundary label="Stats"><BotStats /></ErrorBoundary>
      <ErrorBoundary label="Portfolio"><BotPortfolioChart /></ErrorBoundary>
      <ErrorBoundary label="Config"><BotConfig /></ErrorBoundary>
      <ErrorBoundary label="Positions"><BotPositions /></ErrorBoundary>
      <ErrorBoundary label="Historique"><BotHistory /></ErrorBoundary>
      <ErrorBoundary label="Analytics"><BotAnalytics /></ErrorBoundary>
      <ErrorBoundary label="Logs"><BotLogs /></ErrorBoundary>
      {isAdmin && <ResetHistoryButton />}
    </div>
  );
}
