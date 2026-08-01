"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { LocalAnalysis } from "@/lib/decks/analyze-local";
import { getCachedOrAnalyzeDeck } from "@/lib/decks/analyze-local";
import { useDeck, useDecksWithCards } from "@/lib/hooks/use-repository";
import { getRepository } from "@/lib/storage";
import { buildSharedCardIndex, findSharedCards } from "@/domain/sharing/shared-cards";
import { HealthMeter } from "@/components/health-meter";
import { ProblemList, type CardVisual } from "@/components/problem-list";
import { AdditionList, CutList } from "@/components/recommendation-lists";
import { SharedCardList } from "@/components/shared-card-list";
import { Button, buttonClassName, PageHeader, Panel, StatChip } from "@/components/ui";
import { CardArt } from "@/components/card-art";
import { CommanderPanel } from "@/components/commander-panel";
import { exportDecksToFile } from "@/lib/decks/file-io";
import { cn, formatCardPrices } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "health", label: "Health" },
  { id: "problems", label: "Problems" },
  { id: "cuts", label: "Cuts" },
  { id: "additions", label: "Adds" },
  { id: "explain", label: "Explain" },
  { id: "cards", label: "Cards" },
  { id: "shared", label: "Shared" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DeckDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { deck, loading, error, refresh } = useDeck(params.id);
  const { decks, cards, inventory } = useDecksWithCards();
  const [analysis, setAnalysis] = useState<LocalAnalysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [deleting, startDelete] = useTransition();
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!deck) return;
      try {
        setAnalyzeError(null);
        const result = await getCachedOrAnalyzeDeck(deck);
        if (!cancelled) setAnalysis(result);
      } catch (err) {
        if (!cancelled) {
          setAnalyzeError(err instanceof Error ? err.message : "Analysis failed.");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [deck]);

  const sharedForDeck = useMemo(() => {
    if (!deck) return [];
    const usage = buildSharedCardIndex(decks, cards, inventory);
    return findSharedCards(usage).filter((u) => u.deckIds.includes(deck.deck.id));
  }, [deck, decks, cards, inventory]);

  const artByName = useMemo(() => {
    const map = new Map<string, CardVisual>();
    if (!analysis) return map;
    for (const entry of analysis.resolved.entries) {
      const visual: CardVisual = { imageUri: entry.card.imageUri, prices: entry.card.prices };
      map.set(entry.card.name.toLowerCase(), visual);
      map.set(
        (entry.card.name.split("//")[0] ?? entry.card.name).trim().toLowerCase(),
        visual,
      );
    }
    for (const addition of analysis.additions) {
      map.set(addition.name.toLowerCase(), {
        imageUri: addition.imageUri ?? null,
        prices: addition.prices ?? null,
      });
    }
    return map;
  }, [analysis]);

  if (loading) return <p className="text-sm text-muted">Loading deck…</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!deck) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Deck not found in this browser.</p>
        <Link href="/decks" className={buttonClassName("secondary")}>
          Back to decks
        </Link>
      </div>
    );
  }

  const stats = analysis?.analysis.statistics;
  const commanders = analysis?.resolved.commanders ?? [];
  const commanderNames = commanders.map((c) => c.name).join(" / ");

  function deleteDeck() {
    if (!deck) return;
    if (!window.confirm(`Delete “${deck.deck.name}”? This only removes it from this browser.`)) return;
    startDelete(async () => {
      await getRepository().deleteDeck(deck.deck.id);
      router.push("/decks");
    });
  }

  function exportDeck() {
    if (!deck) return;
    startBusy(async () => {
      await exportDecksToFile([deck.deck.id]);
    });
  }

  async function renameDeck() {
    if (!deck) return;
    const next = window.prompt("Deck name", deck.deck.name);
    if (!next || next.trim() === deck.deck.name) return;
    await getRepository().updateDeck({ ...deck.deck, name: next.trim() });
    await refresh();
  }

  function setCommanders(oracleIds: string[]) {
    if (!deck) return;
    startBusy(async () => {
      const commanderOracleIds = [...new Set(oracleIds.filter(Boolean))].slice(0, 2);
      const primaryName = analysis?.resolved.entries.find(
        (e) => e.card.oracleId === commanderOracleIds[0],
      )?.card.name;
      await getRepository().updateDeck({
        ...deck.deck,
        commanderOracleIds,
        name:
          commanderOracleIds.length === 0 || deck.deck.name !== "Untitled deck"
            ? deck.deck.name
            : (primaryName ?? deck.deck.name),
      });
      await refresh();
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Diagnosis"
        title={deck.deck.name}
        description={
          commanderNames
            ? `Commander deck · led by ${commanderNames}`
            : "Commander deck · commander not set yet — analysis quality will be limited."
        }
        actions={
          <>
            <Link href={`/decks/new?replace=${deck.deck.id}`} className={buttonClassName("secondary")}>
              Replace list
            </Link>
            <Button variant="secondary" onClick={renameDeck} disabled={deleting || busy}>
              Rename
            </Button>
            <Button variant="secondary" onClick={exportDeck} disabled={deleting || busy}>
              Export JSON
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!deck) return;
                startBusy(async () => {
                  try {
                    setAnalyzeError(null);
                    const result = await getCachedOrAnalyzeDeck(deck, { force: true });
                    setAnalysis(result);
                    await refresh();
                  } catch (err) {
                    setAnalyzeError(err instanceof Error ? err.message : "Analysis failed.");
                  }
                });
              }}
              disabled={deleting || busy}
            >
              Re-analyze
            </Button>
            <Button variant="danger" onClick={deleteDeck} disabled={deleting || busy}>
              Delete
            </Button>
          </>
        }
      />

      {analysis ? (
        <CommanderPanel
          commanders={commanders}
          candidates={analysis.resolved.entries}
          missing={commanders.length === 0}
          pending={busy}
          onSetCommanders={setCommanders}
        />
      ) : null}
      {analyzeError ? <p className="text-sm text-rose-600">{analyzeError}</p> : null}
      {analysis?.analysis.unresolved.length ? (
        <Panel className="border-amber-500/30 bg-amber-500/5">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {analysis.analysis.unresolved.length} card name(s) could not be resolved and were skipped.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
            {analysis.analysis.unresolved.join(", ")}
          </p>
        </Panel>
      ) : null}

      <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium transition",
                tab === item.id
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-black/[0.04] hover:text-ink dark:hover:bg-white/[0.05]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {!analysis ? (
        <p className="text-sm text-muted">Running diagnosis…</p>
      ) : (
        <>
          {tab === "overview" ? (
            <div className="space-y-4">
              <Panel>
                <HealthMeter
                  health={analysis.analysis.health}
                  suggestionsByCategory={analysis.healthSuggestions}
                />
              </Panel>
              {stats ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatChip label="Cards" value={stats.totalCards} />
                  <StatChip label="Lands" value={stats.landCount} />
                  <StatChip label="Avg MV" value={stats.averageManaValue} />
                  <StatChip label="Problems" value={analysis.analysis.problems.length} />
                </div>
              ) : null}
              <Panel>
                <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold">
                  Top problems
                </h2>
                <ProblemList
                  problems={analysis.analysis.problems.slice(0, 3)}
                  artByName={artByName}
                />
              </Panel>
            </div>
          ) : null}

          {tab === "health" ? (
            <Panel>
              <HealthMeter
                health={analysis.analysis.health}
                suggestionsByCategory={analysis.healthSuggestions}
              />
            </Panel>
          ) : null}

          {tab === "problems" ? (
            <Panel>
              <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">Problems</h2>
              <ProblemList problems={analysis.analysis.problems} artByName={artByName} />
            </Panel>
          ) : null}

          {tab === "cuts" ? (
            <Panel>
              <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl font-semibold">
                Suggested cuts
              </h2>
              <p className="mb-4 text-sm text-muted">
                Strongest candidates to consider cutting — not automatic removals.
              </p>
              <CutList cuts={analysis.analysis.cuts} />
            </Panel>
          ) : null}

          {tab === "additions" ? (
            <Panel>
              <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl font-semibold">
                Suggested additions
              </h2>
              <p className="mb-4 text-sm text-muted">
                Ranked from role gaps and theme fit inside a curated staple pool.
              </p>
              <AdditionList additions={analysis.additions} />
            </Panel>
          ) : null}

          {tab === "explain" ? (
            <Panel className="space-y-4">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Explain my deck
              </h2>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent-strong">
                  {analysis.analysis.explanation.profile.primaryArchetype}
                </span>
                {analysis.analysis.explanation.profile.secondaryArchetype ? (
                  <span className="rounded-full bg-black/5 px-3 py-1 text-sm font-medium text-muted dark:bg-white/10">
                    {analysis.analysis.explanation.profile.secondaryArchetype}
                  </span>
                ) : null}
              </div>
              <p className="text-base leading-relaxed text-ink">
                {analysis.analysis.explanation.narrative}
              </p>
              {analysis.analysis.explanation.profile.keyMechanics.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-ink">Key mechanics</h3>
                  <p className="mt-1 text-sm text-muted">
                    {analysis.analysis.explanation.profile.keyMechanics.join(" · ")}
                  </p>
                </div>
              ) : null}
            </Panel>
          ) : null}

          {tab === "cards" ? (
            <Panel>
              <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl font-semibold">
                Cards
              </h2>
              <p className="mb-4 text-sm text-muted">
                {analysis.resolved.entries.length} unique · {stats?.totalCards ?? "—"} total
              </p>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...analysis.resolved.entries]
                  .sort((a, b) => a.card.name.localeCompare(b.card.name))
                  .map((entry) => (
                    <li
                      key={entry.card.oracleId}
                      className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-3 sm:flex-row"
                    >
                      <div className="mx-auto shrink-0 sm:mx-0">
                        <CardArt
                          name={entry.card.name}
                          imageUri={entry.card.imageUri}
                          prices={entry.card.prices}
                          size="lg"
                        />
                      </div>
                      <div className="min-w-0 flex-1 py-0.5 text-center sm:text-left">
                        <p className="font-medium leading-snug text-ink">
                          {entry.quantity > 1 ? `${entry.quantity}× ` : null}
                          {entry.card.name}
                          {entry.isCommander ? (
                            <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-accent-strong">
                              Cmdr
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs text-muted">{entry.card.typeLine}</p>
                        <p className="mt-1 text-xs text-muted">
                          {entry.roles.slice(0, 3).join(" · ") || "—"}
                        </p>
                        <p className="mt-2 text-sm tabular-nums text-ink-muted">
                          {entry.card.manaCost ?? "—"}
                          {formatCardPrices(entry.card.prices)
                            ? ` · ${formatCardPrices(entry.card.prices)}`
                            : null}
                        </p>
                      </div>
                    </li>
                  ))}
              </ul>
            </Panel>
          ) : null}

          {tab === "shared" ? (
            <Panel>
              <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl font-semibold">
                Shared with other decks
              </h2>
              <p className="mb-4 text-sm text-muted">
                Cards in this list that also appear elsewhere in your browser library.
              </p>
              <SharedCardList items={sharedForDeck} cards={cards} />
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}
