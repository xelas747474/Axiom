"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { OHLCV, AISignalResult } from "@/lib/indicators/types";
import { bollingerBands, sma } from "@/lib/indicators";

interface TradingChartProps {
  candles: OHLCV[];
  signal?: AISignalResult;
  height?: number;
}

export default function TradingChart({ candles, signal, height = 500 }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);
  const [ready, setReady] = useState(false);

  const initChart = useCallback(async () => {
    if (!containerRef.current || candles.length === 0) return;

    const lc = await import("lightweight-charts");

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = lc.createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
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

    chartRef.current = chart;

    // === Candlestick series ===
    const candleSeries = chart.addSeries(lc.CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const candleData = candles.map((c) => ({
      time: c.time as import("lightweight-charts").UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);

    // === Volume series ===
    const volumeSeries = chart.addSeries(lc.HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const volumeData = candles.map((c) => ({
      time: c.time as import("lightweight-charts").UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
    }));
    volumeSeries.setData(volumeData);

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

    const bbUpperData = candles
      .map((c, i) => ({ time: c.time as import("lightweight-charts").UTCTimestamp, value: bb.upper[i] }))
      .filter((d) => !isNaN(d.value));
    const bbLowerData = candles
      .map((c, i) => ({ time: c.time as import("lightweight-charts").UTCTimestamp, value: bb.lower[i] }))
      .filter((d) => !isNaN(d.value));

    bbUpperSeries.setData(bbUpperData);
    bbLowerSeries.setData(bbLowerData);

    // === SMA 50 ===
    const sma50 = sma(closes, 50);
    const sma50Series = chart.addSeries(lc.LineSeries, {
      color: "rgba(245, 158, 11, 0.7)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const sma50Data = candles
      .map((c, i) => ({ time: c.time as import("lightweight-charts").UTCTimestamp, value: sma50[i] }))
      .filter((d) => !isNaN(d.value));
    sma50Series.setData(sma50Data);

    // === SMA 200 ===
    if (closes.length >= 200) {
      const sma200 = sma(closes, 200);
      const sma200Series = chart.addSeries(lc.LineSeries, {
        color: "rgba(59, 130, 246, 0.7)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const sma200Data = candles
        .map((c, i) => ({ time: c.time as import("lightweight-charts").UTCTimestamp, value: sma200[i] }))
        .filter((d) => !isNaN(d.value));
      sma200Series.setData(sma200Data);
    }

    // === Buy/Sell signal markers ===
    if (signal && (signal.signal === "STRONG_BUY" || signal.signal === "STRONG_SELL")) {
      const lastCandle = candles[candles.length - 1];
      const isBuy = signal.signal === "STRONG_BUY";

      const markers = lc.createSeriesMarkers(candleSeries, [{
        time: lastCandle.time as import("lightweight-charts").UTCTimestamp,
        position: isBuy ? "belowBar" : "aboveBar",
        color: isBuy ? "#22c55e" : "#ef4444",
        shape: isBuy ? "arrowUp" : "arrowDown",
        text: isBuy ? "STRONG BUY" : "STRONG SELL",
      }]);
      // Keep reference to avoid GC
      void markers;
    }

    // === Support/Resistance lines ===
    if (signal) {
      const addPriceLine = (price: number, color: string, title: string) => {
        candleSeries.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: lc.LineStyle.Dashed,
          axisLabelVisible: true,
          title,
        });
      };

      if (signal.stopLoss > 0) addPriceLine(signal.stopLoss, "#ef4444", "SL");
      if (signal.takeProfit > 0) addPriceLine(signal.takeProfit, "#22c55e", "TP");
    }

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(containerRef.current);

    setReady(true);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [candles, signal, height]);

  useEffect(() => {
    const cleanup = initChart();
    return () => { cleanup?.then((fn) => fn?.()); };
  }, [initChart]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden" style={{ minHeight: height }} />
      {!ready && candles.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent-blue)]/30 border-t-[var(--color-accent-blue)]" />
        </div>
      )}
    </div>
  );
}
