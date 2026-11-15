import { analyzeDeck, resolveDeck } from "@/domain/analysis/analyze";
import { DEFAULT_THRESHOLDS } from "@/domain/analysis/health-config";
import { historyPoint, nextHealthHistory } from "@/domain/analysis/history";
import { suggestAdditions } from "@/domain/recommendations/additions";
import {
  buildCollectionContext,
  type CollectionContext,
} from "@/domain/recommendations/collection-aware";
import { suggestCuts } from "@/domain/recommendations/cuts";
import {
  enrichProblemsWithSuggestions,
  suggestionsForHealthCategories,
} from "@/domain/recommendations/problem-suggestions";
import type {
  AdditionCandidate,
  CardPrices,
  DeckAnalysis,
  DeckAnalysisSnapshot,
  DeckWithCards,
  HealthCategoryId,
  Problem,
  ResolvedDeck,
} from "@/domain/types";
import { resolveCardNames } from "@/lib/cards/client";
import { getRepository } from "@/lib/storage";

export interface LocalAnalysis {
  resolved: ResolvedDeck;
  analysis: DeckAnalysis;
  /**
   * Ranked additions. Larger than what the Adds tab shows so a budget filter
   * still has enough cards left to fill the list.
   */
  additions: AdditionCandidate[];
  /** Staple picks for weak health categories (removal, ramp, …). */
  healthSuggestions: Partial<Record<HealthCategoryId, AdditionCandidate[]>>;
}

/** Shown on the Adds tab at once. */
export const ADDITIONS_SHOWN = 12;
/** Computed and stored, so a price cap can still fill `ADDITIONS_SHOWN`. */
const ADDITIONS_POOL = 30;

/** Content fingerprint — changes when cards or commanders change, not on rename. */
export function deckContentKey(deck: DeckWithCards): string {
  // Bump when the analysis payload shape changes (e.g. problem suggestions).
  const version = 7;
  const commanders = [...deck.deck.commanderOracleIds].sort().join("+");
  const cards = [...deck.cards]
    .map((c) => `${c.oracleId}:${c.quantity}`)
    .sort()
    .join(",");
  return `v${version}|${commanders}|${cards}`;
}

/**
 * Returns a cached diagnosis when the list content is unchanged; otherwise runs
 * the analyzer and persists the snapshot.
 *
 * `previousSnapshot` carries health history across flows that clear the stored
 * snapshot before re-analyzing (Replace list).
 */
export async function getCachedOrAnalyzeDeck(
  deck: DeckWithCards,
  options: { force?: boolean; previousSnapshot?: DeckAnalysisSnapshot | null } = {},
): Promise<LocalAnalysis> {
  const key = deckContentKey(deck);
  const snap = deck.deck.analysisSnapshot;

  if (!options.force && snap && snap.contentKey === key) {
    const resolved = await resolveOnly(deck);
    return {
      resolved,
      analysis: snap.analysis,
      additions: snap.additions ?? [],
      healthSuggestions: snap.healthSuggestions ?? {},
    };
  }

  const result = await analyzeDeckLocal(deck);
  const computedAt = new Date().toISOString();
  const snapshot: DeckAnalysisSnapshot = {
    contentKey: key,
    analysis: result.analysis,
    additions: result.additions,
    healthSuggestions: result.healthSuggestions,
    computedAt,
    history: nextHealthHistory(
      options.previousSnapshot ?? snap,
      historyPoint(result.analysis, key, computedAt),
    ),
  };
  await getRepository().saveAnalysisSnapshot(deck.deck.id, snapshot);
  deck.deck.analysisSnapshot = snapshot;
  return result;
}

/** Loads cached cards from storage and runs the pure analyzer pipeline. */
export async function analyzeDeckLocal(deck: DeckWithCards): Promise<LocalAnalysis> {
  const resolved = await resolveOnly(deck);
  const analysis = analyzeDeck(resolved);
  return finishWithCollection(resolved, analysis);
}

