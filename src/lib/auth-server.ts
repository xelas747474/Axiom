import { getRedis, REDIS_KEYS } from "./redis";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ============================================
// Types
// ============================================
export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "user" | "admin";
  plan: "free" | "pro";
  createdAt: string;
  preferences: {
    favoriteCrypto: string;
    currency: string;
    alertFrequency: string;
    notifications: boolean;
    lastCrypto: string;
    lastTimeframe: string;
    watchlist: string[];
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: "user" | "admin";
}

const MAX_USERS = 10;
const SALT_ROUNDS = 10;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

// ============================================
// Password utils
// ============================================
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// JWT utils
// ============================================
export function createToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch {
    return null;
  }
}

// Extract token from Authorization header or cookie
export function extractToken(request: Request): string | null {
  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check cookie
  const cookie = request.headers.get("cookie");
  if (cookie) {
    const match = cookie.match(/axiom_token=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

// Verify request and return user
export async function authenticateRequest(request: Request): Promise<StoredUser | null> {
  const token = extractToken(request);
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  return getUserById(payload.userId);
}

// ============================================
// Redis user operations
// ============================================
export async function getUserById(id: string): Promise<StoredUser | null> {
  const r = getRedis();
  const user = await r.get<StoredUser>(REDIS_KEYS.user(id));
  return user;
}

export async function getUserByEmail(email: string): Promise<StoredUser | null> {
  const r = getRedis();
  const userId = await r.get<string>(REDIS_KEYS.userByEmail(email.toLowerCase()));
  if (!userId) return null;
  return getUserById(userId);
}

export async function getUserCount(): Promise<number> {
  const r = getRedis();
  const count = await r.scard(REDIS_KEYS.usersList);
  return count;
}

export async function getAllUsers(): Promise<StoredUser[]> {
  const r = getRedis();
  const userIds = await r.smembers(REDIS_KEYS.usersList);
  if (!userIds.length) return [];

  const users: StoredUser[] = [];
  for (const id of userIds) {
    const user = await r.get<StoredUser>(REDIS_KEYS.user(id));
    if (user) users.push(user);
  }
  return users;
}

export async function createUser(
  name: string,
  email: string,
  password: string
): Promise<{ ok: boolean; user?: StoredUser; error?: string }> {
  const r = getRedis();
  const normalizedEmail = email.toLowerCase();

  // Check max users
  const count = await getUserCount();
  if (count >= MAX_USERS) {
    return { ok: false, error: "Nombre maximum d'utilisateurs atteint (10)" };
  }

  // Check duplicate
  const existing = await r.get(REDIS_KEYS.userByEmail(normalizedEmail));
  if (existing) {
    return { ok: false, error: "Cet email est déjà associé à un compte" };
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const isFirstUser = count === 0;

  const user: StoredUser = {
    id,
    name,
    email: normalizedEmail,
    passwordHash,
    role: isFirstUser ? "admin" : "user",
    plan: isFirstUser ? "pro" : "free",
    createdAt: new Date().toISOString(),
    preferences: {
      favoriteCrypto: "BTCUSDT",
      currency: "USD",
      alertFrequency: "realtime",
      notifications: true,
      lastCrypto: "BTCUSDT",
      lastTimeframe: "1D",
      watchlist: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
    },
  };

  // Store user data, email->id mapping, and add to users set
  await r.set(REDIS_KEYS.user(id), JSON.stringify(user));
  await r.set(REDIS_KEYS.userByEmail(normalizedEmail), id);
  await r.sadd(REDIS_KEYS.usersList, id);

  return { ok: true, user };
}

export async function deleteUser(id: string): Promise<boolean> {
  const r = getRedis();
  const user = await getUserById(id);
  if (!user) return false;

  await r.del(REDIS_KEYS.user(id));
  await r.del(REDIS_KEYS.userByEmail(user.email));
  await r.srem(REDIS_KEYS.usersList, id);

  return true;
}

export async function updateUserData(
  id: string,
  updates: Partial<Pick<StoredUser, "name" | "preferences">>
): Promise<StoredUser | null> {
  const r = getRedis();
  const user = await getUserById(id);
  if (!user) return null;

  const updated: StoredUser = {
    ...user,
    ...updates,
    preferences: updates.preferences
      ? { ...user.preferences, ...updates.preferences }
      : user.preferences,
  };

  await r.set(REDIS_KEYS.user(id), JSON.stringify(updated));
  return updated;
}

// Strip sensitive fields for client
export function sanitizeUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    plan: (user as StoredUser).plan ?? (user.role === "admin" ? "pro" : "free"),
    createdAt: user.createdAt,
    preferences: user.preferences,
  };
}
