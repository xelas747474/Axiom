import { fetchMarketData } from "@/lib/coingecko";
import { generateAIInsights } from "@/lib/ai-analysis";

export const revalidate = 120; // Revalidate every 2 minutes

export async function GET() {
  try {
    const market = await fetchMarketData();
    const insights = await generateAIInsights(market);
    return Response.json(insights);
  } catch {
    // Fallback static analysis
    return Response.json({
      global: {
        title: "Analyse Globale du Marché",
        content:
          "Données de marché temporairement indisponibles. L'analyse sera mise à jour automatiquement dès que la connexion sera rétablie.",
        signals: [
          { label: "Tendance", value: "En attente", status: "neutral" },
          { label: "Volume", value: "N/A", status: "neutral" },
          { label: "Fear & Greed", value: "N/A", status: "neutral" },
          { label: "Risque", value: "Indéterminé", status: "neutral" },
        ],
      },
      bitcoin: {
        title: "Analyse Bitcoin",
        content: "Données en cours de chargement...",
        signals: [
          { label: "Prix", value: "N/A", status: "neutral" },
          { label: "Résistance", value: "N/A", status: "neutral" },
          { label: "Support", value: "N/A", status: "neutral" },
          { label: "RSI", value: "N/A", status: "neutral" },
        ],
      },
      altcoins: {
        title: "Analyse Altcoins",
        content: "Données en cours de chargement...",
        signals: [
          { label: "ETH/BTC", value: "N/A", status: "neutral" },
          { label: "Secteur fort", value: "N/A", status: "neutral" },
          { label: "Secteur faible", value: "N/A", status: "neutral" },
          { label: "Opportunité", value: "N/A", status: "neutral" },
        ],
      },
    });
  }
}
