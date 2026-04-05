"use client";

import { useAuth, apiFetch } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import SecurityLogsPanel from "@/components/SecurityLogsPanel";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [count, setCount] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setFetching(true);
      const res = await apiFetch("/api/admin/users");
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur");
        return;
      }
      const data = await res.json();
      setUsers(data.users);
      setCount(data.count);
    } catch {
      setError("Erreur réseau");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  async function handleDelete(userId: string) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    setDeleting(userId);
    try {
      const res = await apiFetch(`/api/admin/users?id=${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setCount((prev) => prev - 1);
      } else {
        const data = await res.json();
        alert(data.error || "Erreur");
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent-blue)] border-t-transparent" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-white mb-2">Accès restreint</h1>
          <p className="text-[var(--color-text-secondary)]">
            Cette page est réservée aux administrateurs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg-primary)] pt-20 pb-12 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500 text-lg">
              ⚙️
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Gestion des utilisateurs AXIOM
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">Utilisateurs</div>
            <div className="text-2xl font-bold text-white">{count}</div>
          </div>
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">Maximum</div>
            <div className="text-2xl font-bold text-white">10</div>
          </div>
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">Places restantes</div>
            <div className="text-2xl font-bold" style={{ color: count >= 10 ? "var(--color-negative)" : "var(--color-positive)" }}>
              {10 - count}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-[var(--color-negative)]/30 bg-[var(--color-negative)]/10 px-4 py-3 text-sm text-[var(--color-negative)]">
            {error}
          </div>
        )}

        {/* Users table */}
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
            <h2 className="font-semibold text-white">Utilisateurs enregistrés</h2>
            <button
              onClick={fetchUsers}
              disabled={fetching}
              className="text-xs text-[var(--color-accent-blue)] hover:text-[var(--color-accent-blue)]/80 transition-colors disabled:opacity-50"
            >
              {fetching ? "Chargement..." : "Rafraîchir"}
            </button>
          </div>

          {fetching && users.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-text-muted)]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent-blue)] border-t-transparent mx-auto mb-2" />
              Chargement...
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-text-muted)]">
              Aucun utilisateur
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg-card-hover)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] text-sm font-bold text-white">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{u.name}</span>
                        {u.role === "admin" && (
                          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400 uppercase">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">{u.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                    </div>
                    {u.id !== user.id && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={deleting === u.id}
                        className="rounded-lg border border-[var(--color-negative)]/30 bg-[var(--color-negative)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-negative)] transition-all hover:bg-[var(--color-negative)]/20 disabled:opacity-50"
                      >
                        {deleting === u.id ? "..." : "Supprimer"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security logs */}
        <SecurityLogsPanel />

        {/* Info */}
        <div className="mt-6 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-4">
          <h3 className="text-sm font-medium text-white mb-2">Informations</h3>
          <ul className="space-y-1 text-xs text-[var(--color-text-muted)]">
            <li>Le premier utilisateur inscrit est automatiquement administrateur.</li>
            <li>Maximum 10 comptes autorisés sur la plateforme.</li>
            <li>Les mots de passe sont hashés avec bcrypt (10 rounds).</li>
            <li>Les sessions utilisent des tokens JWT (expiration : 7 jours).</li>
            <li>Les données sont stockées dans Upstash Redis.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
