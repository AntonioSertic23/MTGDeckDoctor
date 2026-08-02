import type { AdditionCandidate, CardPrices, Problem, Severity } from "@/domain/types";
import { CardArt } from "@/components/card-art";
import { cn } from "@/lib/utils";

export type CardVisual = {
  imageUri: string | null;
  prices?: CardPrices | null;
};

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "border-rose-500/30 bg-rose-500/8 text-rose-700 dark:text-rose-300",
  warning: "border-amber-500/30 bg-amber-500/8 text-amber-800 dark:text-amber-300",
  notice: "border-sky-500/30 bg-sky-500/8 text-sky-800 dark:text-sky-300",
};

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-rose-500",
  warning: "bg-amber-500",
  notice: "bg-sky-500",
};

export function ProblemList({
  problems,
  artByName,
}: {
  problems: Problem[];
  /** Lowercased card name → art + prices for cards already in the deck. */
  artByName?: Map<string, CardVisual>;
}) {
  if (problems.length === 0) {
    return (
      <p className="text-sm text-muted">
        No major problems detected from the current heuristics. Keep tuning and re-check after changes.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {problems.map((problem) => (
        <li
          key={problem.type}
          className={cn("rounded-2xl border px-4 py-3", SEVERITY_STYLES[problem.severity])}
        >
          <div className="flex items-start gap-2.5">
            <span
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[problem.severity])}
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3 className="font-semibold text-ink">{problem.title}</h3>
                <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                  {problem.severity}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-ink/85">{problem.description}</p>
              {problem.suggestedFix ? (
                <p className="text-sm text-ink/70">
                  <span className="font-medium">Treatment:</span> {problem.suggestedFix}
                </p>
              ) : null}
              {problem.affectedCards.length > 0 ? (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {problem.affectedCards.map((name) => (
                    <li
                      key={name}
                      className="flex w-[7.25rem] flex-col items-center gap-1.5 text-center"
                    >
                      <CardArt
                        name={name}
                        imageUri={artByName?.get(name.toLowerCase())?.imageUri ?? null}
                        prices={artByName?.get(name.toLowerCase())?.prices}
                        size="md"
                      />
                      <span className="line-clamp-2 text-[11px] leading-tight text-ink">{name}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {problem.suggestions && problem.suggestions.length > 0 ? (
                <SuggestionStrip suggestions={problem.suggestions} />
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SuggestionStrip({ suggestions }: { suggestions: AdditionCandidate[] }) {
  return (
    <div className="rounded-xl border border-black/5 bg-black/[0.03] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Try adding</p>
      <ul className="mt-2 flex gap-2.5 overflow-x-auto pb-1">
        {suggestions.map((card) => (
          <li key={card.name} className="flex w-[6.5rem] shrink-0 flex-col items-center gap-1.5 text-center">
            <CardArt
              name={card.name}
              imageUri={card.imageUri}
              prices={card.prices}
              size="md"
            />
            <span className="line-clamp-2 text-[11px] font-medium leading-tight text-ink">
              {card.name}
            </span>
            <span className="line-clamp-2 text-[10px] leading-snug text-muted">
              {card.reasons[card.reasons.length - 1] ?? card.reasons[0]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
