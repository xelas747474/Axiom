"use client";

// ============================================
// Trading mode selector — Simulation vs Réel (Binance)
// Visible only for Pro admin. Switching to Réel requires:
// - keys configured + tested
// - explicit confirmation + password re-entry
// The "real" mode stored in localStorage; actual trade exec is manual.
// ============================================

import { useEffect, useState } from "react";

const STORAGE_KEY = "axiom_bot_mode";

function getInitialMode(): "simulation" | "real" {
  if (typeof window === "undefined") return "simulation";
  try {
    return (localStorage.getItem(STORAGE_KEY) as "simulation" | "real") || "simulation";
  } catch {
    return "simulation";
  }
}

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("axiom_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface Props {
  plan: "free" | "pro";
}

export default function TradingModeSelector({ plan }: Props) {
  const [mode, setMode] = useState<"simulation" | "real">("simulation");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [keysOk, setKeysOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(getInitialMode());
    if (plan === "pro") {
      fetch("/api/binance/status", { headers: authHeaders() })
        .then(r => r.json())
        .then(d => setKeysOk(!!d?.keysConfigured))
        .catch(() => {});
    }
  }, [plan]);

  function selectSimulation() {
    setMode("simulation");
    try { localStorage.setItem(STORAGE_KEY, "simulation"); } catch {}
  }

  async function confirmReal() {
    setBusy(true);
    setError(null);
    if (!keysOk) {
      setError("Configurez et testez vos clés Binance dans Paramètres d'abord.");
      setBusy(false);
      return;
    }
    // Verify password via login endpoint (stateless check)
    try {
      const meRes = await fetch("/api/auth/me", { headers: authHeaders() });
      const me = await meRes.json();
      const email = me?.user?.email;
      if (!email) throw new Error("Session invalide");

      const login = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!login.ok) {
        setError("Mot de passe incorrect");
        setBusy(false);
        return;
      }

      // Activate real mode
      setMode("real");
      try { localStorage.setItem(STORAGE_KEY, "real"); } catch {}
      setConfirmOpen(false);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (plan !== "pro") return null;

  return (
    <div className="premium-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Mode de Trading</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {mode === "real"
              ? "Les ordres passent sur Binance avec de vrais fonds."
              : "Aucun ordre réel. Paper-trading uniquement."}
          </p>
        </div>
        {mode === "real" ? (
          <span className="rounded-full bg-[var(--color-negative)]/15 border border-[var(--color-negative)]/40 px-2.5 py-1 text-xs font-bold text-[var(--color-negative)] animate-live-pulse">
            ● RÉEL
          </span>
        ) : (
          <span className="rounded-full bg-[var(--color-accent-blue)]/15 border border-[var(--color-accent-blue)]/40 px-2.5 py-1 text-xs font-bold text-[var(--color-accent-blue)]">
            SIMULATION
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={selectSimulation}
          className={`rounded-xl border-2 p-4 text-center transition-all ${
            mode === "simulation"
              ? "border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]/10"
              : "border-[var(--color-border-subtle)] hover:border-white/20"
          }`}
        >
          <div className="text-2xl mb-1">🧪</div>
          <div className="text-sm font-bold text-white">Simulation</div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Sans risque</div>
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={mode === "real"}
          className={`rounded-xl border-2 p-4 text-center transition-all ${
            mode === "real"
              ? "border-[var(--color-negative)] bg-[var(--color-negative)]/10"
              : "border-[var(--color-border-subtle)] hover:border-[var(--color-negative)]/40"
          }`}
        >
          <div className="text-2xl mb-1">💰</div>
          <div className="text-sm font-bold text-white">Réel (Binance)</div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Vrais fonds</div>
        </button>
      </div>

      {mode === "real" && (
        <div className="real-mode-banner mt-4 rounded-lg px-3 py-2 text-xs font-semibold text-center">
          ⚠️ MODE RÉEL — Vos fonds sont engagés
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="premium-card w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-2">
              ⚠️ Activer le mode RÉEL
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Êtes-vous sûr ? Les trades seront exécutés avec de vrais fonds sur Binance. Entrez votre mot de passe pour confirmer.
            </p>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mot de passe"
              autoFocus
              className="w-full mb-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-3 py-2.5 text-sm text-white"
            />
            {error && (
              <div className="mb-3 rounded-lg bg-[var(--color-negative)]/10 p-2.5 text-xs text-[var(--color-negative)]">
                {error}
              </div>
            )}
            {!keysOk && (
              <div className="mb-3 rounded-lg bg-[var(--color-warning)]/10 p-2.5 text-xs text-[var(--color-warning)]">
                ⚠️ Clés Binance non configurées. Configurez-les dans Paramètres.
              </div>
            )}
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg border border-[var(--color-border-subtle)] py-2.5 text-sm text-white hover:bg-white/5"
                onClick={() => { setConfirmOpen(false); setPassword(""); setError(null); }}
              >
                Annuler
              </button>
              <button
                className="btn-danger flex-1"
                onClick={confirmReal}
                disabled={busy || !password}
              >
                {busy ? "Vérification..." : "Activer le mode RÉEL"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
