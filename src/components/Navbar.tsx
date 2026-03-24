"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AuthModal from "./AuthModal";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trading", label: "Trading" },
  { href: "/bot", label: "\u{1F916} Bot" },
  { href: "/ai-insights", label: "AI Insights" },
  { href: "/alerts", label: "Alerts" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click — use click (not mousedown) to avoid intercepting link navigation
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [dropdownOpen]);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [pathname]);

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--color-border-subtle)]/50 glass">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 group transition-transform duration-300 hover:scale-105"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] shadow-lg shadow-[var(--color-accent-blue)]/25 transition-shadow duration-300 group-hover:shadow-[var(--color-accent-blue)]/40">
            <span className="text-sm font-bold text-white">A</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            AXIOM
          </span>
        </Link>

        {/* Desktop nav links — always visible, never blocked by dropdown */}
        <div className="hidden items-center gap-1 md:flex relative z-10">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href === "/dashboard" && pathname === "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-[var(--color-accent-blue)]/10 text-[var(--color-accent-blue)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] hover:text-white"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-[var(--color-accent-blue)] animate-scale-in" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Auth section */}
        {loading ? (
          <div className="h-9 w-9 rounded-full bg-[var(--color-bg-card)] animate-pulse" />
        ) : user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen); }}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-3 py-1.5 transition-all duration-300 hover:border-[var(--color-accent-blue)]/30 hover:bg-[var(--color-bg-card-hover)]"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] text-[10px] font-bold text-white">
                {initials}
              </div>
              <span className="hidden text-sm font-medium text-[var(--color-text-secondary)] sm:block">
                {user.name.split(" ")[0]}
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className={`text-[var(--color-text-muted)] transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
              >
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-1.5 shadow-2xl shadow-black/40 animate-scale-in origin-top-right z-50">
                {/* User info */}
                <div className="px-3 py-2.5 border-b border-[var(--color-border-subtle)]/50 mb-1.5">
                  <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-all duration-200 hover:bg-[var(--color-bg-card)] hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Mon Profil
                </Link>

                <Link
                  href="/trading"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-all duration-200 hover:bg-[var(--color-bg-card)] hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 11l3-4 3 2 4-5 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Mes Favoris
                </Link>

                <Link
                  href="/alerts"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-all duration-200 hover:bg-[var(--color-bg-card)] hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2a4 4 0 014 4v3l1.5 2H2.5L4 9V6a4 4 0 014-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 13a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Alertes
                </Link>

                <div className="my-1.5 border-t border-[var(--color-border-subtle)]/50" />

                <button
                  onClick={() => { logout(); setDropdownOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--color-negative)] transition-all duration-200 hover:bg-[var(--color-negative)]/10"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 2H4a2 2 0 00-2 2v8a2 2 0 002 2h2M10.5 11.5L14 8l-3.5-3.5M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setAuthOpen(true)}
            className="btn-shine rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-300 hover:border-[var(--color-accent-blue)]/50 hover:text-white hover:shadow-lg hover:shadow-[var(--color-accent-blue)]/10 active:scale-[0.97]"
          >
            Se connecter
          </button>
        )}
      </div>

      {/* Mobile nav */}
      <div className="flex gap-1 overflow-x-auto border-t border-[var(--color-border-subtle)]/50 px-4 py-2 md:hidden">
        {navLinks.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href === "/dashboard" && pathname === "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300 ${
                isActive
                  ? "bg-[var(--color-accent-blue)]/10 text-[var(--color-accent-blue)]"
                  : "text-[var(--color-text-secondary)] hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </nav>
  );
}
