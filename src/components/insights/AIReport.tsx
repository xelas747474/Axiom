"use client";

import { useState, useEffect, useCallback } from "react";

interface AIReportData {
  globalAnalysis: string;
  btcAnalysis: string;
  altAnalysis: string;
  outlook: string;
  riskLevel: "low" | "medium" | "high";
  keyLevels: { support: number; resistance: number };
  topOpportunity: string;
  topRisk: string;
  confidenceScore: number;
  generatedAt: number;
  source: "ai" | "fallback";
}

const RISK_COLORS = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" };
const RISK_LABELS = { low: "Faible", medium: "Modéré", high: "Élevé" };

const LOADING_STEPS = [
  "Récupération des données de marché...",
  "Analyse des indicateurs techniques...",
  "Évaluation du sentiment...",
  "Rédaction du rapport...",
];

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return "il y a plus de 24h";
}

function ConfidenceGauge({ score, animated }: { score: number; animated: boolean }) {
  const width = 200;
  const height = 8;
  const fillWidth = animated ? (score / 100) * width : 0;
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500">Confiance IA</span>
      <div className="relative" style={{ width, height }}>
        <div className="absolute inset-0 rounded-full bg-white/5" />
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: fillWidth,
            backgroundColor: color,
            transition: "width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
            boxShadow: `0 0 10px ${color}40`,
          }}
        />
      </div>
      <span className="text-sm font-bold font-mono" style={{ color, textShadow: `0 0 8px ${color}30` }}>
        {animated ? score : 0}%
      </span>
    </div>
  );
}

function TypedText({ text, delay = 0, speed = 8 }: { text: string; delay?: number; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [started, text, speed]);

  return <>{displayed}{displayed.length < text.length && started ? <span className="animate-pulse">▌</span> : ""}</>;
}

export default function AIReport() {
  const [report, setReport] = useState<AIReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [animated, setAnimated] = useState(false);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setLoadingStep(0);
    setShowReport(false);
    setAnimated(false);

    // Progress steps
    const stepInterval = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 1500);

    try {
      const res = await fetch("/api/ai/generate-report", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        setShowReport(true);
        setTimeout(() => setAnimated(true), 100);
      }
    } catch (err) {
      console.error("Failed to generate report:", err);
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  }, []);

  return (
    <div>
      {/* Generate button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
          {report && (
            <span className="text-xs text-gray-500">
              Dernière analyse : {timeAgo(report.generatedAt)}
              {report.source === "fallback" && " (analyse locale)"}
            </span>
          )}
        </div>
        <button
          onClick={generateReport}
          disabled={loading}
          className="group relative overflow-hidden rounded-xl px-6 py-3 font-semibold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            boxShadow: loading ? "none" : "0 0 25px rgba(59,130,246,0.3), 0 0 50px rgba(139,92,246,0.15)",
          }}
        >
          {/* Animated glow */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
            }}
          />
          <span className="relative flex items-center gap-2">
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Axiom Intelligence analyse...
              </>
            ) : (
              <>✦ {report ? "Régénérer l'analyse IA" : "Générer l'analyse IA"}</>
            )}
          </span>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 mb-6">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-purple-500/30 animate-spin" />
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <span className="text-lg">🧠</span>
              </div>
            </div>
            <div className="text-center space-y-2">
              {LOADING_STEPS.map((step, i) => (
                <div
                  key={i}
                  className="text-sm transition-all duration-300"
                  style={{
                    color: i === loadingStep ? "#ffffff" : i < loadingStep ? "#22c55e" : "rgba(255,255,255,0.2)",
                    transform: i === loadingStep ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {i < loadingStep ? "✓ " : i === loadingStep ? "⟳ " : "○ "}
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Report display */}
      {showReport && report && !loading && (
        <div className="space-y-4">
          {/* Global Analysis */}
          <div
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-6"
            style={{
              opacity: animated ? 1 : 0,
              transform: animated ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.5s ease",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🌍</span>
              <h3 className="text-lg font-bold text-white">Analyse Globale</h3>
            </div>
            <p className="text-sm leading-relaxed text-gray-300">
              <TypedText text={report.globalAnalysis} delay={200} />
            </p>
          </div>

          {/* BTC + Alt Analysis side by side */}
          <div className="grid gap-4 md:grid-cols-2">
            <div
              className="rounded-2xl border border-white/5 bg-white/[0.02] p-5"
              style={{
                opacity: animated ? 1 : 0,
                transform: animated ? "translateY(0)" : "translateY(20px)",
                transition: "all 0.5s ease 200ms",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span>₿</span>
                <h3 className="font-bold text-white">Bitcoin</h3>
              </div>
              <p className="text-sm leading-relaxed text-gray-300">
                <TypedText text={report.btcAnalysis} delay={800} />
              </p>
              <div className="flex gap-4 mt-3 pt-3 border-t border-white/5">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase">Support</span>
                  <div className="text-xs font-mono text-red-400">${report.keyLevels.support.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase">Résistance</span>
                  <div className="text-xs font-mono text-green-400">${report.keyLevels.resistance.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl border border-white/5 bg-white/[0.02] p-5"
              style={{
                opacity: animated ? 1 : 0,
                transform: animated ? "translateY(0)" : "translateY(20px)",
                transition: "all 0.5s ease 400ms",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span>💎</span>
                <h3 className="font-bold text-white">Altcoins</h3>
              </div>
              <p className="text-sm leading-relaxed text-gray-300">
                <TypedText text={report.altAnalysis} delay={1400} />
              </p>
            </div>
          </div>

          {/* Outlook + Meta */}
          <div
            className="rounded-2xl border border-blue-500/10 bg-blue-500/[0.03] p-5"
            style={{
              opacity: animated ? 1 : 0,
              transform: animated ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.5s ease 600ms",
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="text-xs text-blue-400 uppercase font-semibold mb-1">Outlook</div>
                <p className="text-sm font-semibold text-white">
                  <TypedText text={report.outlook} delay={2000} />
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">Risque</div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK_COLORS[report.riskLevel] }} />
                    <span className="text-xs font-bold" style={{ color: RISK_COLORS[report.riskLevel] }}>
                      {RISK_LABELS[report.riskLevel]}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/5">
              <div>
                <div className="text-[10px] text-green-400 uppercase font-semibold">Opportunité</div>
                <p className="text-xs text-gray-300 mt-0.5">{report.topOpportunity}</p>
              </div>
              <div>
                <div className="text-[10px] text-red-400 uppercase font-semibold">Risque principal</div>
                <p className="text-xs text-gray-300 mt-0.5">{report.topRisk}</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5">
              <ConfidenceGauge score={report.confidenceScore} animated={animated} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
