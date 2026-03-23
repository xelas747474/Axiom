"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ai-insights", label: "AI Insights" },
  { href: "/alerts", label: "Alerts" },
  { href: "/settings", label: "Settings" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)]">
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
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--color-accent-blue)]/10 text-[var(--color-accent-blue)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <button className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent-blue)] hover:text-white">
          Se connecter
        </button>
      </div>

      {/* Mobile nav */}
      <div className="flex gap-1 overflow-x-auto border-t border-[var(--color-border-subtle)] px-4 py-2 md:hidden">
        {navLinks.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href === "/dashboard" && pathname === "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
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
    </nav>
  );
}
