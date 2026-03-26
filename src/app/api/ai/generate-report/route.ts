// ============================================
// POST /api/ai/generate-report
// Generates AI market analysis report using Anthropic Claude
// Falls back to rule-based analysis if API key not configured
// ============================================

import { fetchMarketData, FALLBACK_MARKET_DATA } from "@/lib/coingecko";

export const maxDuration = 30;

export async function POST() {
  let market;
  try {
    market = await fetchMarketData();
  } catch {
    market = FALLBACK_MARKET_DATA;
  }

  const apiKey = process.env.AXIOM_AI_API_KEY ?? process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      return await generateWithClaude(market, apiKey);
    } catch (err) {
      console.error("AI report generation failed, using fallback:", err);
    }
  }

  // Fallback: rule-based report
  return Response.json(generateFallbackReport(market));
}

async function generateWithClaude(market: typeof FALLBACK_MARKET_DATA, apiKey: string) {
  const context = buildContext(market);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Tu es Axiom, un analyste crypto institutionnel. Tu produis des rapports d'analyse concis, précis et actionnables en français. Tu ne fais pas de prédiction garantie. Tu donnes ton analyse probabiliste basée sur les données techniques.

Voici les données marché actuelles :
${context}

Génère un rapport d'analyse structuré en JSON STRICT (pas de texte avant/après le JSON) avec ce format exact :
{
  "globalAnalysis": "3-4 phrases d'analyse globale du marché",
  "btcAnalysis": "3-4 phrases d'analyse BTC spécifique",
  "altAnalysis": "3-4 phrases d'analyse des altcoins (ETH, SOL)",
  "outlook": "1 phrase résumant la direction probable du marché",
  "riskLevel": "low" ou "medium" ou "high",
  "keyLevels": { "support": nombre, "resistance": nombre },
  "topOpportunity": "quelle crypto et pourquoi (1 phrase)",
  "topRisk": "quel risque principal (1 phrase)",
  "confidenceScore": nombre entre 0 et 100
}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");

  const report = JSON.parse(jsonMatch[0]);
  return Response.json({
    ...report,
    generatedAt: Date.now(),
    source: "ai",
  });
}

function buildContext(market: typeof FALLBACK_MARKET_DATA): string {
  return `- Bitcoin: $${market.bitcoin.price.toLocaleString()} (${market.bitcoin.change24h >= 0 ? "+" : ""}${market.bitcoin.change24h}% 24h)
- Ethereum: $${market.ethereum.price.toLocaleString()} (${market.ethereum.change24h >= 0 ? "+" : ""}${market.ethereum.change24h}% 24h)
- Market Cap Total: $${market.marketCap}T
- BTC Dominance: ${market.btcDominance}%
- Fear & Greed Index: ${market.fearGreedIndex}/100
- Top Gainer: ${market.topGainers[0]?.symbol ?? "N/A"} (${market.topGainers[0]?.change24h ?? 0}%)
- Top Loser: ${market.topLosers[0]?.symbol ?? "N/A"} (${market.topLosers[0]?.change24h ?? 0}%)
- Données: ${market.isLive ? "en direct" : "cache/fallback"}`;
}

