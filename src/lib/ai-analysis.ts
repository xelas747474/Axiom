// ============================================
// AI Analysis Engine
// Generates intelligent market insights from data
// Ready for OpenAI/Claude integration via AXIOM_AI_API_KEY env
// ============================================

import { type MarketDataResult } from "./coingecko";

interface Signal {
  label: string;
  value: string;
  status: "positive" | "negative" | "neutral";
}

interface AnalysisSection {
  title: string;
  content: string;
  signals: Signal[];
}

export interface AIInsightsResult {
  global: AnalysisSection;
  bitcoin: AnalysisSection;
  altcoins: AnalysisSection;
}

// ============================================
// If AXIOM_AI_API_KEY is set, use external AI
// Otherwise, use rule-based analysis engine
// ============================================

export async function generateAIInsights(
  market: MarketDataResult
): Promise<AIInsightsResult> {
  const apiKey = process.env.AXIOM_AI_API_KEY;
  const aiProvider = process.env.AXIOM_AI_PROVIDER ?? "anthropic"; // "anthropic" | "openai"

  if (apiKey) {
    try {
      return await fetchExternalAI(market, apiKey, aiProvider);
    } catch {
      // Fallback to rule-based engine
    }
  }

  return generateRuleBasedInsights(market);
}

// ============================================
// External AI (Claude or OpenAI)
// ============================================

async function fetchExternalAI(
  market: MarketDataResult,
  apiKey: string,
  provider: string
): Promise<AIInsightsResult> {
  const prompt = buildPrompt(market);

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Tu es un analyste crypto expert. Réponds en JSON strict avec le format demandé. Sois concis et orienté décision.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }

  // Default: Anthropic Claude
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
          content: `Tu es un analyste crypto expert. Réponds UNIQUEMENT en JSON strict avec le format demandé. Sois concis et orienté décision.\n\n${prompt}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
  const data = await res.json();
  const text = data.content[0].text;
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");
  return JSON.parse(jsonMatch[0]);
}

function buildPrompt(market: MarketDataResult): string {
  return `Analyse ces données de marché crypto et génère un rapport structuré.

DONNÉES:
- Bitcoin: $${market.bitcoin.price.toLocaleString()} (${market.bitcoin.change24h >= 0 ? "+" : ""}${market.bitcoin.change24h}%)
- Ethereum: $${market.ethereum.price.toLocaleString()} (${market.ethereum.change24h >= 0 ? "+" : ""}${market.ethereum.change24h}%)
- Market Cap: $${market.marketCap}T
- BTC Dominance: ${market.btcDominance}%
- Fear & Greed: ${market.fearGreedIndex}/100
- Top Gainer: ${market.topGainers[0]?.symbol ?? "N/A"} (${market.topGainers[0]?.change24h ?? 0}%)
- Top Loser: ${market.topLosers[0]?.symbol ?? "N/A"} (${market.topLosers[0]?.change24h ?? 0}%)

