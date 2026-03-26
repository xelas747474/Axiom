"use client";

import { useState, useEffect } from "react";

interface HeatmapCoin {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change1h: number;
  volume: number;
  marketCap: number;
}

interface TimelineEvent {
  id: string;
  type: "bullish" | "bearish" | "info" | "warning";
  icon: string;
  title: string;
  description: string;
  timestamp: number;
}

const TYPE_COLORS: Record<string, string> = {
  bullish: "#22c55e",
  bearish: "#ef4444",
  info: "#3b82f6",
  warning: "#f97316",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  return `Hier`;
}

function generateEvents(
  coins: HeatmapCoin[],
  fearGreedIndex: number,
  btcDominance: number,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = Date.now();

  // Price movement events
  for (const coin of coins) {
    if (Math.abs(coin.change24h) >= 3) {
      const isUp = coin.change24h > 0;
      events.push({
        id: `price-${coin.symbol}`,
        type: isUp ? "bullish" : "bearish",
        icon: isUp ? "🚀" : "📉",
        title: `${coin.symbol} ${isUp ? "en hausse" : "en baisse"} de ${coin.change24h >= 0 ? "+" : ""}${coin.change24h.toFixed(1)}%`,
        description: `Prix actuel : $${coin.price >= 1 ? coin.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : coin.price.toFixed(4)}`,
        timestamp: now - Math.floor(Math.random() * 3600000),
      });
    }

    // RSI estimation from price changes
    const estimatedRSI = Math.min(85, Math.max(15, 50 + coin.change24h * 3));
    if (estimatedRSI > 70) {
      events.push({
        id: `rsi-overbought-${coin.symbol}`,
        type: "warning",
        icon: "⚠️",
        title: `${coin.symbol} en zone de surachat`,
        description: `RSI estimé : ${Math.round(estimatedRSI)} — Risque de correction`,
        timestamp: now - Math.floor(Math.random() * 7200000),
      });
    } else if (estimatedRSI < 30) {
      events.push({
        id: `rsi-oversold-${coin.symbol}`,
        type: "bullish",
        icon: "🔻",
        title: `${coin.symbol} en zone de survente`,
        description: `RSI estimé : ${Math.round(estimatedRSI)} — Opportunité potentielle`,
        timestamp: now - Math.floor(Math.random() * 7200000),
      });
    }

    // Volume anomaly
    if (coin.volume > coin.marketCap * 0.15) {
      const mult = (coin.volume / (coin.marketCap * 0.05)).toFixed(1);
      events.push({
        id: `volume-${coin.symbol}`,
        type: "info",
        icon: "📈",
        title: `Volume ${coin.symbol} x${mult} vs moyenne`,
        description: `Volume 24h : $${(coin.volume / 1e9).toFixed(1)}B — Activité inhabituelle`,
        timestamp: now - Math.floor(Math.random() * 5400000),
      });
    }

    // Strong 1h move
    if (Math.abs(coin.change1h) >= 1.5) {
      events.push({
        id: `1h-${coin.symbol}`,
        type: coin.change1h > 0 ? "bullish" : "bearish",
        icon: coin.change1h > 0 ? "⚡" : "💥",
        title: `${coin.symbol} ${coin.change1h > 0 ? "+" : ""}${coin.change1h.toFixed(1)}% en 1h`,
        description: `Mouvement rapide — Volatilité accrue`,
        timestamp: now - Math.floor(Math.random() * 1800000),
      });
    }
  }

  // Fear & Greed events
  if (fearGreedIndex <= 20) {
    events.push({
      id: "fng-extreme-fear",
      type: "warning",
      icon: "😱",
      title: `Fear & Greed en Extreme Fear (${fearGreedIndex})`,
      description: "Panique sur le marché — Historiquement une zone d'opportunité",
      timestamp: now - Math.floor(Math.random() * 10800000),
    });
  } else if (fearGreedIndex >= 80) {
    events.push({
      id: "fng-extreme-greed",
      type: "warning",
      icon: "🤑",
      title: `Fear & Greed en Extreme Greed (${fearGreedIndex})`,
      description: "Euphorie maximale — Prudence recommandée",
      timestamp: now - Math.floor(Math.random() * 10800000),
    });
  } else if (fearGreedIndex <= 40) {
    events.push({
      id: "fng-fear",
      type: "info",
      icon: "😰",
      title: `Fear & Greed : Fear (${fearGreedIndex})`,
      description: "Le marché est prudent — Surveiller les supports",
      timestamp: now - Math.floor(Math.random() * 14400000),
    });
  } else if (fearGreedIndex >= 60) {
    events.push({
      id: "fng-greed",
      type: "info",
      icon: "😀",
      title: `Fear & Greed : Greed (${fearGreedIndex})`,
      description: "Optimisme élevé sur le marché",
      timestamp: now - Math.floor(Math.random() * 14400000),
    });
  }

  // BTC Dominance events
  if (btcDominance > 55) {
    events.push({
      id: "btc-dom-high",
      type: "info",
      icon: "📊",
      title: `BTC Dominance élevée à ${btcDominance.toFixed(1)}%`,
      description: "Flight-to-quality — Altcoins sous pression",
      timestamp: now - Math.floor(Math.random() * 18000000),
    });
  } else if (btcDominance < 45) {
    events.push({
      id: "btc-dom-low",
      type: "bullish",
      icon: "📊",
      title: `BTC Dominance faible à ${btcDominance.toFixed(1)}%`,
      description: "Rotation vers les altcoins — Alt season potentielle",
      timestamp: now - Math.floor(Math.random() * 18000000),
    });
  }

  // Sort by timestamp descending (most recent first) and limit to 15
  return events
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 15);
}

export default function EventsTimeline({
  coins,
  fearGreedIndex,
  btcDominance,
}: {
  coins: HeatmapCoin[];
  fearGreedIndex: number;
  btcDominance: number;
}) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, []);

  const events = generateEvents(coins, fearGreedIndex, btcDominance);

  if (events.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-bold text-white mb-4">{"Fil d'Activité — Événements Marché"}</h2>
        <p className="text-sm text-gray-500">Aucun événement notable pour le moment.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4">{"Fil d'Activité — Événements Marché"}</h2>
      <div className="relative pl-8">
        {/* Vertical line */}
        <div
          className="absolute left-3 top-0 w-0.5 rounded-full bg-gradient-to-b from-blue-500/40 via-blue-500/20 to-transparent"
          style={{
            height: animated ? "100%" : "0%",
            transition: "height 1.5s ease",
          }}
        />

        <div className="space-y-3">
          {events.map((event, i) => (
            <div
              key={event.id}
              className="relative flex gap-3"
              style={{
                opacity: animated ? 1 : 0,
                transform: animated ? "translateX(0)" : "translateX(-20px)",
                transition: `opacity 0.4s ease ${i * 80}ms, transform 0.4s ease ${i * 80}ms`,
              }}
            >
              {/* Dot */}
              <div
                className="absolute -left-5 top-2.5 h-3 w-3 rounded-full border-2"
                style={{
                  borderColor: TYPE_COLORS[event.type],
                  backgroundColor: `${TYPE_COLORS[event.type]}30`,
                  boxShadow: `0 0 8px ${TYPE_COLORS[event.type]}40`,
                }}
              />

              {/* Card */}
              <div className="flex-1 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition-all duration-200 hover:bg-white/[0.04] hover:border-white/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{event.icon}</span>
                    <span className="text-sm font-semibold text-white">{event.title}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 whitespace-nowrap shrink-0">
                    {timeAgo(event.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">{event.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
