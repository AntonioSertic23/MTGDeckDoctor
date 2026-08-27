"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { WandSparkles } from "lucide-react";
import { CardArt } from "@/components/card-art";
import { Button, buttonClassName, EmptyState, PageHeader, Panel, StatChip } from "@/components/ui";
import {
  buildDeckFromCollection,
  isCommanderCandidate,
  type CollectionBuildResult,
} from "@/domain/builder/from-collection";
import { BUILD_TARGETS } from "@/domain/builder/quotas";
import type { Card, Color } from "@/domain/types";
import { saveBuiltDeck } from "@/lib/builder/save-built-deck";
import { useInventory } from "@/lib/hooks/use-repository";
import { cn } from "@/lib/utils";

const COLOR_GLYPH: Record<Color, string> = {
  W: "W",
  U: "U",
  B: "B",
  R: "R",
  G: "G",
};

export default function BuildPage() {
  const router = useRouter();
  const { inventory, cards, loading, error } = useInventory();
  const [query, setQuery] = useState("");
  const [commanderId, setCommanderId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const owned = useMemo(
    () =>
      inventory
        .map((item) => {
          const card = cards.get(item.oracleId);
          return card ? { card, quantity: item.quantity } : null;
        })
        .filter((row): row is { card: Card; quantity: number } => row !== null),
    [inventory, cards],
  );

  const commanders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return owned
      .filter((row) => isCommanderCandidate(row.card))
      .filter((row) => !q || row.card.name.toLowerCase().includes(q))
      .sort((a, b) => a.card.name.localeCompare(b.card.name, undefined, { sensitivity: "base" }));
  }, [owned, query]);

  const commander = commanderId ? cards.get(commanderId) : undefined;

  const result = useMemo<CollectionBuildResult | null>(() => {
    if (!commander) return null;
    return buildDeckFromCollection(commander, owned);
  }, [commander, owned]);

  function save() {
    if (!result) return;
    setSaveError(null);
    startTransition(async () => {
      try {
        const id = await saveBuiltDeck(result);
        router.push(`/decks/${id}`);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Could not save that deck.");
      }
    });
  }

  if (loading) return <p className="text-sm text-muted">Loading collection…</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  if (owned.length === 0) {
    return (
      <div>
        <PageHeader
          eyebrow="From collection"
          title="Build a Commander deck"
          description="Pick a commander you own. The app fills lands, ramp, draw and interaction from the rest of your collection."
        />
        <EmptyState
          title="Import your collection first"
          description="The builder only uses cards you own."
          action={
            <Link href="/collection" className={buttonClassName()}>
              Go to Collection
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="From collection"
        title="Build a Commander deck"
        description="Pick a commander. Quotas (lands, ramp, draw, …) adapt to that commander’s cost, colours and themes. Basics can enter as multiple copies."
      />

      <Panel className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted">Commander</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search legendary creatures you own"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
          />
        </label>
        {commanders.length === 0 ? (
          <p className="text-sm text-muted">No legendary creatures in your collection match that search.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {commanders.slice(0, 48).map(({ card }) => {
              const selected = card.oracleId === commanderId;
              return (
                <li key={card.oracleId}>
                  <button
                    type="button"
                    onClick={() => setCommanderId(card.oracleId)}
                    className={cn(
                      "w-full rounded-xl text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      selected ? "ring-2 ring-accent" : "hover:opacity-90",
                    )}
                  >
                    <CardArt name={card.name} imageUri={card.imageUri} prices={card.prices} size="fill" />
                    <span className="mt-1 block truncate px-0.5 text-[11px] font-medium leading-snug text-ink">
                      {card.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {commanders.length > 48 ? (
          <p className="text-xs text-muted">Showing 48 of {commanders.length}. Type to narrow the list.</p>
        ) : null}
      </Panel>

      {result && commander ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">
                Preview
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
                {commander.name}
              </h2>
              <p className="text-sm text-muted">
                {commander.colorIdentity.length > 0
                  ? commander.colorIdentity.map((c) => COLOR_GLYPH[c]).join(" ")
                  : "Colorless"}
                {" · "}
                {result.totalCards} / {BUILD_TARGETS.deckSize} cards
              </p>
            </div>
            <Button type="button" disabled={pending} onClick={save}>
              <WandSparkles className="h-4 w-4" aria-hidden />
              {pending ? "Saving…" : "Save deck"}
            </Button>
          </div>

          {saveError ? <p className="text-sm text-rose-600">{saveError}</p> : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatChip label="Cards" value={`${result.totalCards}`} />
            {result.quotas.slice(0, 3).map((quota) => (
              <StatChip
                key={quota.id}
                label={quota.label}
                value={`${quota.have}/${quota.want}`}
              />
            ))}
          </div>

          <Panel className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Quotas</h3>
            <ul className="space-y-2">
              {result.quotas.map((quota) => {
                const short = quota.have < quota.want;
                const pct = Math.min(100, Math.round((quota.have / quota.want) * 100));
                return (
                  <li key={quota.id}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-ink">{quota.label}</span>
                      <span className={short ? "text-amber-700 dark:text-amber-300" : "text-muted"}>
                        {quota.have}/{quota.want}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          short ? "bg-amber-500" : "bg-accent",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            {result.gaps.length > 0 ? (
              <p className="pt-1 text-sm text-amber-800 dark:text-amber-200">
                Short on {result.gaps.map((g) => g.label.toLowerCase()).join(", ")} — save anyway, then
                use Adds to fill from staples.
              </p>
            ) : (
              <p className="pt-1 text-sm text-muted">All role quotas met from your collection.</p>
            )}
          </Panel>

          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {result.cards.map((entry) => (
              <li key={entry.card.oracleId} className="min-w-0">
                <CardArt
                  name={entry.card.name}
                  imageUri={entry.card.imageUri}
                  prices={entry.card.prices}
                  size="fill"
                />
                <div className="mt-1 truncate text-[11px] font-medium text-ink">{entry.card.name}</div>
                {entry.quantity > 1 ? (
                  <div className="text-[11px] tabular-nums text-muted">×{entry.quantity}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted">Select a commander above to preview a list.</p>
      )}
    </div>
  );
}
