"use client";

import type { HealthHistoryPoint } from "@/domain/types";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Health score per list version on a fixed 0–100 scale. A single series, so it
 * uses the accent and no legend; each point has a hover/focus tooltip.
 */
export function HealthHistoryChart({ history }: { history: HealthHistoryPoint[] }) {
  const latest = history.at(-1);
  const previous = history.at(-2);
  const delta = latest && previous ? latest.overall - previous.overall : null;

  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Health over time</span>
        {delta !== null ? (
          <span className="text-xs text-muted">
            <span
              className={cn(
                "font-semibold tabular-nums",
                delta > 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : delta < 0
                    ? "text-rose-700 dark:text-rose-400"
                    : "text-ink",
              )}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>{" "}
            since the previous list
          </span>
        ) : null}
      </figcaption>

      {history.length < 2 ? (
        <p className="text-sm text-muted">
          A point is added every time the list changes. Replace the list or swap cards to start a
          trend.
        </p>
      ) : (
        <HistoryPlot history={history} />
      )}
    </figure>
  );
}

function HistoryPlot({ history }: { history: HealthHistoryPoint[] }) {
  const xFor = (index: number) => (history.length === 1 ? 50 : (index / (history.length - 1)) * 100);
  const yFor = (score: number) => 100 - Math.min(100, Math.max(0, score));
  const path = history
    .map((point, index) => `${index === 0 ? "M" : "L"}${xFor(index)},${yFor(point.overall)}`)
    .join(" ");

  return (
    <>
      <div className="relative ml-7 h-28" aria-hidden>
        {/* Recessive grid at 0 / 50 / 100 */}
        {[0, 50, 100].map((tick) => (
          <div
            key={tick}
            className="absolute inset-x-0 h-px bg-[var(--border)]"
            style={{ top: `${yFor(tick)}%` }}
          >
            <span className="absolute -left-7 -translate-y-1/2 text-[10px] tabular-nums text-muted">
              {tick}
            </span>
          </div>
        ))}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <path
            d={path}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {history.map((point, index) => {
          const isLatest = index === history.length - 1;
          return (
            <div
              key={`${point.at}-${index}`}
              tabIndex={0}
              className="group absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ left: `${xFor(index)}%`, top: `${yFor(point.overall)}%` }}
            >
              <span
                className={cn(
                  "block rounded-full bg-accent ring-2 ring-[var(--card)] transition-transform group-hover:scale-125",
                  isLatest ? "h-2.5 w-2.5" : "h-2 w-2",
                )}
              />
              {isLatest ? (
                <span className="pointer-events-none absolute bottom-full mb-0.5 text-[11px] font-semibold tabular-nums text-ink group-hover:hidden group-focus-visible:hidden">
                  {point.overall}
                </span>
              ) : null}
              <span
                className={cn(
                  "pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-ink shadow-md group-hover:block group-focus-visible:block",
                  index === 0 ? "left-0" : isLatest ? "right-0" : "",
                )}
              >
                <span className="font-semibold tabular-nums">{point.overall}</span>/100 ·{" "}
                {formatDate(point.at)}
                <span className="block text-muted">
                  {point.totalCards} cards · avg MV {point.averageManaValue}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>Deck health over time</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Health</th>
            <th scope="col">Cards</th>
            <th scope="col">Average mana value</th>
          </tr>
        </thead>
        <tbody>
          {history.map((point, index) => (
            <tr key={`${point.at}-${index}`}>
              <td>{formatDate(point.at)}</td>
              <td>{point.overall}</td>
              <td>{point.totalCards}</td>
              <td>{point.averageManaValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