FORMAT JSON REQUIS (remplis chaque champ, status = "positive"|"negative"|"neutral"):
{
  "global": {
    "title": "Analyse Globale du Marché",
    "content": "...(3-4 phrases d'analyse globale)...",
    "signals": [
      {"label": "Tendance", "value": "...", "status": "..."},
      {"label": "Volume", "value": "...", "status": "..."},
      {"label": "Flux institutionnel", "value": "...", "status": "..."},
      {"label": "Risque macro", "value": "...", "status": "..."}
    ]
  },
  "bitcoin": {
    "title": "Analyse Bitcoin",
    "content": "...(3-4 phrases sur BTC)...",
    "signals": [
      {"label": "Prix", "value": "...", "status": "..."},
      {"label": "Résistance", "value": "...", "status": "..."},
      {"label": "Support", "value": "...", "status": "..."},
      {"label": "RSI", "value": "...", "status": "..."}
    ]
  },
  "altcoins": {
    "title": "Analyse Altcoins",
    "content": "...(3-4 phrases sur les altcoins)...",
    "signals": [
      {"label": "ETH/BTC", "value": "...", "status": "..."},
      {"label": "Secteur fort", "value": "...", "status": "..."},
      {"label": "Secteur faible", "value": "...", "status": "..."},
      {"label": "Opportunité", "value": "...", "status": "..."}
    ]
  }
}`;
}

// ============================================
// Rule-Based Analysis Engine (no API needed)
// ============================================

function generateRuleBasedInsights(
  market: MarketDataResult
): AIInsightsResult {
  const btcChange = market.bitcoin.change24h;
  const ethChange = market.ethereum.change24h;
  const fgi = market.fearGreedIndex;
  const dom = market.btcDominance;
  const cap = market.marketCap;

  // ---- Global analysis ----
  let globalTrend: string;
  let globalTrendStatus: Signal["status"];
  if (btcChange > 3) {
    globalTrend = "Le marché est en forte hausse";
    globalTrendStatus = "positive";
  } else if (btcChange > 0) {
    globalTrend = "Le marché évolue en légère hausse";
    globalTrendStatus = "positive";
  } else if (btcChange > -3) {
    globalTrend = "Le marché est en légère correction";
    globalTrendStatus = "neutral";
  } else {
    globalTrend = "Le marché subit une correction significative";
    globalTrendStatus = "negative";
  }

  let fgiAnalysis: string;
  if (fgi <= 25) fgiAnalysis = "La peur extrême domine (FGI: " + fgi + "), historiquement une zone d'opportunité pour les investisseurs contrariants.";
  else if (fgi <= 45) fgiAnalysis = "Le sentiment de prudence (FGI: " + fgi + ") reflète une certaine incertitude du marché.";
  else if (fgi <= 55) fgiAnalysis = "Le marché est neutre (FGI: " + fgi + "), en attente de catalyseurs directionnels.";
  else if (fgi <= 75) fgiAnalysis = "La cupidité modérée (FGI: " + fgi + ") indique un optimisme mesuré.";
  else fgiAnalysis = "La cupidité extrême (FGI: " + fgi + ") est historiquement un signal de correction à venir.";

  let domAnalysis: string;
  if (dom > 55) domAnalysis = "La dominance BTC élevée à " + dom + "% indique un flight-to-quality, les altcoins sont sous pression.";
  else if (dom > 45) domAnalysis = "La dominance BTC stable à " + dom + "% suggère un équilibre entre BTC et altcoins.";
  else domAnalysis = "La dominance BTC faible à " + dom + "% indique une rotation vers les altcoins — alt season potentielle.";

  const globalContent = `${globalTrend} avec une capitalisation totale de $${cap}T. ${fgiAnalysis} ${domAnalysis} Recommandation : ${fgi >= 75 ? "prudence maximale, allégez les positions." : fgi <= 25 ? "zone d'opportunité, DCA recommandé." : "maintenir une exposition modérée."}`;

  // ---- BTC analysis ----
  const btcPrice = market.bitcoin.price;
  const resistance = Math.round(btcPrice * 1.05 / 1000) * 1000;
  const support = Math.round(btcPrice * 0.93 / 1000) * 1000;

  let btcTrendText: string;
  if (btcChange > 5) btcTrendText = "Bitcoin est en forte progression, soutenu par un momentum acheteur puissant.";
  else if (btcChange > 0) btcTrendText = "Bitcoin maintient une tendance haussière modérée, les acheteurs gardent le contrôle.";
  else if (btcChange > -5) btcTrendText = "Bitcoin est en légère correction, mais la structure reste intacte au-dessus des supports clés.";
  else btcTrendText = "Bitcoin subit une correction importante, le marché teste des niveaux de support critiques.";

  // Estimate RSI from price change (simplified)
  const estimatedRSI = Math.min(85, Math.max(15, 50 + btcChange * 3));
  let rsiText: string;
  let rsiStatus: Signal["status"];
  if (estimatedRSI > 70) { rsiText = `${Math.round(estimatedRSI)} (suracheté)`; rsiStatus = "negative"; }
  else if (estimatedRSI < 30) { rsiText = `${Math.round(estimatedRSI)} (survendu)`; rsiStatus = "positive"; }
  else { rsiText = `${Math.round(estimatedRSI)} (neutre)`; rsiStatus = "neutral"; }

  const btcContent = `${btcTrendText} Le prix actuel de $${btcPrice.toLocaleString()} se situe ${btcChange >= 0 ? "au-dessus" : "en dessous"} de la moyenne mobile court terme. La dominance BTC à ${dom}% ${dom > 50 ? "renforce la position de Bitcoin comme valeur refuge du marché crypto" : "suggère que le capital se diversifie vers les altcoins"}. Prochain objectif technique : $${resistance.toLocaleString()}, support majeur : $${support.toLocaleString()}.`;

  // ---- Altcoins analysis ----
  const ethBtcTrend = ethChange > btcChange;
  const topGainer = market.topGainers[0];
  const topLoser = market.topLosers[0];

  let altTrend: string;
  if (ethBtcTrend && dom < 50) altTrend = "Les altcoins surperforment Bitcoin, signe d'une rotation du capital favorable aux altcoins.";
  else if (ethBtcTrend) altTrend = "Ethereum montre de la force relative face à Bitcoin, mais la dominance BTC reste élevée.";
  else if (dom > 55) altTrend = "Les altcoins sous-performent avec une dominance BTC élevée. Prudence sur les positions altcoin.";
  else altTrend = "Le marché altcoin est mixte, avec des performances disparates selon les secteurs.";

  const gainerText = topGainer ? `${topGainer.name} (${topGainer.symbol}) mène les hausses avec +${topGainer.change24h}%.` : "";
  const loserText = topLoser ? `${topLoser.name} (${topLoser.symbol}) est le plus touché avec ${topLoser.change24h}%.` : "";

  const altContent = `${altTrend} ${gainerText} ${loserText} ${dom > 50 ? "Les altcoins à forte utilité et revenus de protocole sont à privilégier dans ce contexte de dominance BTC élevée." : "L'environnement est favorable aux altcoins de qualité, considérez une diversification mesurée."}`;

  // Strong sector detection
  let strongSector: string;
  let strongSectorStatus: Signal["status"] = "positive";
  if (topGainer) {
    const sym = topGainer.symbol.toUpperCase();
    if (["RNDR", "FET", "AGIX", "TAO", "WLD"].includes(sym)) strongSector = "AI & Compute";
    else if (["SOL", "AVAX", "NEAR", "SUI", "APT"].includes(sym)) strongSector = "Layer 1";
    else if (["AAVE", "UNI", "MKR", "CRV", "LDO"].includes(sym)) strongSector = "DeFi";
    else if (["DOGE", "SHIB", "PEPE", "WIF", "BONK"].includes(sym)) { strongSector = "Memecoins"; strongSectorStatus = "neutral"; }
    else strongSector = "Large Caps";
  } else {
    strongSector = "N/A";
    strongSectorStatus = "neutral";
  }

  let weakSector: string;
  let weakSectorStatus: Signal["status"] = "negative";
  if (topLoser) {
    const sym = topLoser.symbol.toUpperCase();
    if (["DOGE", "SHIB", "PEPE", "WIF", "BONK"].includes(sym)) weakSector = "Memecoins";
    else if (["SOL", "AVAX", "NEAR", "SUI", "APT"].includes(sym)) weakSector = "Layer 1";
    else if (["AAVE", "UNI", "MKR", "CRV", "LDO"].includes(sym)) weakSector = "DeFi";
    else weakSector = "Small/Mid Caps";
  } else {
    weakSector = "N/A";
    weakSectorStatus = "neutral";
  }

  return {
    global: {
      title: "Analyse Globale du Marché",
      content: globalContent,
      signals: [
        { label: "Tendance", value: btcChange > 3 ? "Haussière forte" : btcChange > 0 ? "Haussière modérée" : btcChange > -3 ? "Correction légère" : "Correction forte", status: globalTrendStatus },
        { label: "Volume", value: Math.abs(btcChange) > 5 ? "Élevé" : Math.abs(btcChange) > 2 ? "Normal" : "Faible", status: Math.abs(btcChange) > 5 ? "positive" : Math.abs(btcChange) > 2 ? "neutral" : "neutral" },
        { label: "Fear & Greed", value: `${fgi}/100`, status: fgi >= 55 ? "positive" : fgi <= 40 ? "negative" : "neutral" },
        { label: "Risque", value: fgi >= 75 ? "Élevé" : fgi <= 25 ? "Élevé (peur)" : "Modéré", status: fgi >= 75 || fgi <= 25 ? "negative" : "neutral" },
      ],
    },
    bitcoin: {
      title: "Analyse Bitcoin",
      content: btcContent,
      signals: [
        { label: "Prix", value: `$${btcPrice.toLocaleString()}`, status: btcChange >= 0 ? "positive" : "negative" },
        { label: "Résistance", value: `$${resistance.toLocaleString()}`, status: "neutral" },
        { label: "Support", value: `$${support.toLocaleString()}`, status: btcPrice > support * 1.05 ? "positive" : "negative" },
        { label: "RSI estimé", value: rsiText, status: rsiStatus },
      ],
    },
    altcoins: {
      title: "Analyse Altcoins",
      content: altContent,
      signals: [
        { label: "ETH/BTC", value: ethBtcTrend ? "En hausse" : "En baisse", status: ethBtcTrend ? "positive" : "negative" },
        { label: "Secteur fort", value: strongSector, status: strongSectorStatus },
        { label: "Secteur faible", value: weakSector, status: weakSectorStatus },
        { label: "Opportunité", value: dom > 55 ? "BTC + DeFi" : "Altcoins qualité", status: "positive" },
      ],
    },
  };
}
