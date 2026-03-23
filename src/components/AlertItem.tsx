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

interface AlertItemProps {
  alert: Alert;
}

export default function AlertItem({ alert }: AlertItemProps) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-4 transition-colors hover:bg-[var(--color-bg-card-hover)]">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${severityBg[alert.severity]}`}
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