function generateFallbackReport(market: typeof FALLBACK_MARKET_DATA) {
  const btcChange = market.bitcoin.change24h;
  const ethChange = market.ethereum.change24h;
  const fgi = market.fearGreedIndex;
  const dom = market.btcDominance;
  const btcPrice = market.bitcoin.price;

  // Global analysis
  let globalAnalysis: string;
  if (btcChange > 3) {
    globalAnalysis = `Le marché crypto affiche une dynamique fortement haussière avec Bitcoin en hausse de ${btcChange.toFixed(1)}%. La capitalisation totale atteint $${market.marketCap}T, portée par un afflux de capitaux significatif. Le Fear & Greed Index à ${fgi}/100 ${fgi > 60 ? "signale un excès d'optimisme qui appelle à la vigilance" : "reste dans une zone favorable à la poursuite du mouvement"}. Les conditions techniques soutiennent une continuation à court terme.`;
  } else if (btcChange > 0) {
    globalAnalysis = `Le marché crypto évolue en légère hausse avec Bitcoin à +${btcChange.toFixed(1)}%. La capitalisation totale se maintient à $${market.marketCap}T dans un contexte de consolidation ordonnée. Le sentiment du marché (FGI: ${fgi}) ${fgi > 50 ? "penche vers l'optimisme modéré" : "reste prudent"}. La structure de marché demeure intacte pour les positions moyennes.`;
  } else if (btcChange > -3) {
    globalAnalysis = `Le marché crypto traverse une correction mineure avec BTC à ${btcChange.toFixed(1)}%. Cette consolidation après le mouvement récent est technique et saine pour la structure du marché. Le Fear & Greed à ${fgi}/100 indique ${fgi < 40 ? "une opportunité d'accumulation pour les investisseurs patients" : "une phase d'attentisme normal"}. Les supports clés tiennent pour le moment.`;
  } else {
    globalAnalysis = `Le marché crypto subit une correction notable avec Bitcoin en baisse de ${btcChange.toFixed(1)}%. La pression vendeuse s'intensifie et la capitalisation totale recule à $${market.marketCap}T. Le Fear & Greed Index à ${fgi}/100 confirme un sentiment de ${fgi < 25 ? "panique qui historiquement marque des zones d'accumulation" : "prudence généralisée"}. Il est recommandé de réduire l'exposition et d'attendre des signaux de stabilisation.`;
  }

  // BTC analysis
  const resistance = Math.round(btcPrice * 1.05 / 1000) * 1000;
  const support = Math.round(btcPrice * 0.93 / 1000) * 1000;
  const btcAnalysis = `Bitcoin se négocie à $${btcPrice.toLocaleString()} avec une variation de ${btcChange >= 0 ? "+" : ""}${btcChange.toFixed(1)}% sur 24h. ${btcChange >= 0 ? "Le momentum haussier reste soutenu par des volumes adéquats" : "La pression baissière teste les niveaux de support importants"}. La dominance BTC à ${dom.toFixed(1)}% ${dom > 52 ? "confirme le statut de valeur refuge du Bitcoin dans ce contexte" : "suggère une diversification du capital vers les altcoins"}. Niveaux clés à surveiller : support à $${support.toLocaleString()}, résistance à $${resistance.toLocaleString()}.`;

  // Alt analysis
  const altAnalysis = `Ethereum à $${market.ethereum.price.toLocaleString()} ${ethChange >= 0 ? "surperforme" : "sous-performe"} avec ${ethChange >= 0 ? "+" : ""}${ethChange.toFixed(1)}% sur 24h. ${dom < 50 ? "L'environnement est favorable aux altcoins avec une rotation du capital visible" : "La dominance BTC élevée maintient les altcoins sous pression relative"}. ${market.topGainers[0] ? `${market.topGainers[0].symbol} mène les hausses (+${market.topGainers[0].change24h}%)` : "Les mouvements restent modérés"}. Privilégier les altcoins à forte utilité dans ce contexte.`;

  // Outlook
  const outlook = btcChange > 2
    ? "Biais haussier à court terme, objectif de continuation vers les résistances avec pullbacks limités."
    : btcChange > -2
      ? "Phase de consolidation attendue, le marché cherche une direction claire — rester neutre."
      : "Prudence requise, le marché pourrait tester des supports plus bas avant de se stabiliser.";

  const riskLevel = fgi >= 75 || fgi <= 20 || Math.abs(btcChange) > 5 ? "high" : Math.abs(btcChange) > 2 ? "medium" : "low";

  const topOpportunity = fgi <= 30
    ? "BTC en zone de peur — accumulation DCA historiquement profitable à ces niveaux de sentiment"
    : ethChange > btcChange
      ? `ETH montre de la force relative face à BTC (+${ethChange.toFixed(1)}% vs +${btcChange.toFixed(1)}%) — potentiel de rattrapage`
      : market.topGainers[0]
        ? `${market.topGainers[0].symbol} avec +${market.topGainers[0].change24h}% montre le momentum le plus fort du marché`
        : "BTC reste le choix le plus sûr dans le contexte actuel";

  const topRisk = fgi >= 75
    ? "Sentiment d'euphorie (FGI: " + fgi + ") — les corrections surviennent souvent dans ces zones"
    : Math.abs(btcChange) > 5
      ? "Volatilité excessive — risque de liquidations en cascade et de mouvements erratiques"
      : dom > 58
        ? "Dominance BTC très élevée — compression des altcoins qui pourrait s'aggraver"
        : "Incertitude macro et possibilité de black swan événements qui impacteraient tout le marché";

  const confidenceScore = Math.round(
    60 + (market.isLive ? 15 : 0) - Math.abs(btcChange) * 2 + (fgi > 30 && fgi < 70 ? 10 : -5)
  );

  return {
    globalAnalysis,
    btcAnalysis,
    altAnalysis,
    outlook,
    riskLevel,
    keyLevels: { support, resistance },
    topOpportunity,
    topRisk,
    confidenceScore: Math.max(20, Math.min(95, confidenceScore)),
    generatedAt: Date.now(),
    source: "fallback",
  };
}
