"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Card from "@/components/Card";

export default function ProfilePage() {
  const { user, loading, updateUser, updatePreferences, addToast } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [favoriteCrypto, setFavoriteCrypto] = useState("BTCUSDT");
  const [currency, setCurrency] = useState("USD");
  const [alertFrequency, setAlertFrequency] = useState("realtime");
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  // Initialize form from user data
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setFavoriteCrypto(user.preferences.favoriteCrypto);
      setCurrency(user.preferences.currency);
      setAlertFrequency(user.preferences.alertFrequency);
      setNotifications(user.preferences.notifications);
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent-blue)]/30 border-t-[var(--color-accent-blue)]" />
      </div>
    );
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      updateUser({ name, email });
      updatePreferences({ favoriteCrypto, currency, alertFrequency, notifications });
      addToast("Profil mis à jour", "success");
      setSaving(false);
    }, 600);
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-5 animate-fade-in-up">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] text-xl font-bold text-white shadow-lg shadow-[var(--color-accent-blue)]/25">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{user.name}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Membre depuis {memberSince}
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Mon Compte */}
        <Card className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="3.5" stroke="var(--color-accent-blue)" strokeWidth="1.5" />
              <path d="M3 18c0-3.9 3.1-6 7-6s7 2.1 7 6" stroke="var(--color-accent-blue)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Mon Compte
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Nom</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-2.5 text-sm text-white transition-all duration-300 focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-blue)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-2.5 text-sm text-white transition-all duration-300 focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-blue)]"
              />
            </div>
          </div>
        </Card>

        {/* Préférences de Trading */}
        <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 14l4-5 3 2.5 4-6 3 3" stroke="var(--color-accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Préférences de Trading
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Crypto favorite</label>
              <select
                value={favoriteCrypto}
                onChange={(e) => setFavoriteCrypto(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-2.5 text-sm text-white transition-all duration-300 focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-blue)]"
              >
                <option value="BTCUSDT">Bitcoin (BTC)</option>
                <option value="ETHUSDT">Ethereum (ETH)</option>
                <option value="SOLUSDT">Solana (SOL)</option>
                <option value="BNBUSDT">BNB</option>
                <option value="XRPUSDT">XRP</option>
                <option value="ADAUSDT">Cardano (ADA)</option>
                <option value="DOGEUSDT">Dogecoin (DOGE)</option>
                <option value="DOTUSDT">Polkadot (DOT)</option>
                <option value="AVAXUSDT">Avalanche (AVAX)</option>
                <option value="LINKUSDT">Chainlink (LINK)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Devise</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-2.5 text-sm text-white transition-all duration-300 focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-blue)]"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Fréquence des alertes</label>
              <select
                value={alertFrequency}
                onChange={(e) => setAlertFrequency(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-2.5 text-sm text-white transition-all duration-300 focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-blue)]"
              >
                <option value="realtime">Temps réel</option>
                <option value="hourly">Toutes les heures</option>
                <option value="daily">Quotidien</option>
                <option value="weekly">Hebdomadaire</option>
              </select>
            </div>
            <div className="flex items-center gap-3 self-end py-2.5">
              <button
                type="button"
                onClick={() => setNotifications(!notifications)}
                className={`relative h-6 w-11 rounded-full transition-colors duration-300 ${
                  notifications ? "bg-[var(--color-accent-blue)]" : "bg-[var(--color-border-subtle)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${
                    notifications ? "translate-x-5.5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">Notifications push</span>
            </div>
          </div>
        </Card>

        {/* Plan */}
        <Card className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="3" width="14" height="14" rx="3" stroke="var(--color-accent-blue)" strokeWidth="1.5" />
              <path d="M7 10l2 2 4-4" stroke="var(--color-accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Plan
          </h2>

          <div className="flex items-center justify-between rounded-xl border border-[var(--color-accent-blue)]/20 bg-[var(--color-accent-blue)]/5 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Free</span>
                <span className="rounded-full bg-[var(--color-accent-blue)]/20 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent-blue)]">
                  ACTIF
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Accès aux signaux de base, 10 cryptos, screener IA
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl bg-gradient-to-r from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[var(--color-accent-blue)]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[var(--color-accent-blue)]/30 hover:-translate-y-0.5"
            >
              Passer Pro
            </button>
          </div>
        </Card>

        {/* Save button */}
        <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: "400ms" }}>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--color-accent-blue)]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[var(--color-accent-blue)]/30 hover:-translate-y-0.5 disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Enregistrement...
              </span>
            ) : (
              "Enregistrer les modifications"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
