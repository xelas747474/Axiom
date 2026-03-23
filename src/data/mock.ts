// ============================================
// AXIOM — Mock Data
// Prepared for easy API integration (CoinGecko, OpenAI)
// ============================================

export interface CryptoAsset {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  marketCap?: number;
  volume?: number;
}

export interface Alert {
  id: string;
  type: "volatility" | "breakout" | "risk";
  title: string;
  description: string;
  timestamp: string;
  severity: "low" | "medium" | "high";
}

export interface InsightCard {
  title: string;
  value: string;
  description: string;
  status: "positive" | "negative" | "neutral";
}

// --- Market Overview ---
export const marketOverview = {
  bitcoin: { name: "Bitcoin", symbol: "BTC", price: 67842.5, change24h: 2.34 },
  ethereum: { name: "Ethereum", symbol: "ETH", price: 3521.18, change24h: -0.87 },
  marketCap: 2.47, // trillions
  btcDominance: 54.2,
  fearGreedIndex: 62,
  fearGreedLabel: "Greed" as const,
};

// --- AI Market Summary ---
export const aiMarketSummary =
  "Le marché est en phase de consolidation. La dominance BTC augmente à 54.2%, indiquant une rotation du capital depuis les altcoins vers Bitcoin. Le Fear & Greed Index à 62 montre un sentiment de cupidité modérée. Les volumes restent stables mais inférieurs à la moyenne sur 30 jours. Prudence à court terme recommandée — attendez une confirmation de breakout au-dessus de $69,000 avant d'augmenter l'exposition.";

// --- Top Movers ---
export const topGainers: CryptoAsset[] = [
  { name: "Solana", symbol: "SOL", price: 178.42, change24h: 8.56 },
  { name: "Avalanche", symbol: "AVAX", price: 42.18, change24h: 6.23 },
  { name: "Chainlink", symbol: "LINK", price: 18.95, change24h: 5.12 },
  { name: "Render", symbol: "RNDR", price: 11.24, change24h: 4.87 },
  { name: "Injective", symbol: "INJ", price: 35.67, change24h: 4.15 },
];

export const topLosers: CryptoAsset[] = [
  { name: "Dogecoin", symbol: "DOGE", price: 0.1234, change24h: -5.67 },
  { name: "Shiba Inu", symbol: "SHIB", price: 0.00002345, change24h: -4.89 },
  { name: "Cardano", symbol: "ADA", price: 0.5678, change24h: -3.45 },
  { name: "Polkadot", symbol: "DOT", price: 7.89, change24h: -2.98 },
  { name: "Cosmos", symbol: "ATOM", price: 9.12, change24h: -2.34 },
];

// --- BTC Chart Data (simulated) ---
export const btcChartData = {
  "1H": [67500, 67600, 67450, 67700, 67650, 67800, 67750, 67842],
  "1D": [66800, 67100, 66900, 67400, 67200, 67600, 67500, 67842],
  "1W": [64000, 65200, 64800, 66500, 65900, 67200, 66800, 67842],
  "1M": [58000, 60500, 59000, 63000, 61500, 65000, 64000, 67842],
  "1Y": [28000, 35000, 42000, 38000, 45000, 52000, 60000, 67842],
};

// --- Alerts ---
export const alerts: Alert[] = [
  {
    id: "1",
    type: "volatility",
    title: "Forte volatilité BTC",
    description: "Le Bitcoin a enregistré une variation de 4.2% en 2 heures. Soyez vigilant.",
    timestamp: "Il y a 12 min",
    severity: "high",
  },
  {
    id: "2",
    type: "breakout",
    title: "Breakout potentiel ETH",
    description: "Ethereum s'approche de la résistance à $3,600. Un breakout pourrait déclencher un rally.",
    timestamp: "Il y a 34 min",
    severity: "medium",
  },
  {
    id: "3",
    type: "risk",
    title: "Risque de liquidation élevé",
    description: "Plus de $500M en positions long sont à risque de liquidation sous $66,000.",
    timestamp: "Il y a 1h",
    severity: "high",
  },
  {
    id: "4",
    type: "volatility",
    title: "Volume anormal SOL",
    description: "Le volume de trading Solana a augmenté de 340% en 4 heures.",
    timestamp: "Il y a 2h",
    severity: "medium",
  },
  {
    id: "5",
    type: "breakout",
    title: "Pattern haussier LINK",
    description: "Chainlink forme un triangle ascendant sur le graphique 4H.",
    timestamp: "Il y a 3h",
    severity: "low",
  },
  {
    id: "6",
    type: "risk",
    title: "Corrélation BTC-actions élevée",
    description: "La corrélation entre BTC et le S&P 500 atteint 0.85, un niveau historiquement élevé.",
    timestamp: "Il y a 4h",
    severity: "medium",
  },
  {
    id: "7",
    type: "volatility",
    title: "Whale alert",
    description: "Transfert de 12,000 BTC vers Binance détecté. Possible pression vendeuse.",
    timestamp: "Il y a 5h",
    severity: "high",
  },
];

