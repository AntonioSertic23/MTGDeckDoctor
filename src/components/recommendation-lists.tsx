import type { AdditionCandidate, CutCandidate } from "@/domain/types";

export function CutList({ cuts }: { cuts: CutCandidate[] }) {
  if (cuts.length === 0) {
    return <p className="text-sm text-muted">No strong cut candidates right now.</p>;
  }

  return (
    <ul className="space-y-3">
      {cuts.map((cut, index) => (
        <li key={cut.oracleId} className="rounded-2xl border border-[var(--border)] px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold text-ink">
              <span className="mr-2 text-muted">{index + 1}.</span>
              {cut.name}
            </h3>
            <span className="shrink-0 text-sm tabular-nums text-muted">Cut {cut.cutScore}</span>
          </div>
          <ul className="mt-2 space-y-1">
            {cut.reasons.map((reason) => (
              <li key={reason} className="text-sm leading-snug text-muted">
                • {reason}
              </li>
            ))}
          </ul>
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
        <li key={item.name} className="rounded-2xl border border-[var(--border)] px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold text-ink">{item.name}</h3>
            <span className="shrink-0 text-sm tabular-nums text-accent-strong">+{item.score}</span>
          </div>
          <ul className="mt-2 space-y-1">
            {item.reasons.map((reason) => (
              <li key={reason} className="text-sm leading-snug text-muted">
                • {reason}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
