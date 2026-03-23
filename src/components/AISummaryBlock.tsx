import Card from "./Card";

interface AISummaryBlockProps {
  summary: string;
}

export default function AISummaryBlock({ summary }: AISummaryBlockProps) {
  return (
    <Card highlight>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)]">
          <span className="text-lg">🧠</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">AI Market Summary</h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            Analyse en temps réel
          </p>
        </div>
        <span className="ml-auto rounded-full bg-[var(--color-positive)]/10 px-3 py-1 text-xs font-medium text-[var(--color-positive)]">
          Live
        </span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {summary}
      </p>
    </Card>
  );
}
