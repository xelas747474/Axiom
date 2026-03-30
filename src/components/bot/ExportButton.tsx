"use client";

import { useCallback } from "react";
import type { ClosedTrade } from "@/lib/bot/types";

// ============================================
// Export Button — CSV export for trade history
// ============================================

interface Props {
  trades: ClosedTrade[];
  filename?: string;
}

export default function ExportButton({ trades, filename = "axiom-trades" }: Props) {
  const exportCSV = useCallback(() => {
    if (trades.length === 0) return;

    const headers = ["#", "Crypto", "Direction", "Entry Price", "Exit Price", "Entry Time", "Exit Time", "Size (USDC)", "P&L ($)", "P&L (%)", "Result", "Close Reason"];
    const rows = trades.map((t) => [
      t.tradeNumber,
      t.crypto,
      t.direction,
      t.entryPrice.toFixed(2),
      t.exitPrice.toFixed(2),
      new Date(t.entryTime).toISOString(),
      new Date(t.exitTime).toISOString(),
      t.size.toFixed(2),
      t.pnl.toFixed(2),
      t.pnlPct.toFixed(2),
      t.result,
      t.closeReason,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [trades, filename]);

  return (
    <button
      onClick={exportCSV}
      disabled={trades.length === 0}
      className="flex items-center gap-1.5 rounded-lg bg-[var(--color-bg-primary)]/60 px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] transition-all hover:text-white hover:bg-[var(--color-bg-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
      title="Exporter en CSV"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      CSV
    </button>
  );
}
