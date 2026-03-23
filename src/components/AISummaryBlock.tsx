"use client";

import Card from "./Card";

interface AISummaryBlockProps {
  summary: string;
  loading?: boolean;
}

export default function AISummaryBlock({
  summary,
  loading = false,
}: AISummaryBlockProps) {
  return (
    <Card highlight className="animate-fade-in-up relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-[var(--color-accent-blue)]/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[var(--color-accent-purple)]/5 blur-3xl" />

      <div className="relative flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] shadow-lg shadow-[var(--color-accent-blue)]/25 animate-float">
          <span className="text-lg">🧠</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">AI Market Summary</h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            Analyse en temps réel
          </p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-[var(--color-positive)]/10 px-3 py-1 text-xs font-medium text-[var(--color-positive)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-positive)] animate-live-pulse" />
          Live
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-4 w-full rounded-lg bg-[var(--color-bg-primary)] shimmer" />
          <div className="h-4 w-5/6 rounded-lg bg-[var(--color-bg-primary)] shimmer" />
          <div className="h-4 w-4/6 rounded-lg bg-[var(--color-bg-primary)] shimmer" />
        </div>
      ) : (
        <p className="relative text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {summary}
        </p>
      )}
    </Card>
  );
}
