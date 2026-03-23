"use client";

import { useEffect, useState } from "react";
import AlertItem from "@/components/AlertItem";
import { type Alert } from "@/data/mock";

const filters = ["All", "Volatility", "Breakouts", "Risk"] as const;
type Filter = (typeof filters)[number];

const filterMap: Record<Filter, string | null> = {
  All: null,
  Volatility: "volatility",
  Breakouts: "breakout",
  Risk: "risk",
};

const defaultAlerts: Alert[] = [
  { id: "1", type: "volatility", title: "Forte volatilité BTC", description: "Le Bitcoin a enregistré une variation de 4.2% en 2 heures.", timestamp: "Il y a 12 min", severity: "high" },
  { id: "2", type: "breakout", title: "Breakout potentiel ETH", description: "Ethereum s'approche de la résistance à $3,600.", timestamp: "Il y a 34 min", severity: "medium" },
  { id: "3", type: "risk", title: "Risque de liquidation élevé", description: "Plus de $500M en positions long sont à risque sous $66,000.", timestamp: "Il y a 1h", severity: "high" },
  { id: "4", type: "volatility", title: "Volume anormal SOL", description: "Le volume Solana a augmenté de 340% en 4 heures.", timestamp: "Il y a 2h", severity: "medium" },
  { id: "5", type: "breakout", title: "Pattern haussier LINK", description: "Chainlink forme un triangle ascendant sur le 4H.", timestamp: "Il y a 3h", severity: "low" },
  { id: "6", type: "risk", title: "Corrélation BTC-actions élevée", description: "Corrélation BTC / S&P 500 à 0.85.", timestamp: "Il y a 4h", severity: "medium" },
  { id: "7", type: "volatility", title: "Whale alert", description: "Transfert de 12,000 BTC vers Binance détecté.", timestamp: "Il y a 5h", severity: "high" },
];

export default function AlertsPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [alertsData, setAlertsData] = useState<Alert[]>(defaultAlerts);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch("/api/market");
        if (res.ok) {
          const json = await res.json();
          if (json.alerts?.length) setAlertsData(json.alerts);
        }
      } catch {
        // Use defaults
      }
    }
    fetchAlerts();
  }, []);

  const filteredAlerts =
    filterMap[activeFilter] === null
      ? alertsData
      : alertsData.filter((a) => a.type === filterMap[activeFilter]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      <section className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Alertes
        </h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Notifications en temps réel sur les mouvements importants du marché
        </p>
      </section>

      <div className="flex gap-2 animate-fade-in" style={{ animationDelay: "100ms" }}>
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 active:scale-[0.97] ${
              activeFilter === filter
                ? "bg-[var(--color-accent-blue)] text-white shadow-lg shadow-[var(--color-accent-blue)]/25"
                : "border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] hover:text-white hover:border-[var(--color-accent-blue)]/30"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="space-y-3 stagger-children">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))
        ) : (
          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-12 text-center animate-scale-in">
            <p className="text-[var(--color-text-muted)]">
              Aucune alerte pour ce filtre
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
