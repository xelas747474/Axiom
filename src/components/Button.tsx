import { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "btn-shine inline-flex items-center justify-center font-medium rounded-xl transition-all duration-300 cursor-pointer active:scale-[0.97]";

  const variants = {
    primary:
      "bg-gradient-to-r from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] text-white hover:shadow-xl hover:shadow-[var(--color-accent-blue)]/30 hover:-translate-y-0.5 shadow-lg shadow-[var(--color-accent-blue)]/20",
    secondary:
      "border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] hover:text-white hover:border-[var(--color-accent-blue)]/50 hover:-translate-y-0.5",
    ghost:
      "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card)]",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-5 py-2.5 text-sm gap-2",
    lg: "px-7 py-3 text-base gap-2.5",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
