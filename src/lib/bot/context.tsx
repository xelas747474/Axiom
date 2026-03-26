"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type {
  BotConfig,
  BotState,
  OpenPosition,
  ClosedTrade,
  PortfolioPoint,
  LogEntry,
} from "./types";
import { DEFAULT_CONFIG, DEFAULT_STATE, STRATEGIES, TRADED_CRYPTOS } from "./types";
import type { CryptoSnapshot } from "./engine";
import { useAuth, apiFetch } from "@/lib/auth";

interface BotContextType {
  config: BotConfig;
  state: BotState;
  positions: OpenPosition[];
  history: ClosedTrade[];
  curve: PortfolioPoint[];
  logs: LogEntry[];
  snapshots: Record<string, CryptoSnapshot>;
  isRunning: boolean;

  updateConfig: (updates: Partial<BotConfig>) => void;
  toggleBot: () => void;
  closePositionManually: (positionId: string) => void;
  clearHistory: () => void;
}

const BotContext = createContext<BotContextType | null>(null);

// Polling interval for bot data refresh (10 seconds)
const POLL_INTERVAL = 10_000;

export function BotProvider({ children }: { children: ReactNode }) {
  const { user, addToast } = useAuth();

  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<BotState>(DEFAULT_STATE);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [history, setHistory] = useState<ClosedTrade[]>([]);
  const [curve, setCurve] = useState<PortfolioPoint[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [snapshots] = useState<Record<string, CryptoSnapshot>>({});
  const [loaded, setLoaded] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevHistoryLenRef = useRef(0);

  // Fetch all bot data from API
  const fetchBotData = useCallback(async (showToasts = false) => {
    if (!user) return;

    try {
      const [statusRes, historyRes, portfolioRes, logsRes] = await Promise.all([
        apiFetch("/api/bot/status"),
        apiFetch("/api/bot/history"),
        apiFetch("/api/bot/portfolio"),
        apiFetch("/api/bot/logs"),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setConfig(data.config ?? DEFAULT_CONFIG);
        setState(data.state ?? DEFAULT_STATE);
        setPositions(data.positions ?? []);
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        const newHistory = data.history ?? [];
        setHistory(newHistory);

        // Toast for new trades
        if (showToasts && newHistory.length > prevHistoryLenRef.current && prevHistoryLenRef.current > 0) {
          const newTrades = newHistory.slice(prevHistoryLenRef.current);
          for (const trade of newTrades) {
            const label = TRADED_CRYPTOS.find((c) => c.symbol === trade.crypto)?.label ?? trade.crypto;
            if (trade.result === "win") {
              addToast?.(`${label} +$${trade.pnl.toFixed(2)} (+${trade.pnlPct.toFixed(2)}%)`, "success");
            } else {
              addToast?.(`${label} -$${Math.abs(trade.pnl).toFixed(2)} (${trade.pnlPct.toFixed(2)}%)`, "error");
            }
          }
        }
        prevHistoryLenRef.current = newHistory.length;
      }

      if (portfolioRes.ok) {
        const data = await portfolioRes.json();
        setCurve(data.curve ?? []);
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs ?? []);
      }

      setLoaded(true);
    } catch {
      // Network error — ignore, will retry
    }
  }, [user, addToast]);

  // Initial load
  useEffect(() => {
    if (user) {
      fetchBotData(false);
    } else {
      setLoaded(true);
    }
  }, [user, fetchBotData]);

  // Poll for updates when bot is running
  useEffect(() => {
    if (state.running && user) {
      pollRef.current = setInterval(() => fetchBotData(true), POLL_INTERVAL);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [state.running, user, fetchBotData]);

  const updateConfig = useCallback(async (updates: Partial<BotConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      // Persist to server
      apiFetch("/api/bot/config", {
        method: "PUT",
        body: JSON.stringify(next),
      }).catch(() => {});
      return next;
    });
  }, []);

  const toggleBot = useCallback(async () => {
    try {
      const res = await apiFetch("/api/bot/toggle", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        addToast?.(data.error || "Erreur", "error");
        return;
      }

      const data = await res.json();
      setState(data.state);

      if (data.running) {
        addToast?.("Bot démarré", "success");
        // Refresh all data (initial history may have been generated)
        setTimeout(() => fetchBotData(false), 500);
      } else {
        addToast?.("Bot arrêté", "info");
      }

      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2) + Date.now().toString(36),
          timestamp: Date.now(),
          type: "info" as const,
          message: data.running
            ? `Bot démarré — Stratégie: ${STRATEGIES[config.strategy].label}`
            : "Bot arrêté manuellement",
        },
      ]);
    } catch {
      addToast?.("Erreur réseau", "error");
    }
  }, [addToast, fetchBotData, config.strategy]);

  const closePositionManually = useCallback(async (positionId: string) => {
    try {
      const res = await apiFetch("/api/bot/close-position", {
        method: "POST",
        body: JSON.stringify({ positionId }),
      });

      if (!res.ok) {
        const data = await res.json();
        addToast?.(data.error || "Erreur", "error");
        return;
      }

      const data = await res.json();
      const trade = data.trade;
      setState(data.state);

      // Remove from local positions
      setPositions((prev) => prev.filter((p) => p.id !== positionId));

      // Add to history
      setHistory((prev) => [...prev, trade]);

      const label = TRADED_CRYPTOS.find((c) => c.symbol === trade.crypto)?.label ?? trade.crypto;
      const pnlStr = trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)}` : `-$${Math.abs(trade.pnl).toFixed(2)}`;
      addToast?.(`${label} fermé — ${pnlStr}`, trade.pnl >= 0 ? "success" : "error");
    } catch {
      addToast?.("Erreur réseau", "error");
    }
  }, [addToast]);

  const clearHistory = useCallback(() => {
    // Note: clearing history would need a server endpoint
    // For now, just clear locally
    setHistory([]);
    setCurve([]);
    setLogs([]);
  }, []);

  if (!loaded) {
    return <>{children}</>;
  }

  return (
    <BotContext.Provider
      value={{
        config,
        state,
        positions,
        history,
        curve,
        logs,
        snapshots,
        isRunning: state.running,
        updateConfig,
        toggleBot,
        closePositionManually,
        clearHistory,
      }}
    >
      {children}
    </BotContext.Provider>
  );
}

export function useBot() {
  const ctx = useContext(BotContext);
  if (!ctx) throw new Error("useBot must be used within BotProvider");
  return ctx;
}
