"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

// ============================================
// Types
// ============================================
export interface User {
  id: string;
  name: string;
  email: string;
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

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, name?: string) => Promise<{ ok: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  updatePreferences: (prefs: Partial<User["preferences"]>) => void;
  toasts: Toast[];
  addToast: (message: string, type: Toast["type"]) => void;
  removeToast: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "axiom_user";
const ACCOUNTS_KEY = "axiom_accounts";

// ============================================
// Helper: simulated accounts store (localStorage)
// ============================================
function getAccounts(): Record<string, { password: string; user: User }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveAccounts(accounts: Record<string, { password: string; user: User }>) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

// ============================================
// Provider
// ============================================
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // Persist user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      // Also update in accounts store
      const accounts = getAccounts();
      if (accounts[user.email]) {
        accounts[user.email].user = user;
        saveAccounts(accounts);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 1200));

    const accounts = getAccounts();
    const account = accounts[email.toLowerCase()];

    if (!account) {
      return { ok: false, error: "Aucun compte associé à cet email" };
    }
    if (account.password !== password) {
      return { ok: false, error: "Email ou mot de passe incorrect" };
    }

    setUser(account.user);
    addToast("Connecté !", "success");
    return { ok: true };
  }, [addToast]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    await new Promise((r) => setTimeout(r, 1200));

    const accounts = getAccounts();
    const key = email.toLowerCase();

    if (accounts[key]) {
      return { ok: false, error: "Cet email est déjà associé à un compte" };
    }

    const newUser: User = {
      id: Math.random().toString(36).slice(2),
      name,
      email: key,
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

    accounts[key] = { password, user: newUser };
    saveAccounts(accounts);
    setUser(newUser);
    addToast("Compte créé avec succès !", "success");
    return { ok: true };
  }, [addToast]);

  const logout = useCallback(() => {
    setUser(null);
    addToast("Déconnecté", "info");
  }, [addToast]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : prev);
  }, []);

  const updatePreferences = useCallback((prefs: Partial<User["preferences"]>) => {
    setUser((prev) => prev ? { ...prev, preferences: { ...prev.preferences, ...prefs } } : prev);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, updatePreferences, toasts, addToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-slide-in-right rounded-xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur-md"
            style={{
              background: toast.type === "success" ? "rgba(34,197,94,0.15)" : toast.type === "error" ? "rgba(239,68,68,0.15)" : "rgba(100,116,139,0.15)",
              borderColor: toast.type === "success" ? "rgba(34,197,94,0.3)" : toast.type === "error" ? "rgba(239,68,68,0.3)" : "rgba(100,116,139,0.3)",
              color: toast.type === "success" ? "#22c55e" : toast.type === "error" ? "#ef4444" : "#94a3b8",
            }}
            onClick={() => removeToast(toast.id)}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </AuthContext.Provider>
  );
}

// ============================================
// Hook
// ============================================
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
