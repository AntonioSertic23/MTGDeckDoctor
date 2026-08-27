import type { AdditionCandidate, CutCandidate } from "@/domain/types";
import { CardArt } from "@/components/card-art";
import { formatDeckNames } from "@/domain/recommendations/collection-aware";
import { cn } from "@/lib/utils";

export function CutList({ cuts }: { cuts: CutCandidate[] }) {
  if (cuts.length === 0) {
    return <p className="text-sm text-muted">No strong cut candidates right now.</p>;
  }

  return (
    <ul className="space-y-3">
      {cuts.map((cut, index) => (
        <li key={cut.oracleId} className="flex gap-3 rounded-2xl border border-[var(--border)] p-3">
          <CardArt name={cut.name} imageUri={cut.imageUri} prices={cut.prices} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-ink">
                <span className="mr-2 text-muted">{index + 1}.</span>
                {cut.name}
              </h3>
              <span className="shrink-0 text-sm tabular-nums text-muted">Cut {cut.cutScore}</span>
            </div>
            <CollectionBadges
              ownedCopies={cut.ownedCopies}
              otherDeckNames={cut.otherDeckNames}
            />
            <ul className="mt-2 space-y-1">
              {cut.reasons.map((reason) => (
                <li key={reason} className="text-sm leading-snug text-muted">
                  • {reason}
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AdditionList({ additions }: { additions: AdditionCandidate[] }) {
  if (additions.length === 0) {
    return (
      <p className="text-sm text-muted">
        No clear additions from the current staple pool. Gaps may already be covered.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {additions.map((item) => (
        <li key={item.oracleId ?? item.name} className="flex gap-3 rounded-2xl border border-[var(--border)] p-3">
          <CardArt name={item.name} imageUri={item.imageUri} prices={item.prices} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-ink">{item.name}</h3>
              <span className="shrink-0 text-sm tabular-nums text-accent-strong">+{item.score}</span>
            </div>
            <CollectionBadges
              ownedCopies={item.ownedCopies}
              otherDeckNames={item.otherDeckNames}
              fromCollection={item.fromCollection}
            />
            <ul className="mt-2 space-y-1">
              {item.reasons.map((reason) => (
                <li key={reason} className="text-sm leading-snug text-muted">
                  • {reason}
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CollectionBadges({
  ownedCopies,
  otherDeckNames,
  fromCollection,
}: {
  ownedCopies?: number;
  otherDeckNames?: string[];
  fromCollection?: boolean;
}) {
  const owned = (ownedCopies ?? 0) > 0;
  const elsewhere = (otherDeckNames?.length ?? 0) > 0;
  if (!owned && !elsewhere) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {owned ? (
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
            fromCollection
              ? "bg-accent/15 text-accent-strong"
              : "bg-black/5 text-ink dark:bg-white/10",
          )}
        >
          Own ×{ownedCopies}
        </span>
      ) : null}
      {elsewhere ? (
        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
          In {formatDeckNames(otherDeckNames ?? [])}
        </span>
      ) : null}
    </div>
  );
}