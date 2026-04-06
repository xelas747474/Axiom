/**
 * Shared market dashboard data fetcher.
 * Used by /api/market route AND SSR pre-fetch in dashboard page.
 */
import { fetchMarketData, FALLBACK_MARKET_DATA, type MarketDataResult } from "@/lib/coingecko";
import { alerts as mockAlerts, quickInsights as mockInsights } from "@/data/mock";

export async function getDashboardData() {
  let market: MarketDataResult;
  try {
    market = await fetchMarketData();
  } catch {
    market = FALLBACK_MARKET_DATA;
  }

  return {
    ...market,
    aiSummary: generateAISummary(market),
    alerts: generateAlerts(market),
    quickInsights: generateInsights(market),
  };
}

function generateAISummary(data: MarketDataResult): string {
  const btcTrend = data.bitcoin.change24h >= 0 ? "haussière" : "baissière";
  const ethTrend = data.ethereum.change24h >= 0 ? "haussière" : "baissière";
  const fgi = data.fearGreedIndex;

  let sentiment: string;
  if (fgi <= 25) sentiment = "La peur extrême domine le marché, ce qui peut représenter une opportunité d'achat contrariante.";
  else if (fgi <= 45) sentiment = "Le sentiment de peur indique une prudence généralisée des investisseurs.";
  else if (fgi <= 55) sentiment = "Le marché est dans une phase neutre, en attente de catalyseurs directionnels.";
  else if (fgi <= 75) sentiment = "Un sentiment de cupidité modérée règne, typique d'un marché optimiste mais rationnel.";
  else sentiment = "La cupidité extrême suggère un risque de correction. La prudence est de mise.";

  const topGainer = data.topGainers[0];
  const topLoser = data.topLosers[0];

  let dominanceAnalysis: string;
  if (data.btcDominance > 55) dominanceAnalysis = "La dominance BTC élevée indique un flight-to-quality — les altcoins sont sous pression.";
  else if (data.btcDominance > 45) dominanceAnalysis = "La dominance BTC stable suggère un équilibre entre Bitcoin et altcoins.";
  else dominanceAnalysis = "La faible dominance BTC ouvre la porte à une alt season potentielle.";

  return `Bitcoin évolue en tendance ${btcTrend} à $${data.bitcoin.price.toLocaleString()} (${data.bitcoin.change24h >= 0 ? "+" : ""}${data.bitcoin.change24h}%). ` +
    `Ethereum suit une dynamique ${ethTrend} à $${data.ethereum.price.toLocaleString()} (${data.ethereum.change24h >= 0 ? "+" : ""}${data.ethereum.change24h}%). ` +
    `Capitalisation totale : $${data.marketCap}T. BTC Dominance : ${data.btcDominance}%. ` +
    `${dominanceAnalysis} ${sentiment} ` +
    `Fear & Greed Index : ${fgi}/100. ` +
    (topGainer ? `Top performer : ${topGainer.symbol} (+${topGainer.change24h}%). ` : "") +
    (topLoser ? `Plus forte baisse : ${topLoser.symbol} (${topLoser.change24h}%).` : "");
}

