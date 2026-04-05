"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";

interface Props {
  plan: "free" | "pro";
}

interface StatusResponse {
  plan: "free" | "pro";
  isPro: boolean;
  keysConfigured: boolean;
}

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("axiom_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function BinanceKeysCard({ plan }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ canTrade?: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (plan !== "pro") return;
    fetch("/api/binance/status", { headers: authHeaders() })
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {});
  }, [plan]);

  if (plan !== "pro") {
    return (
      <Card className="animate-fade-in-up">
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-sm">🔒</span>
          Trading Réel — Réservé au plan Pro
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Votre compte est en mode simulation. Le trading réel est réservé au compte administrateur.
        </p>
      </Card>
    );
  }

  async function saveKeys() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/binance/save-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ apiKey, apiSecret }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "✅ Clés chiffrées et sauvegardées" });
        setApiKey("");
        setApiSecret("");
        setStatus({ plan: "pro", isPro: true, keysConfigured: true });
      } else {
        setMessage({ type: "error", text: data.error || "Erreur" });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur réseau" });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/binance/test-connection", {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.connected) {
        setTestResult({ canTrade: data.canTrade });
      } else {
        setTestResult({ error: data.error || "Échec de connexion" });
      }
    } catch {
      setTestResult({ error: "Erreur réseau" });
    } finally {
      setTesting(false);
    }
  }

  const connected = status?.keysConfigured;

  return (
    <Card className="animate-fade-in-up">
      <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-warning)]/10 text-sm">🔐</span>
        Trading Réel — Binance <span className="ml-2 text-xs font-semibold text-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]/10 px-2 py-0.5 rounded">PRO</span>
      </h2>

      <div className="rounded-xl bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/30 p-3 mb-5">
        <p className="text-xs text-[var(--color-negative)]">
          ⚠️ ATTENTION : Cette section connecte vos vrais fonds Binance. Toute opération est irréversible.
        </p>
      </div>

      <div className="mb-5 flex items-center gap-2 text-sm">
        <span>Statut :</span>
        {connected ? (
          <span className="flex items-center gap-1.5 text-[var(--color-positive)]">
            <span className="live-dot" /> Connecté
          </span>
        ) : (
          <span className="text-[var(--color-text-muted)]">● Non connecté</span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Clé API Binance</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            autoComplete="off"
            placeholder="••••••••••••••••••••"
            className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-white placeholder:text-[var(--color-text-muted)] font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Clé Secrète Binance</label>
          <input
            type="password"
            value={apiSecret}
            onChange={e => setApiSecret(e.target.value)}
            autoComplete="off"
            placeholder="••••••••••••••••••••"
            className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-white placeholder:text-[var(--color-text-muted)] font-mono"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="btn-primary"
            disabled={saving || !apiKey || !apiSecret}
            onClick={saveKeys}
          >
            {saving ? "Chiffrement..." : "🔒 Sauvegarder les clés"}
          </button>
          <button
            className="btn-primary"
            disabled={testing || !connected}
            onClick={testConnection}
            style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}
          >
            {testing ? "Test en cours..." : "🧪 Tester la connexion"}
          </button>
        </div>

        {message && (
          <div className={`rounded-lg p-3 text-sm ${
            message.type === "success"
              ? "bg-[var(--color-positive)]/10 text-[var(--color-positive)]"
              : "bg-[var(--color-negative)]/10 text-[var(--color-negative)]"
          }`}>{message.text}</div>
        )}

        {testResult && (
          <div className={`rounded-lg p-3 text-sm ${
            testResult.error
              ? "bg-[var(--color-negative)]/10 text-[var(--color-negative)]"
              : "bg-[var(--color-positive)]/10 text-[var(--color-positive)]"
          }`}>
            {testResult.error
              ? `❌ ${testResult.error}`
              : `✅ Connexion OK — canTrade: ${testResult.canTrade ? "oui" : "non"}`}
          </div>
        )}

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-1.5 text-xs text-[var(--color-text-secondary)]">
          <p>✅ Les clés sont chiffrées (AES-256-GCM) côté serveur</p>
          <p>✅ Jamais transmises au navigateur après sauvegarde</p>
          <p>✅ Accès limité à votre IP (configurez-le sur Binance)</p>
          <p>⚠️ Retirez le droit de retrait sur vos clés API Binance</p>
        </div>
      </div>
    </Card>
  );
}
