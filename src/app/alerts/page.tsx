"use client";

import { useState } from "react";
import AlertItem from "@/components/AlertItem";
import { alerts } from "@/data/mock";

const filters = ["All", "Volatility", "Breakouts", "Risk"] as const;
type Filter = (typeof filters)[number];

const filterMap: Record<Filter, string | null> = {
  All: null,
  Volatility: "volatility",
  Breakouts: "breakout",
  Risk: "risk",
};

export default function AlertsPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>("All");

  const filteredAlerts =
    filterMap[activeFilter] === null
      ? alerts
      : alerts.filter((a) => a.type === filterMap[activeFilter]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Alertes
        </h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Notifications en temps réel sur les mouvements importants du marché
        </p>
      </section>

      <div className="flex gap-2">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeFilter === filter
                ? "bg-[var(--color-accent-blue)] text-white"
                : "border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] hover:text-white"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))
        ) : (
          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-12 text-center">
            <p className="text-[var(--color-text-muted)]">
              Aucune alerte pour ce filtre
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