async function finishWithCollection(
  resolved: ResolvedDeck,
  analysis: DeckAnalysis,
): Promise<LocalAnalysis> {
  const collection = await loadCollectionContext(resolved);

  const additions = suggestAdditions(
    resolved,
    analysis.statistics,
    analysis.synergy,
    DEFAULT_THRESHOLDS,
    ADDITIONS_POOL,
    collection,
  );

  const cuts = suggestCuts(resolved, analysis.statistics, analysis.synergy, analysis.problems, 12, {
    collection,
  });

  const problems = enrichProblemsWithSuggestions(
    stripSuggestions(analysis.problems),
    resolved,
    analysis.statistics,
    analysis.synergy,
    DEFAULT_THRESHOLDS,
    collection,
  );

  const healthSuggestions = suggestionsForHealthCategories(
    resolved,
    analysis.statistics,
    analysis.synergy,
    analysis.health.categories,
    DEFAULT_THRESHOLDS,
    collection,
  );

  // One lookup for every suggested card instead of one per list.
  const meta = await resolveMetaByName([
    ...additions.map((a) => a.name),
    ...problems.flatMap((p) => (p.suggestions ?? []).map((s) => s.name)),
    ...Object.values(healthSuggestions).flatMap((list) => (list ?? []).map((s) => s.name)),
  ]);

  const withArt = (list: AdditionCandidate[]) => list.map((item) => applyArt(item, meta));

  return {
    resolved,
    analysis: {
      ...analysis,
      cuts,
      problems: problems.map((problem) =>
        problem.suggestions ? { ...problem, suggestions: withArt(problem.suggestions) } : problem,
      ),
    },
    additions: withArt(additions),
    healthSuggestions: Object.fromEntries(
      Object.entries(healthSuggestions).map(([id, list]) => [id, withArt(list ?? [])]),
    ) as Partial<Record<HealthCategoryId, AdditionCandidate[]>>,
  };
}

async function loadCollectionContext(resolved: ResolvedDeck): Promise<CollectionContext | null> {
  const repo = getRepository();
  const [inventory, allDecks] = await Promise.all([
    repo.listInventory(),
    repo.listDecksWithCards(),
  ]);
  if (inventory.length === 0 && allDecks.length <= 1) return null;

  const ownedCards =
    inventory.length > 0 ? await repo.getCards(inventory.map((item) => item.oracleId)) : [];

  return buildCollectionContext(
    resolved.deck.id,
    resolved.entries.map((entry) => entry.card.oracleId),
    inventory,
    ownedCards,
    allDecks,
  );
}

function stripSuggestions(problems: Problem[]): Problem[] {
  return problems.map((problem) => {
    const copy = { ...problem };
    delete copy.suggestions;
    return copy;
  });
}

async function resolveOnly(deck: DeckWithCards): Promise<ResolvedDeck> {
  const oracleIds = deck.cards.map((c) => c.oracleId);
  const cards = await getRepository().getCards(oracleIds);
  const map = new Map(cards.map((c) => [c.oracleId, c]));
  return resolveDeck(deck, map);
}

type CardMeta = { imageUri: string | null; prices: CardPrices };

function applyArt<T extends { name: string; imageUri?: string | null; prices?: CardPrices | null }>(
  item: T,
  meta: Map<string, CardMeta>,
): T {
  const hit = meta.get(normalize(item.name));
  return {
    ...item,
    imageUri: hit?.imageUri ?? item.imageUri ?? null,
    prices: hit?.prices ?? item.prices ?? null,
  };
}

/** Resolve suggestion names so lists can show card images + prices. */
async function resolveMetaByName(names: string[]): Promise<Map<string, CardMeta>> {
  const byName = new Map<string, CardMeta>();
  // Dedupe case-insensitively but send the original spelling.
  const unique = [...new Map(names.map((name) => [normalize(name), name])).values()];
  if (unique.length === 0) return byName;

  try {
    const { cards } = await resolveCardNames(unique);
    for (const card of cards) {
      const meta = { imageUri: card.imageUri, prices: card.prices };
      byName.set(normalize(card.name), meta);
      byName.set(normalize(card.name.split("//")[0] ?? card.name), meta);
    }
  } catch {
    // Offline / Scryfall down — keep text-only suggestions.
  }
  return byName;
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}
