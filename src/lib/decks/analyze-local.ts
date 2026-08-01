import { analyzeDeck, resolveDeck } from "@/domain/analysis/analyze";
import { suggestAdditions } from "@/domain/recommendations/additions";
import { suggestionsForHealthCategories } from "@/domain/recommendations/problem-suggestions";
import type {
  AdditionCandidate,
  CardPrices,
  DeckAnalysis,
  DeckAnalysisSnapshot,
  DeckWithCards,
  HealthCategoryId,
  ResolvedDeck,
} from "@/domain/types";
import { resolveCardNames } from "@/lib/cards/client";
import { getRepository } from "@/lib/storage";

export interface LocalAnalysis {
  resolved: ResolvedDeck;
  analysis: DeckAnalysis;
  additions: AdditionCandidate[];
  /** Staple picks for weak health categories (removal, ramp, …). */
  healthSuggestions: Partial<Record<HealthCategoryId, AdditionCandidate[]>>;
}

/** Content fingerprint — changes when cards or commanders change, not on rename. */
export function deckContentKey(deck: DeckWithCards): string {
  // Bump when the analysis payload shape changes (e.g. problem suggestions).
  const version = 3;
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
 */
export async function getCachedOrAnalyzeDeck(
  deck: DeckWithCards,
  options: { force?: boolean } = {},
): Promise<LocalAnalysis> {
  const key = deckContentKey(deck);
  const snap = deck.deck.analysisSnapshot;

  if (!options.force && snap && snap.contentKey === key) {
    const resolved = await resolveOnly(deck);
    const problems = await hydrateProblemSuggestionArt(snap.analysis.problems);
    const healthSuggestions = await withHealthSuggestionArt(
      suggestionsForHealthCategories(
        resolved,
        snap.analysis.statistics,
        snap.analysis.synergy,
        snap.analysis.health.categories,
      ),
    );
    return {
      resolved,
      analysis: { ...snap.analysis, problems },
      additions: await withAdditionArt(snap.additions),
      healthSuggestions,
    };
  }

  const result = await analyzeDeckLocal(deck);
  const snapshot: DeckAnalysisSnapshot = {
    contentKey: key,
    analysis: result.analysis,
    additions: result.additions,
    computedAt: new Date().toISOString(),
  };
  await getRepository().saveAnalysisSnapshot(deck.deck.id, snapshot);
  deck.deck.analysisSnapshot = snapshot;
  return result;
}

/** Loads cached cards from storage and runs the pure analyzer pipeline. */
export async function analyzeDeckLocal(deck: DeckWithCards): Promise<LocalAnalysis> {
  const resolved = await resolveOnly(deck);
  const analysis = analyzeDeck(resolved);
  const rawAdditions = suggestAdditions(resolved, analysis.statistics, analysis.synergy);
  const additions = await withAdditionArt(rawAdditions);

  const problemsWithArt = await hydrateProblemSuggestionArt(analysis.problems);
  analysis.problems = problemsWithArt;

  const healthSuggestions = await withHealthSuggestionArt(
    suggestionsForHealthCategories(
      resolved,
      analysis.statistics,
      analysis.synergy,
      analysis.health.categories,
    ),
  );

  return { resolved, analysis, additions, healthSuggestions };
}

async function resolveOnly(deck: DeckWithCards): Promise<ResolvedDeck> {
  const oracleIds = deck.cards.map((c) => c.oracleId);
  const cards = await getRepository().getCards(oracleIds);
  const map = new Map(cards.map((c) => [c.oracleId, c]));
  return resolveDeck(deck, map);
}

async function hydrateProblemSuggestionArt(
  problems: DeckAnalysis["problems"],
): Promise<DeckAnalysis["problems"]> {
  const names = problems.flatMap((p) => (p.suggestions ?? []).map((s) => s.name));
  if (names.length === 0) return problems;
  const meta = await resolveMetaByName(names);
  return problems.map((problem) => ({
    ...problem,
    suggestions: problem.suggestions?.map((s) => {
      const hit = meta.get(normalize(s.name));
      return {
        ...s,
        imageUri: hit?.imageUri ?? s.imageUri ?? null,
        prices: hit?.prices ?? s.prices ?? null,
      };
    }),
  }));
}

async function withHealthSuggestionArt(
  byCategory: Partial<Record<HealthCategoryId, AdditionCandidate[]>>,
): Promise<Partial<Record<HealthCategoryId, AdditionCandidate[]>>> {
  const names = Object.values(byCategory).flatMap((list) => (list ?? []).map((s) => s.name));
  if (names.length === 0) return byCategory;
  const meta = await resolveMetaByName(names);
  const next: Partial<Record<HealthCategoryId, AdditionCandidate[]>> = {};
  for (const [id, list] of Object.entries(byCategory) as [
    HealthCategoryId,
    AdditionCandidate[] | undefined,
  ][]) {
    if (!list) continue;
    next[id] = list.map((s) => {
      const hit = meta.get(normalize(s.name));
      return {
        ...s,
        imageUri: hit?.imageUri ?? s.imageUri ?? null,
        prices: hit?.prices ?? s.prices ?? null,
      };
    });
  }
  return next;
}

/** Resolve staple suggestion names so Cuts/Adds can show card images + prices. */
async function withAdditionArt(additions: AdditionCandidate[]): Promise<AdditionCandidate[]> {
  if (additions.length === 0) return additions;
  const meta = await resolveMetaByName(additions.map((a) => a.name));
  return additions.map((addition) => {
    const hit = meta.get(normalize(addition.name));
    return {
      ...addition,
      imageUri: hit?.imageUri ?? addition.imageUri ?? null,
      prices: hit?.prices ?? addition.prices ?? null,
    };
  });
}

async function resolveMetaByName(
  names: string[],
): Promise<Map<string, { imageUri: string | null; prices: CardPrices }>> {
  const byName = new Map<string, { imageUri: string | null; prices: CardPrices }>();
  if (names.length === 0) return byName;

  try {
    const { cards } = await resolveCardNames(names);
    await getRepository().saveCards(cards);
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
