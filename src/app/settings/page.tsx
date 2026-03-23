"use client";

import { useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";

export default function SettingsPage() {
  const [tradingMode, setTradingMode] = useState<"simulation" | "real">(
    "simulation"
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Paramètres
        </h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Configurez votre environnement de trading
        </p>
      </section>

      {/* API Configuration */}
      <Card>
        <h2 className="text-lg font-bold text-white mb-6">
          API Configuration
        </h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              API Key
            </label>
            <input
              type="password"
              placeholder="Entrez votre clé API"
              className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-blue)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              API Secret
            </label>
            <input
              type="password"
              placeholder="Entrez votre secret API"
              className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-blue)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Adresse IP autorisée
            </label>
            <input
              type="text"
              placeholder="ex: 192.168.1.1"
              className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-blue)]"
            />
          </div>
          <Button variant="primary" size="md">
            Sauvegarder
          </Button>
        </div>
      </Card>

      {/* Risk Management */}
      <Card>
        <h2 className="text-lg font-bold text-white mb-6">Risk Management</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Taille max par trade (%)
            </label>
            <input
              type="number"
              defaultValue={5}
              min={1}
              max={100}
              className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-blue)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Stop Loss (%)
            </label>
            <input
              type="number"
              defaultValue={2}
              min={0.5}
              max={50}
              step={0.5}
              className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-blue)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Limite journalière ($)
            </label>
            <input
              type="number"
              defaultValue={1000}
              min={100}
              className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-blue)]"
            />
          </div>
          <Button variant="primary" size="md">
            Appliquer
          </Button>
        </div>
      </Card>

      {/* Trading Mode */}
      <Card>
        <h2 className="text-lg font-bold text-white mb-6">Mode Trading</h2>
        <div className="flex gap-4">
          <button
            onClick={() => setTradingMode("simulation")}
            className={`flex-1 rounded-xl border-2 p-6 text-center transition-all ${
              tradingMode === "simulation"
                ? "border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]/10"
                : "border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] hover:border-[var(--color-text-muted)]"
            }`}
          >
            <div className="text-3xl mb-2">🧪</div>
            <h3
              className={`text-sm font-bold ${
                tradingMode === "simulation"
                  ? "text-[var(--color-accent-blue)]"
                  : "text-white"
              }`}
            >
              Simulation
            </h3>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Testez sans risque
            </p>
          </button>

          <button
            onClick={() => setTradingMode("real")}
            className={`flex-1 rounded-xl border-2 p-6 text-center transition-all ${
              tradingMode === "real"
                ? "border-[var(--color-positive)] bg-[var(--color-positive)]/10"
                : "border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] hover:border-[var(--color-text-muted)]"
            }`}
          >
            <div className="text-3xl mb-2">🔥</div>
            <h3
              className={`text-sm font-bold ${
                tradingMode === "real"
                  ? "text-[var(--color-positive)]"
                  : "text-white"
              }`}
            >
              Réel
            </h3>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Trading en direct
            </p>
          </button>
        </div>
        {tradingMode === "real" && (
          <div className="mt-4 rounded-xl bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 p-4">
            <p className="text-sm text-[var(--color-negative)]">
              Attention : Le mode réel implique des risques financiers. Assurez-vous
              d&apos;avoir configuré correctement vos paramètres de risk management.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
