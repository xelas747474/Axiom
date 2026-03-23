"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";

const statusColors = {
  positive: "text-[var(--color-positive)]",
  negative: "text-[var(--color-negative)]",
  neutral: "text-[var(--color-warning)]",
};

const statusBg = {
  positive: "bg-[var(--color-positive)]/10",
  negative: "bg-[var(--color-negative)]/10",
  neutral: "bg-[var(--color-warning)]/10",
};

interface Signal {
  label: string;
  value: string;
  status: "positive" | "negative" | "neutral";
}

interface InsightSection {
  title: string;
  content: string;
  signals: Signal[];
}

interface AIInsightsData {
  global: InsightSection;
  bitcoin: InsightSection;
  altcoins: InsightSection;
}

function InsightSectionCard({
  section,
  index,
}: {
  section: InsightSection;
  index: number;
}) {
  return (
    <Card
      highlight
      className="animate-fade-in-up relative overflow-hidden"
      key={section.title}
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full blur-3xl"
        style={{
          background:
            index === 0
              ? "rgba(59,130,246,0.06)"
              : index === 1
                ? "rgba(245,158,11,0.06)"
                : "rgba(139,92,246,0.06)",
          animationDelay: `${index * 200}ms`,
        }}
      />

      <h3 className="relative text-lg font-bold text-white mb-3 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] text-sm">
          {index === 0 ? "🌍" : index === 1 ? "₿" : "💎"}
        </span>
        {section.title}
      </h3>
      <p className="relative text-sm leading-relaxed text-[var(--color-text-secondary)] mb-6">
        {section.content}
      </p>
      <div className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        {section.signals.map((signal) => (
          <div
            key={signal.label}
            className="rounded-xl bg-[var(--color-bg-primary)]/50 p-4 transition-all duration-300 hover:bg-[var(--color-bg-primary)] hover:-translate-y-0.5 animate-scale-in"
          >
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              {signal.label}
            </p>
            <p
              className={`mt-1 text-sm font-semibold ${statusColors[signal.status]}`}
            >
              {signal.value}
            </p>
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBg[signal.status]} ${statusColors[signal.status]}`}
            >
              {signal.status === "positive"
                ? "Positif"
                : signal.status === "negative"
                  ? "Négatif"
                  : "Neutre"}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function AIInsightsPage() {
  const [insights, setInsights] = useState<AIInsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch("/api/ai-insights");
        if (res.ok) {
          const json = await res.json();
          setInsights(json);
        }
      } catch {
        // API not available
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, []);

  // Fallback data
  const defaultInsights: AIInsightsData = {
    global: {
      title: "Analyse Globale du Marché",
      content:
        "Le marché crypto montre des signes de maturité avec une capitalisation totale de $2.47T. La phase actuelle de consolidation est caractéristique d'une accumulation institutionnelle. Recommandation : maintenir une exposition modérée avec un biais haussier.",
      signals: [
        { label: "Tendance", value: "Consolidation haussière", status: "positive" },
        { label: "Volume", value: "Sous la moyenne 30j", status: "neutral" },
        { label: "Flux institutionnel", value: "Positif", status: "positive" },
        { label: "Risque macro", value: "Modéré", status: "neutral" },
      ],
    },
    bitcoin: {
      title: "Analyse Bitcoin",
      content:
        "Bitcoin maintient sa position au-dessus du support clé à $65,000. La dominance BTC en hausse à 54.2% indique un flight-to-quality. Le prochain objectif technique se situe à $70,000.",
      signals: [
        { label: "Prix", value: "$67,842", status: "positive" },
        { label: "Résistance", value: "$70,000", status: "neutral" },
        { label: "Support", value: "$63,500", status: "positive" },
        { label: "RSI", value: "58 (neutre)", status: "neutral" },
      ],
    },
    altcoins: {
      title: "Analyse Altcoins",
      content:
        "Le marché des altcoins montre une rotation sectorielle. Les tokens liés à l'IA et les L1 performants surperforment le marché. Les memecoins montrent des signes de faiblesse.",
      signals: [
        { label: "ETH/BTC", value: "En baisse", status: "negative" },
        { label: "Secteur fort", value: "AI & L1", status: "positive" },
        { label: "Secteur faible", value: "Memecoins", status: "negative" },
        { label: "Opportunité", value: "DeFi blue chips", status: "positive" },
      ],
    },
  };

  const data = insights ?? defaultInsights;
  const sections = [data.global, data.bitcoin, data.altcoins];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-10">
      <section className="text-center py-8 animate-fade-in-up relative">
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-48 w-72 rounded-full bg-[var(--color-accent-purple)]/5 blur-[80px]" />
        <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] mb-4 shadow-lg shadow-[var(--color-accent-blue)]/25 animate-float">
          <span className="text-2xl">🧠</span>
        </div>
        <h1 className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Analyse IA du Marché
        </h1>
        <p className="relative mt-3 text-[var(--color-text-secondary)] max-w-xl mx-auto">
          Intelligence artificielle appliquée à l&apos;analyse des marchés crypto
          pour des décisions éclairées
        </p>
        {loading && (
          <div className="mt-6 flex justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--color-accent-blue)] animate-live-pulse" />
            <span className="text-xs text-[var(--color-text-muted)]">
              Analyse en cours...
            </span>
          </div>
        )}
      </section>

      {sections.map((section, i) => (
        <div key={section.title} style={{ animationDelay: `${i * 150}ms` }}>
          <InsightSectionCard section={section} index={i} />
        </div>
      ))}
    </div>
  );
}
