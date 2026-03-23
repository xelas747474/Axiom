import { Alert } from "@/data/mock";

const typeIcons: Record<Alert["type"], string> = {
  volatility: "⚡",
  breakout: "🚀",
  risk: "⚠️",
};

const severityColors: Record<Alert["severity"], string> = {
  low: "text-[var(--color-accent-blue)]",
  medium: "text-[var(--color-warning)]",
  high: "text-[var(--color-negative)]",
};

const severityBg: Record<Alert["severity"], string> = {
  low: "bg-[var(--color-accent-blue)]/10",
  medium: "bg-[var(--color-warning)]/10",
  high: "bg-[var(--color-negative)]/10",
};

const severityBorder: Record<Alert["severity"], string> = {
  low: "hover:border-[var(--color-accent-blue)]/30",
  medium: "hover:border-[var(--color-warning)]/30",
  high: "hover:border-[var(--color-negative)]/30",
};

interface AlertItemProps {
  alert: Alert;
}

export default function AlertItem({ alert }: AlertItemProps) {
  return (
    <div
      className={`flex items-start gap-4 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-4 transition-all duration-300 hover:bg-[var(--color-bg-card-hover)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 ${severityBorder[alert.severity]} animate-fade-in-up`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg transition-transform duration-300 hover:scale-110 ${severityBg[alert.severity]}`}
      >
        {typeIcons[alert.type]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-white">{alert.title}</h4>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityBg[alert.severity]} ${severityColors[alert.severity]}`}
          >
            {alert.severity}
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {alert.description}
        </p>
        <span className="mt-2 block text-xs text-[var(--color-text-muted)]">
          {alert.timestamp}
        </span>
      </div>
    </div>
  );
}
