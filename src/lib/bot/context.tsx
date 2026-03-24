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
  TradedCrypto,
} from "./types";
import { DEFAULT_CONFIG, DEFAULT_STATE, STRATEGIES, TRADED_CRYPTOS } from "./types";
import * as storage from "./storage";
import { runTick, closePosition, type CryptoSnapshot } from "./engine";
import { generateInitialHistory } from "./history";
import { useAuth } from "@/lib/auth";

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

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

export function BotProvider({ children }: { children: ReactNode }) {
  const { user, addToast } = useAuth();

  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<BotState>(DEFAULT_STATE);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [history, setHistory] = useState<ClosedTrade[]>([]);
  const [curve, setCurve] = useState<PortfolioPoint[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, CryptoSnapshot>>({});
  const [loaded, setLoaded] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  const configRef = useRef(config);
  const positionsRef = useRef(positions);
  const historyRef = useRef(history);
  const curveRef = useRef(curve);
  const logsRef = useRef(logs);

  stateRef.current = state;
  configRef.current = config;
  positionsRef.current = positions;
  historyRef.current = history;
  curveRef.current = curve;
  logsRef.current = logs;

  // Load from localStorage on mount
  useEffect(() => {
    const loadedConfig = storage.loadConfig();
    const loadedState = storage.loadState();
    const loadedPositions = storage.loadPositions();
    const loadedHistory = storage.loadHistory();
    const loadedCurve = storage.loadCurve();
    const loadedLogs = storage.loadLogs();

    setConfig(loadedConfig);
    setPositions(loadedPositions);
    setHistory(loadedHistory);
    setCurve(loadedCurve);
    setLogs(loadedLogs);

    // Generate initial history if first time
    if (!loadedState.initialized) {
      const initial = generateInitialHistory(loadedConfig);
      setHistory(initial.history);
      setCurve(initial.curve);
      setLogs(initial.logs);

      const initState: BotState = {
        ...DEFAULT_STATE,
        initialized: true,
        portfolioValue: initial.finalValue,
        peakValue: initial.peakValue,
      };
      setState(initState);

      storage.saveHistory(initial.history);
      storage.saveCurve(initial.curve);
      storage.saveLogs(initial.logs);
      storage.saveState(initState);
    } else {
      // Reset running state (bot doesn't run while away)
      setState({ ...loadedState, running: false });
    }

    setLoaded(true);
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    if (!loaded) return;
    storage.saveConfig(config);
  }, [config, loaded]);

  useEffect(() => {
    if (!loaded) return;
    storage.saveState(state);
  }, [state, loaded]);

  useEffect(() => {
    if (!loaded) return;
    storage.savePositions(positions);
  }, [positions, loaded]);

  useEffect(() => {
    if (!loaded) return;
    storage.saveHistory(history);
  }, [history, loaded]);

  useEffect(() => {
    if (!loaded) return;
    storage.saveCurve(curve);
  }, [curve, loaded]);

  useEffect(() => {
    if (!loaded) return;
    storage.saveLogs(logs);
  }, [logs, loaded]);

  // Trading loop
  const tick = useCallback(async () => {
    const currentState = stateRef.current;
    const currentConfig = configRef.current;
    const currentPositions = positionsRef.current;
    const currentHistory = historyRef.current;

    if (!currentState.running) return;

    try {
      const result = await runTick(
        currentConfig,
        currentState,
        currentPositions,
        currentHistory,
      );

      // Update snapshots
      setSnapshots(result.snapshots);

      // Process closed trades
      const newHistory = [...currentHistory, ...result.closedTrades];
      const newLogs = [...logsRef.current, ...result.logs].slice(-500);
      const newCurve = [...curveRef.current, { t: Date.now(), v: result.portfolioValue }];

      // Update state
      const newPeak = Math.max(currentState.peakValue, result.portfolioValue);
      const drawdown = newPeak > 0 ? ((newPeak - result.portfolioValue) / newPeak) * 100 : 0;

      // Check max drawdown
      let running: boolean = currentState.running;
      if (drawdown >= currentConfig.maxDrawdownPct) {
        running = false;
        newLogs.push({
          id: uid(),
          timestamp: Date.now(),
          type: "error",
          message: `\u26D4 Bot arr\u00eat\u00e9 \u2014 Max drawdown atteint (${drawdown.toFixed(1)}% >= ${currentConfig.maxDrawdownPct}%)`,
        });
        addToast?.(`Bot arr\u00eat\u00e9 \u2014 Max drawdown atteint`, "error");
      }

      // Update lastTradeTime for closed trades
      const lastTradeTime = { ...currentState.lastTradeTime };
      for (const trade of result.closedTrades) {
        lastTradeTime[trade.crypto] = Date.now();
      }

      // Calculate today's stats
      const todayStart = new Date().setHours(0, 0, 0, 0);
      const todayTrades = newHistory.filter((t) => t.exitTime >= todayStart);
      const todayPnl = todayTrades.reduce((s, t) => s + t.pnl, 0);

      // Toasts for events
      for (const trade of result.closedTrades) {
        const label = TRADED_CRYPTOS.find((c) => c.symbol === trade.crypto)?.label ?? trade.crypto;
        if (trade.result === "win") {
          addToast?.(`\u{1F4B0} ${label} +$${trade.pnl.toFixed(2)} (+${trade.pnlPct.toFixed(2)}%)`, "success");
        } else {
          addToast?.(`\u{1F4C9} ${label} -$${Math.abs(trade.pnl).toFixed(2)} (${trade.pnlPct.toFixed(2)}%)`, "error");
        }
      }

      // Check new portfolio record
      if (result.portfolioValue > currentState.peakValue && result.portfolioValue > currentConfig.initialCapital * 1.01) {
        addToast?.(`\u{1F3C6} Nouveau record ! Portfolio \u00e0 $${result.portfolioValue.toFixed(2)}`, "success");
      }

      // Toast for new positions
      for (const log of result.logs) {
        if (log.type === "open") {
          addToast?.(log.message.replace(/\u2705\s*/, ""), "info");
        }
      }

      setState((prev) => ({
        ...prev,
        running,
        portfolioValue: result.portfolioValue,
        peakValue: newPeak,
        currentDrawdown: drawdown,
        lastTradeTime,
        todayTradeCount: todayTrades.length,
        todayPnl,
      }));

      setPositions(result.positions);
      setHistory(newHistory);
      setCurve(newCurve);
      setLogs(newLogs);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Erreur inconnue";
      setLogs((prev) => [
        ...prev,
        { id: uid(), timestamp: Date.now(), type: "error" as const, message: `\u274C Erreur: ${errMsg}` },
      ].slice(-500));
    }
  }, [addToast]);

  // Start/stop interval
  useEffect(() => {
    if (state.running && user) {
      // Run immediately on start
      tick();
      intervalRef.current = setInterval(tick, 30000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.running, user, tick]);

  const updateConfig = useCallback((updates: Partial<BotConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      // If initial capital changed, update state too
      if (updates.initialCapital !== undefined && updates.initialCapital !== prev.initialCapital) {
        setState((s) => ({
          ...s,
          portfolioValue: updates.initialCapital!,
          peakValue: updates.initialCapital!,
        }));
      }
      return next;
    });
  }, []);

  const toggleBot = useCallback(() => {
    setState((prev) => {
      const willRun = !prev.running;
      const newState = {
        ...prev,
        running: willRun,
        startedAt: willRun ? Date.now() : prev.startedAt,
      };

      const logMsg = willRun
        ? "\u{1F7E2} Bot d\u00e9marr\u00e9 \u2014 Strat\u00e9gie: " + STRATEGIES[configRef.current.strategy].label
        : "\u{1F534} Bot arr\u00eat\u00e9 manuellement";

      setLogs((prev) => [
        ...prev,
        { id: uid(), timestamp: Date.now(), type: "info" as const, message: logMsg },
      ].slice(-500));

      if (willRun) {
        addToast?.("Bot d\u00e9marr\u00e9", "success");
      } else {
        addToast?.("Bot arr\u00eat\u00e9", "info");
      }

      return newState;
    });
  }, [addToast]);

  const closePositionManually = useCallback((positionId: string) => {
    const pos = positionsRef.current.find((p) => p.id === positionId);
    if (!pos) return;

    const tradeNumber = historyRef.current.length + 1;
    const trade = closePosition(pos, pos.currentPrice, "manual", tradeNumber);

    setHistory((prev) => [...prev, trade]);
    setPositions((prev) => prev.filter((p) => p.id !== positionId));

    const label = TRADED_CRYPTOS.find((c) => c.symbol === trade.crypto)?.label ?? trade.crypto;
    setLogs((prev) => [
      ...prev,
      {
        id: uid(),
        timestamp: Date.now(),
        type: "close" as const,
        message: `\u{1F91A} CLOSE ${pos.direction} ${label} @ $${trade.exitPrice.toFixed(2)} \u2014 P&L: ${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)} \u2014 Ferm\u00e9 manuellement`,
      },
    ].slice(-500));

    // Update portfolio value
    setState((prev) => ({
      ...prev,
      portfolioValue: prev.portfolioValue + trade.pnl,
    }));

    const pnlStr = trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)}` : `-$${Math.abs(trade.pnl).toFixed(2)}`;
    addToast?.(`${label} ferm\u00e9 \u2014 ${pnlStr}`, trade.pnl >= 0 ? "success" : "error");
  }, [addToast]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurve([{ t: Date.now(), v: stateRef.current.portfolioValue }]);
    setLogs([]);
    setState((prev) => ({ ...prev, todayPnl: 0, todayTradeCount: 0 }));
  }, []);

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
