"use client";

import { useState, useEffect } from "react";
import { useBot } from "@/lib/bot/context";

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

export default function BotHeader() {
  const { state, isRunning, toggleBot } = useBot();
  const [uptime, setUptime] = useState("");

  useEffect(() => {
    if (!isRunning || !state.startedAt) {
      setUptime("");
      return;
    }
    const update = () => setUptime(formatUptime(Date.now() - state.startedAt!));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isRunning, state.startedAt]);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            AXIOM AutoTrader
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wider ${
              isRunning
                ? "bg-[var(--color-positive)]/15 text-[var(--color-positive)]"
                : "bg-[var(--color-negative)]/15 text-[var(--color-negative)]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${isRunning ? "animate-live-pulse bg-[var(--color-positive)]" : "bg-[var(--color-negative)]"}`}
            />
            {isRunning ? "RUNNING" : "STOPPED"}
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Bot de trading IA autonome — Simulation
        </p>
        {isRunning && uptime && (
          <p className="text-xs text-[var(--color-text-muted)] mt-1 font-mono tabular-nums">
            Actif depuis : {uptime}
          </p>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={toggleBot}
        className={`relative flex items-center gap-3 rounded-2xl px-6 py-3 font-semibold text-sm transition-all duration-500 shadow-lg active:scale-[0.97] ${
          isRunning
            ? "bg-[var(--color-negative)]/20 border border-[var(--color-negative)]/30 text-[var(--color-negative)] hover:bg-[var(--color-negative)]/30 shadow-[var(--color-negative)]/10"
            : "bg-gradient-to-r from-[var(--color-positive)] to-emerald-500 text-white hover:shadow-xl hover:shadow-[var(--color-positive)]/25 hover:-translate-y-0.5"
        }`}
      >
        {/* Slide toggle */}
        <div className={`relative h-6 w-11 rounded-full transition-colors duration-500 ${isRunning ? "bg-[var(--color-negative)]" : "bg-white/30"}`}>
          <div
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-500 ${
              isRunning ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </div>
        {isRunning ? "Arrêter le bot" : "Démarrer le bot"}
      </button>
    </div>
  );
}
