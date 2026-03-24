"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import Button from "./Button";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shake, setShake] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSuccess(false);
      setLoading(false);
      setErrors({});
      setShake(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Format d'email invalide";
    }

    if (!password) {
      newErrors.password = "Le mot de passe est requis";
    } else if (mode === "register" && password.length < 8) {
      newErrors.password = "Minimum 8 caractères";
    }

    if (mode === "register") {
      if (!name.trim()) {
        newErrors.name = "Le nom est requis";
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      triggerShake();
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      let result: { ok: boolean; error?: string };

      if (mode === "login") {
        result = await login(email, password);
      } else {
        result = await register(name, email, password);
      }

      if (result.ok) {
        setSuccess(true);
        setTimeout(() => onClose(), 1200);
      } else {
        setErrors({ form: result.error || "Une erreur est survenue" });
        triggerShake();
      }
    } catch {
      setErrors({ form: "Erreur de connexion. Réessayez." });
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  const inputClass = (field: string) =>
    `w-full rounded-xl border bg-[var(--color-bg-primary)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--color-text-muted)] transition-all duration-300 focus:outline-none focus:ring-1 ${
      errors[field]
        ? "border-[var(--color-negative)] focus:border-[var(--color-negative)] focus:ring-[var(--color-negative)]"
        : "border-[var(--color-border-subtle)] focus:border-[var(--color-accent-blue)] focus:ring-[var(--color-accent-blue)]"
    }`;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-fade-in"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
    >
      <div className={`relative w-full max-w-md rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-8 shadow-2xl shadow-black/40 animate-scale-in ${shake ? "animate-shake" : ""}`}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-all duration-200 hover:bg-[var(--color-bg-card)] hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {success ? (
          <div className="text-center py-6 animate-fade-in-up">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-positive)]/10">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="var(--color-positive)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">
              {mode === "login" ? "Connexion réussie" : "Compte créé"}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {mode === "login"
                ? "Bienvenue sur AXIOM !"
                : "Votre compte a été créé avec succès."}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] shadow-lg shadow-[var(--color-accent-blue)]/25">
                <span className="text-lg font-bold text-white">A</span>
              </div>
              <h2 className="text-xl font-bold text-white">
                {mode === "login" ? "Se connecter" : "Créer un compte"}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {mode === "login"
                  ? "Accédez à votre tableau de bord"
                  : "Rejoignez AXIOM gratuitement"}
              </p>
            </div>

            {/* Social login */}
            <div className="flex gap-3 mb-6">
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-300 hover:bg-[var(--color-bg-card-hover)] hover:text-white hover:border-[var(--color-accent-blue)]/30">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-300 hover:bg-[var(--color-bg-card-hover)] hover:text-white hover:border-[var(--color-accent-blue)]/30">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                GitHub
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-border-subtle)]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[var(--color-bg-secondary)] px-3 text-[var(--color-text-muted)]">
                  ou par email
                </span>
              </div>
            </div>

            {/* Form error */}
            {errors.form && (
              <div className="mb-4 rounded-xl border border-[var(--color-negative)]/30 bg-[var(--color-negative)]/10 px-4 py-3 text-sm text-[var(--color-negative)]">
                {errors.form}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setErrors((p) => { const { name: _, ...rest } = p; return rest; }); }}
                    placeholder="Votre nom"
                    className={inputClass("name")}
                  />
                  {errors.name && <p className="mt-1 text-xs text-[var(--color-negative)]">{errors.name}</p>}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => { const { email: _, ...rest } = p; return rest; }); }}
                  placeholder="vous@exemple.com"
                  className={inputClass("email")}
                />
                {errors.email && <p className="mt-1 text-xs text-[var(--color-negative)]">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => { const { password: _, ...rest } = p; return rest; }); }}
                  placeholder={mode === "login" ? "Votre mot de passe" : "Minimum 8 caractères"}
                  className={inputClass("password")}
                />
                {errors.password && <p className="mt-1 text-xs text-[var(--color-negative)]">{errors.password}</p>}
              </div>

              {mode === "register" && (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => { const { confirmPassword: _, ...rest } = p; return rest; }); }}
                    placeholder="Retapez votre mot de passe"
                    className={inputClass("confirmPassword")}
                  />
                  {errors.confirmPassword && <p className="mt-1 text-xs text-[var(--color-negative)]">{errors.confirmPassword}</p>}
                </div>
              )}

              {mode === "login" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-[var(--color-accent-blue)] hover:text-[var(--color-accent-blue)]/80 transition-colors"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {mode === "login" ? "Connexion..." : "Création..."}
                  </span>
                ) : mode === "login" ? (
                  "Se connecter"
                ) : (
                  "Créer mon compte"
                )}
              </Button>
            </form>

            {/* Toggle mode */}
            <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
              {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                  setName("");
                  setErrors({});
                }}
                className="font-medium text-[var(--color-accent-blue)] hover:text-[var(--color-accent-blue)]/80 transition-colors"
              >
                {mode === "login" ? "Créer un compte" : "Se connecter"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
