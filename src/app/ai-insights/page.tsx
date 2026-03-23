import Card from "@/components/Card";
import { aiInsights } from "@/data/mock";

const statusColors = {
  positive: "text-[var(--color-positive)]",
  negative: "text-[var(--color-negative)]",
  neutral: "text-[var(--color-warning)]",
};

const statusBg = {
  positive: "bg-[var(--color-positive)]/10",
  negative: "bg-[var(--color-negative)]/10",
  neutral: "bg-[var(--color-warning)]/10",
};

function InsightSection({
  section,
}: {
  section: (typeof aiInsights)[keyof typeof aiInsights];
}) {
  return (
    <Card highlight>
      <h3 className="text-lg font-bold text-white mb-3">{section.title}</h3>
      <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] mb-6">
        {section.content}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {section.signals.map((signal) => (
          <div
            key={signal.label}
            className="rounded-xl bg-[var(--color-bg-primary)]/50 p-4"
          >
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              {signal.label}
            </p>
            <p className={`mt-1 text-sm font-semibold ${statusColors[signal.status]}`}>
              {signal.value}
            </p>
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBg[signal.status]} ${statusColors[signal.status]}`}
            >
              {signal.status === "positive"
                ? "Positif"
                : signal.status === "negative"
                  ? "Négatif"
                  : "Neutre"}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function AIInsightsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-10">
      <section className="text-center py-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] mb-4">
          <span className="text-2xl">🧠</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Analyse IA du Marché
        </h1>
        <p className="mt-3 text-[var(--color-text-secondary)] max-w-xl mx-auto">
          Intelligence artificielle appliquée à l&apos;analyse des marchés crypto
          pour des décisions éclairées
        </p>
      </section>

      <InsightSection section={aiInsights.global} />
      <InsightSection section={aiInsights.bitcoin} />
      <InsightSection section={aiInsights.altcoins} />
    </div>
  );
}
