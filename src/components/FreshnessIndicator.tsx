"use client";

import { useEffect, useState } from "react";

interface FreshnessIndicatorProps {
  fetchedAt: number;
  isLive?: boolean;
  source?: string;
  loading?: boolean;
}

export default function FreshnessIndicator({
  fetchedAt,
  isLive = false,
  source = "Binance",
  loading = false,
}: FreshnessIndicatorProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const secondsAgo = fetchedAt > 0 ? Math.max(0, Math.floor((now - fetchedAt) / 1000)) : null;
  const freshnessLabel =
    secondsAgo === null
      ? "—"
      : secondsAgo < 5
        ? "à l'instant"
        : secondsAgo < 60
          ? `il y a ${secondsAgo}s`
          : `il y a ${Math.floor(secondsAgo / 60)}min`;

  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      {isLive ? (
        <span className="flex items-center gap-1.5 text-[var(--color-positive)] font-medium">
          <span className="live-dot" />
          Live — {freshnessLabel}
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)]" />
          {loading ? "Chargement..." : `Cache — ${freshnessLabel}`}
        </span>
      )}
      {source && (
        <span className="text-[var(--color-text-muted)]">
          Source&nbsp;: <span className="text-white/80 font-medium">{source}</span>
        </span>
      )}
    </div>
  );
}
