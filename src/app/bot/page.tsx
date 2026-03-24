"use client";

import { useEffect } from "react";
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      <BotHeader />
      <BotStats />
      <BotPortfolioChart />
      <BotConfig />
      <BotPositions />
      <BotHistory />
      <BotAnalytics />
      <BotLogs />
    </div>
  );
}
