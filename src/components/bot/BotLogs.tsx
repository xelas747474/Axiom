"use client";

import { useRef, useEffect, useState } from "react";
import { useBot } from "@/lib/bot/context";

const TYPE_COLORS: Record<string, string> = {
  scan: "#64748b",
  open: "#3b82f6",
  close: "#f59e0b",
  update: "#8b5cf6",
  info: "#cbd5e1",
  warning: "#f59e0b",
  error: "#ef4444",
};

const TYPE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  scan: { label: "SCAN", bg: "rgba(100,116,139,0.15)", text: "#64748b" },
  open: { label: "OPEN", bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
  close: { label: "CLOSE", bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  update: { label: "UPD", bg: "rgba(139,92,246,0.15)", text: "#8b5cf6" },
  info: { label: "INFO", bg: "rgba(203,213,225,0.1)", text: "#94a3b8" },
  warning: { label: "WARN", bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  error: { label: "ERR", bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
};

function getLogColor(msg: string, type: string): string {
  if (msg.includes("+$") || msg.includes("Take Profit") || msg.includes("OPEN LONG")) return "#22c55e";
  if (msg.includes("-$") || msg.includes("Stop Loss") || msg.includes("arrêté")) return "#ef4444";
  return TYPE_COLORS[type] || "#64748b";
}

export default function BotLogs() {
  const { logs } = useBot();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [prevCount, setPrevCount] = useState(0);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, paused]);

  useEffect(() => {
    setPrevCount(logs.length);
  }, [logs.length]);

  const displayLogs = logs.slice(-200);
  const newLogCount = logs.length - prevCount;

  function copyLogs() {
    const text = displayLogs
      .map((l) => {
        const d = new Date(l.timestamp);
        const ts = `[${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}]`;
        return `${ts} [${l.type.toUpperCase()}] ${l.message}`;
      })
      .join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="text-base">💻</span> Activity Log
          {!paused && logs.length > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] font-normal text-[var(--color-text-muted)]">
              <span className="live-dot" />
              Live
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono tabular-nums">
            {displayLogs.length} lignes
          </span>
          <button
            onClick={() => setPaused(!paused)}
            className="rounded-lg border border-[var(--color-border-subtle)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-text-muted)] transition-all"
          >
            {paused ? "▶ Play" : "⏸ Pause"}
          </button>
          <button
            onClick={copyLogs}
            className="rounded-lg border border-[var(--color-border-subtle)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-text-muted)] transition-all"
          >
            📋 Copier
          </button>
        </div>
      </div>
      <div className="relative rounded-xl border border-[var(--color-border-subtle)] overflow-hidden">
        {/* Fade gradient at top */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#0a0a0a] to-transparent z-10 pointer-events-none rounded-t-xl" />
        <div
          ref={scrollRef}
          className="h-[260px] overflow-y-auto bg-[#0a0a0a] p-3 pt-8 font-mono text-[11px] leading-[1.8] scrollbar-thin"
        >
          {displayLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <span className="text-2xl opacity-30">📡</span>
              <p className="text-[var(--color-text-muted)] text-center text-xs">
                En attente de logs... Démarrez le bot.
              </p>
            </div>
          ) : (
            displayLogs.map((log, idx) => {
              const d = new Date(log.timestamp);
              const ts = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
              const color = getLogColor(log.message, log.type);
              const badge = TYPE_BADGES[log.type] || TYPE_BADGES.info;
              const isNew = idx >= displayLogs.length - newLogCount;

              return (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 px-1 rounded transition-colors hover:bg-white/[0.02] ${
                    isNew ? "animate-fade-in" : ""
                  }`}
                  style={{ color }}
                >
                  <span className="text-[var(--color-text-muted)]/60 shrink-0 select-none">{ts}</span>
                  <span
                    className="shrink-0 rounded px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider select-none"
                    style={{ background: badge.bg, color: badge.text }}
                  >
                    {badge.label}
                  </span>
                  <span className="break-all">{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
