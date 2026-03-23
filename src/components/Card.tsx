import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
}

export default function Card({
  children,
  className = "",
  highlight = false,
}: CardProps) {
  return (
    <div
      className={`card-premium rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-6 shadow-lg shadow-black/20 ${
        highlight ? "card-glow border-[var(--color-accent-blue)]/30" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
