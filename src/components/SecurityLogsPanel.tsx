"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth";

interface SecurityEvent {
  type: string;
  userId?: string;
  email?: string;
  ip?: string;
  details: string;
  timestamp: string;
}

const TYPE_STYLES: Record<string, string> = {
  login: "text-[var(--color-positive)] bg-[var(--color-positive)]/10",
  signup: "text-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]/10",
  login_failed: "text-[var(--color-warning)] bg-[var(--color-warning)]/10",
  unauthorized: "text-[var(--color-negative)] bg-[var(--color-negative)]/10",
  rate_limited: "text-[var(--color-warning)] bg-[var(--color-warning)]/10",
  api_key_save: "text-[var(--color-accent-purple)] bg-[var(--color-accent-purple)]/10",
  api_key_access: "text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/10",
  real_trade: "text-[var(--color-negative)] bg-[var(--color-negative)]/15",
  suspicious: "text-[var(--color-negative)] bg-[var(--color-negative)]/10",
  admin_action: "text-[var(--color-accent-purple)] bg-[var(--color-accent-purple)]/10",
};

export default function SecurityLogsPanel() {
  const [logs, setLogs] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/security-logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="mt-8 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <span>🛡️</span> Journal de sécurité
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-[var(--color-accent-blue)] hover:text-[var(--color-accent-blue)]/80 disabled:opacity-50"
        >
          {loading ? "Chargement..." : "Rafraîchir"}
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">
          {loading ? "Chargement..." : "Aucun événement"}
        </div>
      ) : (
        <div className="max-h-[520px] overflow-y-auto divide-y divide-[var(--color-border-subtle)]">
          {logs.map((log, i) => (
            <div key={i} className="px-4 py-2.5 text-xs hover:bg-white/[0.02]">
              <div className="flex items-start gap-3">
                <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] ${TYPE_STYLES[log.type] ?? "text-[var(--color-text-muted)] bg-white/5"}`}>
                  {log.type}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-white truncate">{log.details}</div>
                  <div className="text-[var(--color-text-muted)] mt-0.5">
                    {new Date(log.timestamp).toLocaleString("fr-FR")}
                    {log.email && <> · {log.email}</>}
                    {log.ip && log.ip !== "unknown" && <> · {log.ip}</>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
