import { fetchMarketData } from "@/lib/coingecko";
import {
  alerts as mockAlerts,
  quickInsights as mockInsights,
  aiMarketSummary as mockSummary,
} from "@/data/mock";

export const revalidate = 60; // ISR: revalidate every 60s

export async function GET() {
  try {
    const market = await fetchMarketData();

    // Generate dynamic AI summary based on real data
    const summary = generateAISummary(market);

    // Generate dynamic alerts based on real data
    const dynamicAlerts = generateAlerts(market);

    // Generate dynamic insights
    const insights = generateInsights(market);

    return Response.json({
      ...market,
      aiSummary: summary,
      alerts: dynamicAlerts.length > 0 ? dynamicAlerts : mockAlerts,
      quickInsights: insights,
    });
  } catch {
    // Fallback to mock data if CoinGecko is unreachable
    return Response.json({
      bitcoin: { price: 67842.5, change24h: 2.34 },
      ethereum: { price: 3521.18, change24h: -0.87 },
      marketCap: 2.47,
      btcDominance: 54.2,
      fearGreedIndex: 62,
      topGainers: [],
      topLosers: [],
      chartData: {},
      aiSummary: mockSummary,
      alerts: mockAlerts,
      quickInsights: mockInsights,
    });
  }
}

function generateAISummary(data: Awaited<ReturnType<typeof fetchMarketData>>): string {
  const btcTrend = data.bitcoin.change24h >= 0 ? "haussière" : "baissière";
  const ethTrend = data.ethereum.change24h >= 0 ? "haussière" : "baissière";
  const fgi = data.fearGreedIndex;

  let sentiment: string;
  if (fgi <= 25) sentiment = "La peur extrême domine le marché, ce qui peut représenter une opportunité d'achat contrariante.";
  else if (fgi <= 45) sentiment = "Le sentiment de peur indique une prudence généralisée des investisseurs.";
  else if (fgi <= 55) sentiment = "Le marché est dans une phase neutre, en attente de catalyseurs.";
  else if (fgi <= 75) sentiment = "Un sentiment de cupidité modérée règne, ce qui est typique d'un marché optimiste mais encore rationnel.";
  else sentiment = "La cupidité extrême suggère un risque de correction. La prudence est de mise.";

  const topGainer = data.topGainers[0];
  const topLoser = data.topLosers[0];

  return `Bitcoin évolue en tendance ${btcTrend} à $${data.bitcoin.price.toLocaleString()} (${data.bitcoin.change24h >= 0 ? "+" : ""}${data.bitcoin.change24h}%). ` +
    `Ethereum suit une dynamique ${ethTrend} à $${data.ethereum.price.toLocaleString()}. ` +
    `La capitalisation totale du marché est de $${data.marketCap}T avec une dominance BTC à ${data.btcDominance}%. ` +
    `${sentiment} ` +
    `Fear & Greed Index : ${fgi}/100. ` +
    (topGainer ? `Top performer : ${topGainer.symbol} (+${topGainer.change24h}%). ` : "") +
    (topLoser ? `Plus forte baisse : ${topLoser.symbol} (${topLoser.change24h}%).` : "");
}