function generateAlerts(data: MarketDataResult) {
  type Alert = { id: string; type: "volatility" | "breakout" | "risk"; title: string; description: string; timestamp: string; severity: "low" | "medium" | "high" };
  const alerts: Alert[] = [];
  const btcAbs = Math.abs(data.bitcoin.change24h);
  const ethAbs = Math.abs(data.ethereum.change24h);

  if (btcAbs > 5) {
    alerts.push({ id: "live-1", type: "volatility", title: "Forte volatilité BTC", description: `Bitcoin a varié de ${data.bitcoin.change24h >= 0 ? "+" : ""}${data.bitcoin.change24h}% en 24h.`, timestamp: "Maintenant", severity: "high" });
  } else if (btcAbs > 2) {
    alerts.push({ id: "live-1", type: "volatility", title: `BTC ${data.bitcoin.change24h >= 0 ? "en hausse" : "en baisse"}`, description: `Bitcoin à $${data.bitcoin.price.toLocaleString()} (${data.bitcoin.change24h >= 0 ? "+" : ""}${data.bitcoin.change24h}%).`, timestamp: "Maintenant", severity: "medium" });
  } else {
    alerts.push({ id: "live-1", type: "volatility", title: "BTC en consolidation", description: `Bitcoin stable à $${data.bitcoin.price.toLocaleString()} (${data.bitcoin.change24h >= 0 ? "+" : ""}${data.bitcoin.change24h}%).`, timestamp: "Maintenant", severity: "low" });
  }

  if (ethAbs > 3) {
    alerts.push({ id: "live-2", type: "volatility", title: `Mouvement ${ethAbs > 5 ? "important" : "notable"} ETH`, description: `Ethereum à $${data.ethereum.price.toLocaleString()} (${data.ethereum.change24h >= 0 ? "+" : ""}${data.ethereum.change24h}%).`, timestamp: "Maintenant", severity: ethAbs > 5 ? "high" : "medium" });
  }

  const fgi = data.fearGreedIndex;
  if (fgi <= 25) alerts.push({ id: "live-3", type: "risk", title: "Peur extrême sur le marché", description: `FGI à ${fgi}/100. Zone d'opportunité historique.`, timestamp: "Maintenant", severity: "high" });
  else if (fgi <= 40) alerts.push({ id: "live-3", type: "risk", title: "Sentiment de peur", description: `FGI à ${fgi}/100. Marché prudent.`, timestamp: "Maintenant", severity: "medium" });
  else if (fgi >= 75) alerts.push({ id: "live-3", type: "risk", title: "Cupidité extrême", description: `FGI à ${fgi}/100. Risque de correction.`, timestamp: "Maintenant", severity: "high" });
  else if (fgi >= 60) alerts.push({ id: "live-3", type: "risk", title: "Marché optimiste", description: `FGI à ${fgi}/100. Cupidité modérée.`, timestamp: "Maintenant", severity: "low" });
  else alerts.push({ id: "live-3", type: "risk", title: "Marché neutre", description: `FGI à ${fgi}/100. En attente de direction.`, timestamp: "Maintenant", severity: "low" });

  const topGainer = data.topGainers[0];
  if (topGainer) alerts.push({ id: "live-5", type: "breakout", title: `${topGainer.change24h > 8 ? "Pump" : "Hausse"} ${topGainer.symbol}`, description: `${topGainer.name} +${topGainer.change24h}% à $${topGainer.price.toLocaleString()}.`, timestamp: "Maintenant", severity: topGainer.change24h > 15 ? "high" : topGainer.change24h > 8 ? "medium" : "low" });

  const topLoser = data.topLosers[0];
  if (topLoser) alerts.push({ id: "live-6", type: "risk", title: `${topLoser.change24h < -8 ? "Chute" : "Baisse"} ${topLoser.symbol}`, description: `${topLoser.name} ${topLoser.change24h}% à $${topLoser.price < 0.01 ? topLoser.price.toFixed(8) : topLoser.price.toLocaleString()}.`, timestamp: "Maintenant", severity: topLoser.change24h < -10 ? "high" : topLoser.change24h < -5 ? "medium" : "low" });

  if (data.btcDominance > 58) alerts.push({ id: "live-7", type: "risk", title: "Dominance BTC très élevée", description: `${data.btcDominance}%. Altcoins sous pression.`, timestamp: "Maintenant", severity: "high" });
  else if (data.btcDominance > 52) alerts.push({ id: "live-7", type: "breakout", title: "Dominance BTC en hausse", description: `${data.btcDominance}%. Capital concentré sur BTC.`, timestamp: "Maintenant", severity: "low" });
  else alerts.push({ id: "live-7", type: "breakout", title: "Alt season potentielle", description: `BTC dominance faible à ${data.btcDominance}%.`, timestamp: "Maintenant", severity: "medium" });

  if (alerts.length < 3) return [...alerts, ...mockAlerts.slice(0, 3 - alerts.length)];
  return alerts;
}

function generateInsights(data: MarketDataResult) {
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
    { title: "Market Sentiment", value: `${fgi}/100`, description: sentimentDesc, status: sentimentStatus },
    { title: "Pump Alert", value: topGainer ? `${topGainer.symbol} +${topGainer.change24h}%` : mockInsights[1].value, description: topGainer ? `${topGainer.name} top performer 24h` : mockInsights[1].description, status: (topGainer && topGainer.change24h > 5 ? "positive" : "neutral") as "positive" | "negative" | "neutral" },
    { title: "Trend Direction", value: btcTrend ? "Haussier" : "Baissier", description: `BTC ${data.bitcoin.change24h >= 0 ? "+" : ""}${data.bitcoin.change24h}% sur 24h`, status: (btcTrend ? "positive" : "negative") as "positive" | "negative" | "neutral" },
    { title: "Risk Level", value: fgi >= 75 ? "Élevé" : fgi >= 45 ? "Modéré" : "Faible", description: fgi >= 75 ? "Cupidité extrême — réduisez l'exposition" : fgi >= 45 ? "Conditions normales" : "Peur — possible zone d'achat", status: (fgi >= 75 ? "negative" : fgi >= 45 ? "neutral" : "positive") as "positive" | "negative" | "neutral" },
  ];
}
