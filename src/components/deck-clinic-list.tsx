"use client";

import Link from "next/link";
import type { Card, DeckAnalysis, DeckWithCards } from "@/domain/types";
import { CardArt } from "@/components/card-art";
import { HealthMeter } from "@/components/health-meter";
import { HEALTH_STATUS_SOFT_BG, cn, formatRelative, healthStatus } from "@/lib/utils";

export function DeckClinicList({
  decks,
  cards,
  scores,
}: {
  decks: DeckWithCards[];
  cards: Map<string, Card>;
  scores: Record<string, DeckAnalysis>;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {decks.map(({ deck }) => {
        const analysis = scores[deck.id];
        const status = analysis ? healthStatus(analysis.health.overall) : null;
        const commanders = deck.commanderOracleIds
          .map((id) => cards.get(id))
          .filter((c): c is Card => Boolean(c));
        const artSize = commanders.length > 1 ? "xs" : "sm";

        return (
          <li key={deck.id} className="min-w-0">
            <Link
              href={`/decks/${deck.id}`}
              className={cn(
                "relative flex h-full flex-col overflow-hidden rounded-2xl border p-3 transition",
                deck.ready
                  ? "border-emerald-500/50 bg-emerald-500/[0.06] shadow-sm shadow-emerald-500/10 hover:border-emerald-500/70 hover:bg-emerald-500/[0.09]"
                  : "border-[var(--border)] bg-[var(--card)] hover:border-accent/40 hover:bg-accent/[0.03]",
              )}
            >
              {deck.ready ? (
                <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500" aria-hidden />
              ) : null}
              <div className="flex justify-center gap-1.5">
                {commanders.length > 0 ? (
                  commanders.slice(0, 2).map((commander) => (
                    <CardArt
                      key={commander.oracleId}
                      name={commander.name}
                      imageUri={commander.imageUri}
                      prices={commander.prices}
                      size={artSize}
                    />
                  ))
                ) : (
                  <CardArt name="Commander" imageUri={null} size="sm" />
                )}
              </div>

              <div className="mt-3 flex min-w-0 flex-1 flex-col">
                <h3 className="truncate font-semibold text-ink">{deck.name}</h3>
                {deck.ready ? (
                  <span className="mt-1 inline-flex w-fit items-center rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200">
                    Ready
                  </span>
                ) : null}
                <p className="mt-1 line-clamp-2 text-sm text-muted">
                  {commanders.length > 0
                    ? commanders.map((c) => c.name).join(" / ")
                    : "Commander not set"}
                </p>
                <p className="mt-1 text-xs text-muted">Updated {formatRelative(deck.updatedAt)}</p>
                <p className="mt-1 text-xs tabular-nums text-muted">
                  Brought {deck.timesBrought} · Played {deck.timesPlayed}
                </p>
                <div className="mt-auto pt-2">
                  {status ? (
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        HEALTH_STATUS_SOFT_BG[status],
                      )}
                    >
                      {analysis.health.overall}/100
                    </span>
                  ) : (
                    <span className="text-xs text-muted">Analyzing…</span>
                  )}
                  {analysis ? (
                    <div className="mt-2">
                      <HealthMeter health={analysis.health} compact />
                    </div>
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
