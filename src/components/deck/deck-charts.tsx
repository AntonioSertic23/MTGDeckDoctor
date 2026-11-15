"use client";

import type { Color } from "@/domain/types";
import { cn } from "@/lib/utils";

const CURVE_BUCKETS = ["0", "1", "2", "3", "4", "5", "6", "7+"] as const;

/**
 * Nonland mana curve. One series, so one hue (accent) and no legend; the
 * peak bar is labelled and every bar has a hover/focus tooltip.
 */
export function ManaCurveChart({
  curve,
  averageManaValue,
}: {
  curve: Record<string, number>;
  averageManaValue?: number;
}) {
  const values = CURVE_BUCKETS.map((bucket) => curve[bucket] ?? 0);
  const max = Math.max(1, ...values);
  const peakIndex = values.indexOf(Math.max(...values));
  const total = values.reduce((sum, value) => sum + value, 0);

  return (
    <figure className="space-y-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Mana curve</span>
        <span className="text-xs text-muted">
          {total} nonland{averageManaValue !== undefined ? ` · avg ${averageManaValue}` : ""}
        </span>
      </figcaption>

      <div className="relative h-36" aria-hidden>
        {/* Recessive baseline */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--border)]" />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {values.map((value, index) => {
            const height = value === 0 ? 0 : Math.max(4, (value / max) * 100);
            return (
              <div
                key={CURVE_BUCKETS[index]}
                tabIndex={0}
                className="group relative flex h-full flex-1 items-end justify-center rounded-t-[4px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div
                  className="w-full max-w-10 rounded-t-[4px] bg-accent transition-opacity group-hover:opacity-80"
                  style={{ height: `${height}%` }}
                />
                {index === peakIndex && value > 0 ? (
                  <span
                    className="pointer-events-none absolute text-[11px] font-semibold tabular-nums text-ink group-hover:hidden group-focus-visible:hidden"
                    style={{ bottom: `calc(${height}% + 2px)` }}
                  >
                    {value}
                  </span>
                ) : null}
                <span
                  className="pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-ink shadow-md group-hover:block group-focus-visible:block"
                  style={{ bottom: `calc(${height}% + 4px)` }}
                >
                  <span className="font-semibold tabular-nums">{value}</span> card{value === 1 ? "" : "s"} at
                  MV {CURVE_BUCKETS[index]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-[2px]" aria-hidden>
        {CURVE_BUCKETS.map((bucket) => (
          <span key={bucket} className="flex-1 text-center text-[11px] tabular-nums text-muted">
            {bucket}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>Mana curve, nonland cards by mana value</caption>
        <thead>
          <tr>
            <th scope="col">Mana value</th>
            <th scope="col">Cards</th>
          </tr>
        </thead>
        <tbody>
          {CURVE_BUCKETS.map((bucket, index) => (
            <tr key={bucket}>
              <td>{bucket}</td>
              <td>{values[index]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const PIP_ORDER: Color[] = ["W", "U", "B", "R", "G"];

const PIP_LABEL: Record<Color, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

const PIP_VAR: Record<Color, string> = {
  W: "var(--mana-w)",
  U: "var(--mana-u)",
  B: "var(--mana-b)",
  R: "var(--mana-r)",
  G: "var(--mana-g)",
};

/**
 * Colored mana symbols across all costs. One row per color with the official
 * symbol and a text label, so identity never depends on hue (red/green are
 * hard to separate for deuteranopes).
 */
export function ColorPipsChart({
  pips,
  colorIdentity,
}: {
  pips: Record<Color, number>;
  colorIdentity: Color[];
}) {
  const rows = PIP_ORDER.filter((color) => pips[color] > 0 || colorIdentity.includes(color));
  const total = rows.reduce((sum, color) => sum + pips[color], 0);
  const max = Math.max(1, ...rows.map((color) => pips[color]));

  return (
    <figure className="space-y-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Color pips</span>
        <span className="text-xs text-muted">{total} colored symbols</span>
      </figcaption>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">Colorless deck — no colored symbols.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((color) => {
            const value = pips[color];
            const share = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <li key={color} className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://svgs.scryfall.io/card-symbols/${color}.svg`}
                  crossOrigin="anonymous"
                  alt=""
                  aria-hidden
                  width={18}
                  height={18}
                  className="shrink-0 rounded-full"
                />
                <span className="w-12 shrink-0 text-xs font-medium text-ink">{PIP_LABEL[color]}</span>
                <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-[4px] bg-black/[0.05] dark:bg-white/[0.06]">
                  <div
                    className={cn("h-full rounded-[4px]", value === 0 && "hidden")}
                    style={{ width: `${(value / max) * 100}%`, background: PIP_VAR[color] }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                  {value} · {share}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}
