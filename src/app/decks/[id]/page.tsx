"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { deckContentKey } from "@/lib/decks/analyze-local";
import { useDeck, useDecksWithCards } from "@/lib/hooks/use-repository";
import { useDeckAnalysis } from "@/lib/hooks/use-deck-analysis";
import { getRepository } from "@/lib/storage";
import { buildSharedCardIndex, findSharedCards } from "@/domain/sharing/shared-cards";
import type { Deck } from "@/domain/types";
import { HealthMeter } from "@/components/health-meter";
import { ProblemList, type CardVisual } from "@/components/problem-list";
import { CutList } from "@/components/recommendation-lists";
import { SharedCardList } from "@/components/shared-card-list";
import { buttonClassName, PageHeader, Panel, SectionTitle, Skeleton } from "@/components/ui";
import { CommanderPanel } from "@/components/commander-panel";
import { useDialog } from "@/components/dialog";
import { useToast } from "@/components/toast";
import { AdditionsTab } from "@/components/deck/additions-tab";
import { CardsTab } from "@/components/deck/cards-tab";
import { DeckActions } from "@/components/deck/deck-actions";
import { ExplainTab } from "@/components/deck/explain-tab";
import { HealthHistoryChart } from "@/components/deck/health-history";
import { NotesTab } from "@/components/deck/notes-tab";
import { OverviewTab } from "@/components/deck/overview-tab";
import { copyDeckToArchidektClipboard, exportDecksToFile } from "@/lib/decks/file-io";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "health", label: "Health" },
  { id: "problems", label: "Problems" },
  { id: "cuts", label: "Cuts" },
  { id: "additions", label: "Adds" },
  { id: "explain", label: "Explain" },
  { id: "cards", label: "Cards" },
  { id: "shared", label: "Shared" },
  { id: "notes", label: "Notes" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return TABS.some((item) => item.id === value);
}

