// ============================================
// Input validation & sanitization
// All user-supplied data must pass through these helpers.
// ============================================

export function sanitizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const clean = email.trim().toLowerCase();
  if (clean.length > 254) return null;
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(clean) ? clean : null;
}

export function sanitizeString(str: unknown, maxLength = 100): string {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLength).replace(/[<>]/g, "");
}

export function validatePassword(password: unknown): { valid: boolean; error?: string } {
  if (typeof password !== "string") return { valid: false, error: "Mot de passe invalide" };
  if (password.length < 8) return { valid: false, error: "Minimum 8 caractères" };
  if (password.length > 128) return { valid: false, error: "Maximum 128 caractères" };
  if (!/[A-Z]/.test(password)) return { valid: false, error: "Au moins une majuscule" };
  if (!/[0-9]/.test(password)) return { valid: false, error: "Au moins un chiffre" };
  return { valid: true };
}

export function validateTradeAmount(amount: unknown, maxAllowed: number): boolean {
  if (typeof amount !== "number") return false;
  return amount > 0 && amount <= maxAllowed && Number.isFinite(amount);
}

/** Binance API key format check (alphanumeric, 40-100 chars). */
export function validateBinanceKey(key: unknown): boolean {
  if (typeof key !== "string") return false;
  const trimmed = key.trim();
  return trimmed.length >= 40 && trimmed.length <= 128 && /^[A-Za-z0-9]+$/.test(trimmed);
}

const ALLOWED_SYMBOLS = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"]);
export function validateSymbol(symbol: unknown): string | null {
  if (typeof symbol !== "string") return null;
  const up = symbol.toUpperCase();
  return ALLOWED_SYMBOLS.has(up) ? up : null;
}
