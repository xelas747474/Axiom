"use client";

import { useEffect, useRef, useState } from "react";
import type { OHLCV, AISignalResult } from "@/lib/indicators/types";
import { bollingerBands, sma } from "@/lib/indicators";

interface TradingChartProps {
  candles: OHLCV[];
  signal?: AISignalResult;
  height?: number;
}

export default function TradingChart({ candles, signal, height = 500 }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<{ remove: () => void } | null>(null);
  const [rendered, setRendered] = useState(false);
  const mountedRef = useRef(true);

  // Track mount status
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Main chart effect — runs when candles or signal change
  useEffect(() => {
    // Skip if no data or no container
    if (!containerRef.current || candles.length === 0) return;

    setRendered(false);

    // Destroy any previous chart instance synchronously first
    if (chartInstanceRef.current) {
      try { chartInstanceRef.current.remove(); } catch { /* already removed */ }
      chartInstanceRef.current = null;
    }

    // Clear any leftover DOM from previous chart
    const container = containerRef.current;
    container.innerHTML = "";

    let cancelled = false;

    async function createChart() {
      const lc = await import("lightweight-charts");

      // Check if this effect was cleaned up during the async import
      if (cancelled || !mountedRef.current || !container) return;

      const chart = lc.createChart(container, {
        width: container.clientWidth,
        height,
        layout: {
          background: { color: "transparent" },
          textColor: "#64748b",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(42, 48, 80, 0.3)" },
          horzLines: { color: "rgba(42, 48, 80, 0.3)" },
        },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: { color: "rgba(59, 130, 246, 0.4)", width: 1, style: lc.LineStyle.Dashed, labelBackgroundColor: "#1a1f35" },
          horzLine: { color: "rgba(59, 130, 246, 0.4)", width: 1, style: lc.LineStyle.Dashed, labelBackgroundColor: "#1a1f35" },
        },
        rightPriceScale: {
          borderColor: "rgba(42, 48, 80, 0.5)",
          scaleMargins: { top: 0.1, bottom: 0.25 },
        },
        timeScale: {
          borderColor: "rgba(42, 48, 80, 0.5)",
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { mouseWheel: true, pinch: true },
      });

      // Double check we haven't been cancelled during chart creation
      if (cancelled) {
        chart.remove();
        return;
      }

      chartInstanceRef.current = chart;

      // === Candlestick series ===
      const candleSeries = chart.addSeries(lc.CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      candleSeries.setData(
        candles.map((c) => ({
          time: c.time as import("lightweight-charts").UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );

      // === Volume series ===
      const volumeSeries = chart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      volumeSeries.setData(
        candles.map((c) => ({
          time: c.time as import("lightweight-charts").UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
        }))
      );

      // === Bollinger Bands ===
      const closes = candles.map((c) => c.close);
      const bb = bollingerBands(closes);

      const bbUpperSeries = chart.addSeries(lc.LineSeries, {
        color: "rgba(139, 92, 246, 0.4)",
        lineWidth: 1,
        lineStyle: lc.LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const bbLowerSeries = chart.addSeries(lc.LineSeries, {
        color: "rgba(139, 92, 246, 0.4)",
        lineWidth: 1,
        lineStyle: lc.LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      bbUpperSeries.setData(
        candles
          .map((c, i) => ({ time: c.time as import("lightweight-charts").UTCTimestamp, value: bb.upper[i] }))
          .filter((d) => !isNaN(d.value))
      );
      bbLowerSeries.setData(
        candles
          .map((c, i) => ({ time: c.time as import("lightweight-charts").UTCTimestamp, value: bb.lower[i] }))
          .filter((d) => !isNaN(d.value))
      );

      // === SMA 50 ===
      const sma50 = sma(closes, 50);
      const sma50Series = chart.addSeries(lc.LineSeries, {
        color: "rgba(245, 158, 11, 0.7)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sma50Series.setData(
        candles
          .map((c, i) => ({ time: c.time as import("lightweight-charts").UTCTimestamp, value: sma50[i] }))
          .filter((d) => !isNaN(d.value))
      );

      // === SMA 200 ===
      if (closes.length >= 200) {
        const sma200 = sma(closes, 200);
        const sma200Series = chart.addSeries(lc.LineSeries, {
          color: "rgba(59, 130, 246, 0.7)",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        sma200Series.setData(
          candles
            .map((c, i) => ({ time: c.time as import("lightweight-charts").UTCTimestamp, value: sma200[i] }))
            .filter((d) => !isNaN(d.value))
        );
      }

      // === Buy/Sell signal markers ===
      if (signal && (signal.signal === "STRONG_BUY" || signal.signal === "STRONG_SELL")) {
        const lastCandle = candles[candles.length - 1];
        const isBuy = signal.signal === "STRONG_BUY";

        lc.createSeriesMarkers(candleSeries, [{
          time: lastCandle.time as import("lightweight-charts").UTCTimestamp,
          position: isBuy ? "belowBar" : "aboveBar",
          color: isBuy ? "#22c55e" : "#ef4444",
          shape: isBuy ? "arrowUp" : "arrowDown",
          text: isBuy ? "STRONG BUY" : "STRONG SELL",
        }]);
      }

      // === Support/Resistance lines ===
      if (signal) {
        if (signal.stopLoss > 0) {
          candleSeries.createPriceLine({
            price: signal.stopLoss,
            color: "#ef4444",
            lineWidth: 1,
            lineStyle: lc.LineStyle.Dashed,
            axisLabelVisible: true,
            title: "SL",
          });
        }
        if (signal.takeProfit > 0) {
          candleSeries.createPriceLine({
            price: signal.takeProfit,
            color: "#22c55e",
            lineWidth: 1,
            lineStyle: lc.LineStyle.Dashed,
            axisLabelVisible: true,
            title: "TP",
          });
        }
      }

      // Fit content
      chart.timeScale().fitContent();

      // Handle resize
      const resizeObserver = new ResizeObserver((entries) => {
        if (!cancelled && chartInstanceRef.current === chart) {
          for (const entry of entries) {
            chart.applyOptions({ width: entry.contentRect.width });
          }
        }
      });
      resizeObserver.observe(container);

      if (!cancelled && mountedRef.current) {
        setRendered(true);
      }

      // Return cleanup for this specific chart
      return () => {
        resizeObserver.disconnect();
      };
    }

    let resizeCleanup: (() => void) | undefined;
    createChart().then((cleanup) => { resizeCleanup = cleanup; });

    // Cleanup function — runs before next effect or on unmount
    return () => {
      cancelled = true;
      resizeCleanup?.();
      if (chartInstanceRef.current) {
        try { chartInstanceRef.current.remove(); } catch { /* ok */ }
        chartInstanceRef.current = null;
      }
    };
  }, [candles, signal, height]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ minHeight: height }}
      />
      {!rendered && candles.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-card)]/80">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent-blue)]/30 border-t-[var(--color-accent-blue)]" />
            <span className="text-[10px] text-[var(--color-text-muted)]">Rendu du graphique...</span>
          </div>
        </div>
      )}
    </div>
  );
}