export default function DeckDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialog = useDialog();
  const toast = useToast();

  const tabParam = searchParams.get("tab");
  const tab: TabId = isTabId(tabParam) ? tabParam : "overview";

  const { deck, loading, error, refresh } = useDeck(params.id);
  const { analysis, error: analyzeError, setError, reanalyze, cardsPending } = useDeckAnalysis(deck);
  const { decks, cards, inventory, loading: sharedLoading } = useDecksWithCards(tab === "shared");
  const [deleting, startDelete] = useTransition();
  const [busy, startBusy] = useTransition();

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
      map.set((entry.card.name.split("//")[0] ?? entry.card.name).trim().toLowerCase(), visual);
    }
    for (const addition of analysis.additions) {
      map.set(addition.name.toLowerCase(), {
        imageUri: addition.imageUri ?? null,
        prices: addition.prices ?? null,
      });
    }
    return map;
  }, [analysis]);

  function setTab(next: TabId) {
    const query = new URLSearchParams(searchParams.toString());
    if (next === "overview") query.delete("tab");
    else query.set("tab", next);
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  if (loading) return <DeckPageSkeleton />;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!deck) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Deck not found.</p>
        <Link href="/decks" className={buttonClassName("secondary")}>
          Back to decks
        </Link>
      </div>
    );
  }

  const commanders = analysis?.resolved.commanders ?? [];
  const commanderNames = commanders.map((c) => c.name).join(" / ");
  const actionsDisabled = deleting || busy;

  function patchDeck(patch: Partial<Deck>, success?: string) {
    if (!deck) return;
    startBusy(async () => {
      try {
        await getRepository().updateDeck({ ...deck.deck, ...patch });
        await refresh();
        if (success) toast(success);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not save the deck.", { tone: "error" });
      }
    });
  }

  async function deleteDeck() {
    if (!deck) return;
    const ok = await dialog.confirm({
      title: `Delete “${deck.deck.name}”?`,
      description: "The list, notes and diagnosis are removed. Your collection is not touched.",
      confirmLabel: "Delete deck",
      danger: true,
    });
    if (!ok) return;
    startDelete(async () => {
      try {
        await getRepository().deleteDeck(deck.deck.id);
        toast(`Deleted “${deck.deck.name}”.`);
        router.push("/decks");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not delete the deck.", { tone: "error" });
      }
    });
  }

  async function renameDeck() {
    if (!deck) return;
    const next = await dialog.prompt({
      title: "Rename deck",
      label: "Deck name",
      defaultValue: deck.deck.name,
      confirmLabel: "Rename",
    });
    if (!next || next === deck.deck.name) return;
    patchDeck({ name: next }, "Deck renamed.");
  }

  function exportDeckJson() {
    if (!deck) return;
    startBusy(async () => {
      await exportDecksToFile([deck.deck.id]);
    });
  }

  function copyArchidekt() {
    if (!deck) return;
    startBusy(async () => {
      try {
        await copyDeckToArchidektClipboard(deck.deck.id);
        toast("Decklist copied — paste it into Archidekt.");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not copy decklist.", { tone: "error" });
      }
    });
  }

  function runReanalyze() {
    startBusy(async () => {
      try {
        await reanalyze();
        await refresh();
        toast("Diagnosis updated.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed.");
      }
    });
  }

  function setCommanders(oracleIds: string[]) {
    if (!deck) return;
    const commanderOracleIds = [...new Set(oracleIds.filter(Boolean))].slice(0, 2);
    const primaryName = analysis?.resolved.entries.find(
      (e) => e.card.oracleId === commanderOracleIds[0],
    )?.card.name;
    patchDeck({
      commanderOracleIds,
      name:
        commanderOracleIds.length === 0 || deck.deck.name !== "Untitled deck"
          ? deck.deck.name
          : (primaryName ?? deck.deck.name),
    });
  }

  async function saveNotes(notes: string) {
    if (!deck) return;
    try {
      await getRepository().updateDeck({ ...deck.deck, description: notes || undefined });
      await refresh();
      toast(notes ? "Notes saved." : "Notes cleared.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save notes.", { tone: "error" });
    }
  }

  const history = deck.deck.analysisSnapshot?.history ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        layout="stacked"
        eyebrow="Diagnosis"
        title={deck.deck.name}
        description={
          commanderNames
            ? `Commander deck · led by ${commanderNames}`
            : "Commander deck · commander not set yet — analysis quality will be limited."
        }
        actions={
          <DeckActions
            deckId={deck.deck.id}
            ready={deck.deck.ready}
            disabled={actionsDisabled}
            onToggleReady={() =>
              patchDeck(
                { ready: !deck.deck.ready },
                deck.deck.ready ? "Marked as not ready." : "Marked as ready to play.",
              )
            }
            onCopyArchidekt={copyArchidekt}
            onRename={() => void renameDeck()}
            onCompare={() => router.push(`/decks/compare?a=${deck.deck.id}`)}
            onExport={exportDeckJson}
            onReanalyze={runReanalyze}
            onDelete={() => void deleteDeck()}
          />
        }
      />

      {analysis && !cardsPending ? (
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
        <div
          role="tablist"
          aria-label="Deck sections"
          className="flex min-w-max gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1"
        >
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
                  ? "bg-accent text-white dark:text-[var(--background)]"
                  : "text-muted hover:bg-black/[0.04] hover:text-ink dark:hover:bg-white/[0.05]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "notes" ? (
        <NotesTab
          key={`${deck.deck.id}:${deck.deck.description ?? ""}`}
          savedNotes={deck.deck.description ?? ""}
          disabled={actionsDisabled}
          onSave={saveNotes}
        />
      ) : !analysis ? (
        <div className="space-y-3" aria-busy>
          <p className="text-sm text-muted">
            {deck.deck.analysisSnapshot?.contentKey === deckContentKey(deck)
              ? "Loading cards…"
              : "Running diagnosis…"}
          </p>
          <Skeleton className="h-28" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      ) : (
        <>
          {tab === "overview" ? (
            <OverviewTab
              analysis={analysis}
              cardsPending={cardsPending}
              artByName={artByName}
              onShowHealth={() => setTab("health")}
            />
          ) : null}

          {tab === "health" ? (
            <div className="space-y-4">
              <Panel>
                <HealthMeter
                  health={analysis.analysis.health}
                  suggestionsByCategory={analysis.healthSuggestions}
                />
              </Panel>
              <Panel>
                <HealthHistoryChart history={history} />
              </Panel>
            </div>
          ) : null}

          {tab === "problems" ? (
            <Panel>
              <SectionTitle className="mb-4">Problems</SectionTitle>
              <ProblemList problems={analysis.analysis.problems} artByName={artByName} />
            </Panel>
          ) : null}

          {tab === "cuts" ? (
            <Panel>
              <SectionTitle
                className="mb-4"
                description="Strongest candidates to consider cutting — not automatic removals."
              >
                Suggested cuts
              </SectionTitle>
              <CutList cuts={analysis.analysis.cuts} />
            </Panel>
          ) : null}

          {tab === "additions" ? <AdditionsTab additions={analysis.additions} /> : null}

          {tab === "explain" ? <ExplainTab explanation={analysis.analysis.explanation} /> : null}

          {tab === "cards" ? (
            <CardsTab
              entries={analysis.resolved.entries}
              totalCards={analysis.analysis.statistics.totalCards}
              pending={cardsPending}
            />
          ) : null}

          {tab === "shared" ? (
            <Panel>
              <SectionTitle
                className="mb-4"
                description="Cards in this list that also appear in your other decks."
              >
                Shared with other decks
              </SectionTitle>
              {sharedLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              ) : (
                <SharedCardList items={sharedForDeck} cards={cards} />
              )}
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}

function DeckPageSkeleton() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading deck">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <Skeleton className="h-44" />
      <Skeleton className="h-12" />
      <Skeleton className="h-28" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