function generateAlerts(data: Awaited<ReturnType<typeof fetchMarketData>>) {
  const alerts: Array<{
    id: string;
    type: "volatility" | "breakout" | "risk";
    title: string;
    description: string;
    timestamp: string;
    severity: "low" | "medium" | "high";
  }> = [];

  // BTC volatility alert
  if (Math.abs(data.bitcoin.change24h) > 5) {
    alerts.push({
      id: "live-1",
      type: "volatility",
      title: "Forte volatilité BTC",
      description: `Bitcoin a varié de ${data.bitcoin.change24h >= 0 ? "+" : ""}${data.bitcoin.change24h}% en 24h.`,
      timestamp: "Maintenant",
      severity: Math.abs(data.bitcoin.change24h) > 10 ? "high" : "medium",
    });
  }

  // ETH volatility
  if (Math.abs(data.ethereum.change24h) > 5) {
    alerts.push({
      id: "live-2",
      type: "volatility",
      title: "Mouvement important ETH",
      description: `Ethereum à $${data.ethereum.price.toLocaleString()} (${data.ethereum.change24h >= 0 ? "+" : ""}${data.ethereum.change24h}%).`,
      timestamp: "Maintenant",
      severity: "medium",
    });
  }

  // Fear & Greed extremes
  if (data.fearGreedIndex <= 20) {
    alerts.push({
      id: "live-3",
      type: "risk",
      title: "Peur extrême sur le marché",
      description: `Le Fear & Greed Index est à ${data.fearGreedIndex}/100. Zone de peur extrême.`,
      timestamp: "Maintenant",
      severity: "high",
    });
  } else if (data.fearGreedIndex >= 80) {
    alerts.push({
      id: "live-4",
      type: "risk",
      title: "Cupidité extrême",
      description: `Fear & Greed Index à ${data.fearGreedIndex}/100. Risque de correction élevé.`,
      timestamp: "Maintenant",
      severity: "high",
    });
  }

  // Top movers alerts
  const topGainer = data.topGainers[0];
  if (topGainer && topGainer.change24h > 10) {
    alerts.push({
      id: "live-5",
      type: "breakout",
      title: `Pump ${topGainer.symbol}`,
      description: `${topGainer.name} en hausse de +${topGainer.change24h}% à $${topGainer.price.toLocaleString()}.`,
      timestamp: "Maintenant",
      severity: topGainer.change24h > 20 ? "high" : "medium",
    });
  }

  const topLoser = data.topLosers[0];
  if (topLoser && topLoser.change24h < -10) {
    alerts.push({
      id: "live-6",
      type: "risk",
      title: `Chute ${topLoser.symbol}`,
      description: `${topLoser.name} en baisse de ${topLoser.change24h}% à $${topLoser.price.toLocaleString()}.`,
      timestamp: "Maintenant",
      severity: "high",
    });
  }

  // BTC dominance shift
  if (data.btcDominance > 60) {
    alerts.push({
      id: "live-7",
      type: "risk",
      title: "Dominance BTC élevée",
      description: `BTC dominance à ${data.btcDominance}%. Les altcoins sont sous pression.`,
      timestamp: "Maintenant",
      severity: "medium",
    });
  }

  return alerts;
}

function generateInsights(data: Awaited<ReturnType<typeof fetchMarketData>>) {
  const fgi = data.fearGreedIndex;
  const topGainer = data.topGainers[0];

  let sentimentStatus: "positive" | "negative" | "neutral" = "neutral";
  if (fgi >= 55) sentimentStatus = "positive";
  else if (fgi <= 40) sentimentStatus = "negative";

  let sentimentDesc: string;
  if (fgi <= 25) sentimentDesc = "Peur extrême — possible opportunité";
  else if (fgi <= 45) sentimentDesc = "Prudence sur le marché";
  else if (fgi <= 55) sentimentDesc = "Marché neutre — en attente";
  else if (fgi <= 75) sentimentDesc = "Optimisme modéré";
  else sentimentDesc = "Euphorie — prudence requise";

  const btcTrend = data.bitcoin.change24h >= 0;

  return [
    {
      title: "Market Sentiment",
      value: `${fgi}/100`,
      description: sentimentDesc,
      status: sentimentStatus,
    },
    {
      title: "Pump Alert",
      value: topGainer ? `${topGainer.symbol} +${topGainer.change24h}%` : "N/A",
      description: topGainer ? `${topGainer.name} top performer 24h` : "Pas de données",
      status: (topGainer && topGainer.change24h > 5 ? "positive" : "neutral") as "positive" | "negative" | "neutral",
    },
    {
      title: "Trend Direction",
      value: btcTrend ? "Haussier" : "Baissier",
      description: `BTC ${data.bitcoin.change24h >= 0 ? "+" : ""}${data.bitcoin.change24h}% sur 24h`,
      status: (btcTrend ? "positive" : "negative") as "positive" | "negative" | "neutral",
    },
    {
      title: "Risk Level",
      value: fgi >= 75 ? "Élevé" : fgi >= 45 ? "Modéré" : "Faible",
      description:
        fgi >= 75
          ? "Cupidité extrême — réduisez l'exposition"
          : fgi >= 45
            ? "Conditions normales"
            : "Peur — possible zone d'achat",
      status: (fgi >= 75 ? "negative" : fgi >= 45 ? "neutral" : "positive") as "positive" | "negative" | "neutral",
    },
  ];
}
