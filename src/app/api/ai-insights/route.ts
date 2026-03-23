import { fetchMarketData, FALLBACK_MARKET_DATA } from "@/lib/coingecko";
import { generateAIInsights, type AIInsightsResult } from "@/lib/ai-analysis";

export const revalidate = 120; // ISR: cache for 2 minutes

// Static fallback — guaranteed to never throw
const STATIC_FALLBACK: AIInsightsResult = {
  global: {
    title: "Analyse Globale du Marché",
    content:
      "Le marché crypto montre des signes de maturité avec une capitalisation totale de $2.47T. La phase actuelle de consolidation est caractéristique d'une accumulation institutionnelle. Un sentiment de cupidité modérée (FGI: 62) indique un optimisme mesuré. La dominance BTC stable à 54.2% suggère un équilibre entre BTC et altcoins. Recommandation : maintenir une exposition modérée.",
    signals: [
      { label: "Tendance", value: "Haussière modérée", status: "positive" },
      { label: "Volume", value: "Normal", status: "neutral" },
      { label: "Fear & Greed", value: "62/100", status: "positive" },
      { label: "Risque", value: "Modéré", status: "neutral" },
    ],
  },
  bitcoin: {
    title: "Analyse Bitcoin",
    content:
      "Bitcoin maintient une tendance haussière modérée, les acheteurs gardent le contrôle. Le prix actuel de $67,843 se situe au-dessus de la moyenne mobile court terme. La dominance BTC à 54.2% renforce la position de Bitcoin comme valeur refuge du marché crypto. Prochain objectif technique : $71,000, support majeur : $63,000.",
    signals: [
      { label: "Prix", value: "$67,843", status: "positive" },
      { label: "Résistance", value: "$71,000", status: "neutral" },
      { label: "Support", value: "$63,000", status: "positive" },
      { label: "RSI estimé", value: "57 (neutre)", status: "neutral" },
    ],
  },
  altcoins: {
    title: "Analyse Altcoins",
    content:
      "Le marché altcoin est mixte, avec des performances disparates selon les secteurs. Solana (SOL) mène les hausses avec +8.56%. Dogecoin (DOGE) est le plus touché avec -5.67%. Les altcoins à forte utilité et revenus de protocole sont à privilégier dans ce contexte de dominance BTC élevée.",
    signals: [
      { label: "ETH/BTC", value: "En baisse", status: "negative" },
      { label: "Secteur fort", value: "Layer 1", status: "positive" },
      { label: "Secteur faible", value: "Memecoins", status: "negative" },
      { label: "Opportunité", value: "BTC + DeFi", status: "positive" },
    ],
  },
};

export async function GET() {
  // Step 1: Get market data (live or fallback)
  let market;
  try {
    market = await fetchMarketData();
  } catch {
    market = FALLBACK_MARKET_DATA;
  }

  // Step 2: Generate AI insights (rule-based or external)
  try {
    const insights = await generateAIInsights(market);
    return Response.json(insights);
  } catch {
    // Step 3: If even rule-based fails, use static fallback
    return Response.json(STATIC_FALLBACK);
  }
}
