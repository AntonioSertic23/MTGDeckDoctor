import type { AdditionCandidate, DeckHealth, HealthCategory, HealthCategoryId } from "@/domain/types";
import { CardArt } from "@/components/card-art";
import {
  HEALTH_STATUS_BAR,
  HEALTH_STATUS_LABEL,
  HEALTH_STATUS_SOFT_BG,
  HEALTH_STATUS_TEXT,
  cn,
  healthStatus,
} from "@/lib/utils";

export function HealthMeter({
  health,
  compact = false,
  suggestionsByCategory,
}: {
  health: DeckHealth;
  compact?: boolean;
  suggestionsByCategory?: Partial<Record<HealthCategoryId, AdditionCandidate[]>>;
}) {
  const status = healthStatus(health.overall);

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className={cn("text-xs font-medium", HEALTH_STATUS_TEXT[status])}>
              {HEALTH_STATUS_LABEL[status]}
            </span>
            <span className="text-sm font-semibold tabular-nums text-ink">{health.overall}/100</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className={cn("h-full rounded-full transition-all duration-500", HEALTH_STATUS_BAR[status])}
              style={{ width: `${health.overall}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Deck Health</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold tabular-nums tracking-tight text-ink">
            {health.overall}
            <span className="text-xl text-muted">/100</span>
          </p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-sm font-medium", HEALTH_STATUS_SOFT_BG[status])}>
          {HEALTH_STATUS_LABEL[status]}
        </span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all duration-700", HEALTH_STATUS_BAR[status])}
          style={{ width: `${health.overall}%` }}
        />
      </div>

      <p className="text-xs text-muted">
        Heuristic diagnosis, not an objective ranking of whether the deck is “good”.
      </p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {health.categories.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            suggestions={suggestionsByCategory?.[category.id]}
          />
        ))}
      </ul>
    </div>
  );
}

function CategoryRow({
  category,
  suggestions,
}: {
  category: HealthCategory;
  suggestions?: AdditionCandidate[];
}) {
  const status = healthStatus(category.score);
  return (
    <li className="space-y-1.5 rounded-xl border border-[var(--border)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{category.label}</span>
        <span className="text-sm tabular-nums text-muted">{Math.round(category.score)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={cn("h-full rounded-full", HEALTH_STATUS_BAR[status])}
          style={{ width: `${category.score}%` }}
        />
      </div>
      {category.evidence[0] ? (
        <p className="text-xs leading-snug text-muted">{category.evidence[0]}</p>
      ) : null}
      {suggestions && suggestions.length > 0 ? (
        <div className="pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Try adding</p>
          <ul className="mt-1.5 flex gap-2 overflow-x-auto pb-0.5">
            {suggestions.slice(0, 3).map((card) => (
              <li key={card.name} className="flex w-[5.5rem] shrink-0 flex-col items-center gap-1 text-center">
                <CardArt name={card.name} imageUri={card.imageUri} prices={card.prices} size="sm" />
                <span className="line-clamp-2 text-[10px] font-medium leading-tight text-ink">
                  {card.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