// --- Quick Insights ---
export const quickInsights: InsightCard[] = [
  {
    title: "Market Sentiment",
    value: "62/100",
    description: "Cupidité modérée — le marché reste optimiste mais vigilant",
    status: "positive",
  },
  {
    title: "Pump Alert",
    value: "SOL +8.5%",
    description: "Solana en forte hausse avec un volume 3x supérieur",
    status: "positive",
  },
  {
    title: "Trend Direction",
    value: "Haussier",
    description: "Tendance globale haussière sur les 7 derniers jours",
    status: "positive",
  },
  {
    title: "Risk Level",
    value: "Modéré",
    description: "Volatilité en hausse — ajustez vos positions",
    status: "neutral",
  },
];

// --- AI Insights (detailed) ---
export const aiInsights = {
  global: {
    title: "Analyse Globale du Marché",
    content:
      "Le marché crypto montre des signes de maturité avec une capitalisation totale de $2.47T. La phase actuelle de consolidation est caractéristique d'une accumulation institutionnelle. Les indicateurs on-chain montrent une diminution des réserves d'exchange, suggérant un sentiment de holding fort. La corrélation avec les marchés traditionnels reste élevée, ce qui expose le marché crypto aux décisions de la Fed sur les taux d'intérêt. Recommandation : maintenir une exposition modérée avec un biais haussier.",
    signals: [
      { label: "Tendance", value: "Consolidation haussière", status: "positive" as const },
      { label: "Volume", value: "Sous la moyenne 30j", status: "neutral" as const },
      { label: "Flux institutionnel", value: "Positif", status: "positive" as const },
      { label: "Risque macro", value: "Modéré", status: "neutral" as const },
    ],
  },
  bitcoin: {
    title: "Analyse Bitcoin",
    content:
      "Bitcoin maintient sa position au-dessus du support clé à $65,000. La dominance BTC en hausse à 54.2% indique un flight-to-quality des altcoins vers BTC. Le hashrate atteint des niveaux records, renforçant la sécurité du réseau. Les ETF spot continuent d'accumuler, avec des flux nets positifs sur les 15 derniers jours. Le prochain objectif technique se situe à $70,000, avec un support majeur à $63,500. Le RSI à 58 laisse encore de la marge pour une hausse.",
    signals: [
      { label: "Prix", value: "$67,842", status: "positive" as const },
      { label: "Résistance", value: "$70,000", status: "neutral" as const },
      { label: "Support", value: "$63,500", status: "positive" as const },
      { label: "RSI", value: "58 (neutre)", status: "neutral" as const },
    ],
  },
  altcoins: {
    title: "Analyse Altcoins",
    content:
      "Le marché des altcoins montre une rotation sectorielle. Les tokens liés à l'IA (RNDR, FET) et les L1 performants (SOL, AVAX) surperforment le marché. Les memecoins montrent des signes de faiblesse avec des baisses de 3-6%. L'ETH/BTC ratio continue sa baisse, indiquant que Bitcoin reste le leader de ce cycle. Les altcoins à forte utilité avec des revenus de protocole sont à privilégier. Attention aux tokens à faible liquidité qui peuvent subir des corrections violentes.",
    signals: [
      { label: "ETH/BTC", value: "En baisse", status: "negative" as const },
      { label: "Secteur fort", value: "AI & L1", status: "positive" as const },
      { label: "Secteur faible", value: "Memecoins", status: "negative" as const },
      { label: "Opportunité", value: "DeFi blue chips", status: "positive" as const },
    ],
  },
};
