import { analyzeDeck, resolveDeck } from "@/domain/analysis/analyze";
import { suggestAdditions } from "@/domain/recommendations/additions";
import type {
  AdditionCandidate,
  DeckAnalysis,
  DeckAnalysisSnapshot,
  DeckWithCards,
  ResolvedDeck,
} from "@/domain/types";
import { resolveCardNames } from "@/lib/cards/client";
import { getRepository } from "@/lib/storage";

export interface LocalAnalysis {
  resolved: ResolvedDeck;
  analysis: DeckAnalysis;
  additions: AdditionCandidate[];
}

/** Content fingerprint — changes when cards or commanders change, not on rename. */
export function deckContentKey(deck: DeckWithCards): string {
  const commanders = [...deck.deck.commanderOracleIds].sort().join("+");
  const cards = [...deck.cards]
    .map((c) => `${c.oracleId}:${c.quantity}`)
    .sort()
    .join(",");
  return `${commanders}|${cards}`;
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
    return {
      resolved: await resolveOnly(deck),
      analysis: snap.analysis,
      additions: snap.additions,
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

  return { resolved, analysis, additions };
}

async function resolveOnly(deck: DeckWithCards): Promise<ResolvedDeck> {
  const oracleIds = deck.cards.map((c) => c.oracleId);
  const cards = await getRepository().getCards(oracleIds);
  const map = new Map(cards.map((c) => [c.oracleId, c]));
  return resolveDeck(deck, map);
}

/** Resolve staple suggestion names so Cuts/Adds can show card images. */
async function withAdditionArt(additions: AdditionCandidate[]): Promise<AdditionCandidate[]> {
  if (additions.length === 0) return additions;

  try {
    const { cards } = await resolveCardNames(additions.map((a) => a.name));
    await getRepository().saveCards(cards);

    const byName = new Map<string, string | null>();
    for (const card of cards) {
      byName.set(normalize(card.name), card.imageUri);
      byName.set(normalize(card.name.split("//")[0] ?? card.name), card.imageUri);
    }

    return additions.map((addition) => ({
      ...addition,
      imageUri: byName.get(normalize(addition.name)) ?? null,
    }));
  } catch {
    return additions;
  }
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}
