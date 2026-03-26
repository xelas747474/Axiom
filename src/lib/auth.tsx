"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";

// ============================================
// Types
// ============================================
export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
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
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  updatePreferences: (prefs: Partial<User["preferences"]>) => void;
  toasts: Toast[];
  addToast: (message: string, type: Toast["type"]) => void;
  removeToast: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "axiom_token";

// ============================================
// API helpers
// ============================================
function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch { /* ignore */ }
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(path, { ...options, headers });
}

// ============================================
// Provider
// ============================================
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pendingPrefsUpdate = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore session from JWT on mount
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Invalid token");
      })
      .then((data) => setUser(data.user))
      .catch(() => {
        clearToken();
      })
      .finally(() => setLoading(false));
  }, []);

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
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || "Erreur de connexion" };
      }

      storeToken(data.token);
      setUser(data.user);
      addToast("Connecté !", "success");
      return { ok: true };
    } catch {
      return { ok: false, error: "Erreur réseau. Réessayez." };
    }
  }, [addToast]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await apiFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || "Erreur lors de la création" };
      }

      storeToken(data.token);
      setUser(data.user);
      addToast("Compte créé avec succès !", "success");
      return { ok: true };
    } catch {
      return { ok: false, error: "Erreur réseau. Réessayez." };
    }
  }, [addToast]);

  const logout = useCallback(async () => {
    clearToken();
    setUser(null);
    addToast("Déconnecté", "info");
    // Also clear the HTTP-only cookie
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
  }, [addToast]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      // Persist to server (debounced)
      if (pendingPrefsUpdate.current) clearTimeout(pendingPrefsUpdate.current);
      pendingPrefsUpdate.current = setTimeout(() => {
        apiFetch("/api/auth/update", {
          method: "PUT",
          body: JSON.stringify({ name: updated.name, preferences: updated.preferences }),
        }).catch(() => {});
      }, 500);
      return updated;
    });
  }, []);

  const updatePreferences = useCallback((prefs: Partial<User["preferences"]>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, preferences: { ...prev.preferences, ...prefs } };
      // Persist to server (debounced)
      if (pendingPrefsUpdate.current) clearTimeout(pendingPrefsUpdate.current);
      pendingPrefsUpdate.current = setTimeout(() => {
        apiFetch("/api/auth/update", {
          method: "PUT",
          body: JSON.stringify({ preferences: updated.preferences }),
        }).catch(() => {});
      }, 500);
      return updated;
    });
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

// ============================================
// API helper export (for other components)
// ============================================
export { apiFetch, getStoredToken };
