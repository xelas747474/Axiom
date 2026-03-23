"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthModal from "./AuthModal";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ai-insights", label: "AI Insights" },
  { href: "/alerts", label: "Alerts" },
  { href: "/settings", label: "Settings" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--color-border-subtle)]/50 glass">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
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

        <div className="hidden items-center gap-1 md:flex">
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

        <button
          onClick={() => setAuthOpen(true)}
          className="btn-shine rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-300 hover:border-[var(--color-accent-blue)]/50 hover:text-white hover:shadow-lg hover:shadow-[var(--color-accent-blue)]/10 active:scale-[0.97]"
        >
          Se connecter
        </button>
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
