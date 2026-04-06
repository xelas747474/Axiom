// ============================================
// AES-256-GCM encryption for sensitive secrets (Binance API keys, etc.)
// Key source: ENCRYPTION_KEY env var (32 bytes hex, i.e. 64 chars).
// Output format: ivHex:authTagHex:ciphertextHex
// ============================================

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (!k) throw new Error("ENCRYPTION_KEY is not configured");
  if (k.length !== 64) throw new Error("ENCRYPTION_KEY must be 32 bytes hex (64 chars)");
  return Buffer.from(k, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted payload");
  const [ivHex, tagHex, ctHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

/** Mask a secret for display: keeps 4 first + 4 last chars. */
export function maskSecret(s: string): string {
  if (!s || s.length < 12) return "••••••••";
  return `${s.slice(0, 4)}••••••••${s.slice(-4)}`;
}
