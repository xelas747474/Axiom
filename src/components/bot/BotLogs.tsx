"use client";

import { useRef, useEffect, useState } from "react";
import { useBot } from "@/lib/bot/context";

const TYPE_COLORS: Record<string, string> = {
  scan: "#94a3b8",
  open: "#3b82f6",
  close: "#f59e0b",
  update: "#8b5cf6",
  info: "#e2e8f0",
  warning: "#f59e0b",
  error: "#ef4444",
};

function getLogColor(msg: string, type: string): string {
  if (msg.includes("+$") || msg.includes("Take Profit") || msg.includes("OPEN LONG")) return "#22c55e";
  if (msg.includes("-$") || msg.includes("Stop Loss") || msg.includes("arrêté")) return "#ef4444";
  return TYPE_COLORS[type] || "#94a3b8";
}

export default function BotLogs() {
  const { logs } = useBot();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, paused]);

  const displayLogs = logs.slice(-200);

  function copyLogs() {
    const text = displayLogs
      .map((l) => {
        const d = new Date(l.timestamp);
        const ts = `[${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}]`;
        return `${ts} ${l.message}`;
      })
      .join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="text-base">💻</span> Activity Log
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused(!paused)}
            className="rounded-lg border border-[var(--color-border-subtle)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-muted)] hover:text-white transition-all"
          >
            {paused ? "▶ Play" : "⏸ Pause"}
          </button>
          <button
            onClick={copyLogs}
            className="rounded-lg border border-[var(--color-border-subtle)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-muted)] hover:text-white transition-all"
          >
            📋 Copier
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="h-[240px] overflow-y-auto rounded-xl border border-[var(--color-border-subtle)] bg-[#0a0c14] p-3 font-mono text-[11px] leading-relaxed"
      >
        {displayLogs.length === 0 ? (
          <p className="text-[var(--color-text-muted)] text-center py-8">
            En attente de logs... Démarrez le bot.
          </p>
        ) : (
          displayLogs.map((log) => {
            const d = new Date(log.timestamp);
            const ts = `[${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}]`;
            const color = getLogColor(log.message, log.type);

            return (
              <div key={log.id} className="animate-fade-in" style={{ color }}>
                <span className="text-[var(--color-text-muted)] mr-2">{ts}</span>
                {log.message}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
