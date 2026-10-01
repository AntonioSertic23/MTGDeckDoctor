import { pickPrinting, type MatchMode } from "@/domain/import/match-printing";
import { importDeck } from "@/domain/import/text-importer";
import type { Card, Deck, DeckCard } from "@/domain/types";
import { resolveCardLookups } from "@/lib/cards/client";
import { getCachedOrAnalyzeDeck } from "@/lib/decks/analyze-local";
import { getRepository } from "@/lib/storage";
import { createId } from "@/lib/utils";

export interface ImportResult {
  deck: Deck;
  cards: DeckCard[];
  unresolved: string[];
  ignoredLines: string[];
}

export interface ResolveDecklistResult {
  cards: DeckCard[];
  commanderOracleIds: string[];
  unresolved: string[];
  ignoredLines: string[];
  resolvedCards: Card[];
}

/** Parse + resolve a pasted list without writing a deck yet. */
export async function resolveDecklistText(text: string): Promise<ResolveDecklistResult> {
  const imported = await importDeck(text);
  if (imported.cards.length === 0) {
    throw new Error("No cards found in that decklist. Check the format and try again.");
  }

  const { cards, notFound } = await resolveCardLookups(
    imported.cards.map((c) => ({
      name: c.name,
      setCode: c.setCode,
      collectorNumber: c.collectorNumber,
    })),
  );

  const deckCards = new Map<string, DeckCard>();
  const chosen = new Map<string, { card: Card; mode: MatchMode }>();
  const unresolved: string[] = [...notFound];
  const commanderOracleIds: string[] = [];

  for (const entry of imported.cards) {
    const picked = pickPrinting(entry, cards);
    if (!picked) {
      if (!unresolved.includes(entry.name)) unresolved.push(entry.name);
      continue;
    }

    const { card, mode } = picked;
    const previous = chosen.get(card.oracleId);
    if (!previous || modeRank(mode) > modeRank(previous.mode)) {
      chosen.set(card.oracleId, { card, mode });
    }

    const existing = deckCards.get(card.oracleId);
    if (existing) existing.quantity += entry.quantity;
    else deckCards.set(card.oracleId, { oracleId: card.oracleId, quantity: entry.quantity });

    if (entry.isCommander && !commanderOracleIds.includes(card.oracleId)) {
      commanderOracleIds.push(card.oracleId);
    }
  }

  await persistChosenPrintings(chosen);

  if (deckCards.size === 0) {
    throw new Error(
      `None of the ${imported.cards.length} card name(s) could be resolved. Check the list format (Archidekt/Moxfield plain text works best).`,
    );
  }

  return {
    cards: [...deckCards.values()],
    commanderOracleIds,
    unresolved,
    ignoredLines: imported.ignoredLines,
    resolvedCards: [...chosen.values()].map((pick) => pick.card),
  };
}

/**
 * Parse a pasted list, resolve names through the API, cache cards locally,
 * and persist the deck. Analysis stays a separate pure step.
 */
export async function importAndSaveDeck(
  text: string,
  options: { name?: string } = {},
): Promise<ImportResult> {
  const resolved = await resolveDecklistText(text);
  const commanderName = resolved.resolvedCards.find(
    (c) => c.oracleId === resolved.commanderOracleIds[0],
  )?.name;
  const now = new Date().toISOString();
  const deckName = options.name?.trim() || commanderName || "Untitled deck";

  const deck: Deck = {
    id: createId(),
    name: deckName,
    format: "commander",
    commanderOracleIds: resolved.commanderOracleIds,
    ready: false,
    timesBrought: 0,
    timesPlayed: 0,
    createdAt: now,
    updatedAt: now,
  };

  await getRepository().createDeck(deck, resolved.cards);
  // Warm analysis cache so Home does not show "Analyzing…" on first visit.
  try {
    await getCachedOrAnalyzeDeck({ deck, cards: resolved.cards });
  } catch {
    // Analysis can retry when the user opens the deck / home.
  }

  return {
    deck,
    cards: resolved.cards,
    unresolved: resolved.unresolved,
    ignoredLines: resolved.ignoredLines,
  };
}

/** Replace an existing deck's card list (and optionally rename / update commanders). */
export async function replaceDeckList(
  deckId: string,
  text: string,
  options: { name?: string } = {},
): Promise<ImportResult> {
  const existing = await getRepository().getDeck(deckId);
  if (!existing) throw new Error("Deck not found.");

  const resolved = await resolveDecklistText(text);
  const now = new Date().toISOString();
  const deck: Deck = {
    ...existing.deck,
    name: options.name?.trim() || existing.deck.name,
    commanderOracleIds:
      resolved.commanderOracleIds.length > 0
        ? resolved.commanderOracleIds
        : existing.deck.commanderOracleIds,
    updatedAt: now,
  };

  await getRepository().updateDeck(deck);
  await getRepository().setDeckCards(deckId, resolved.cards);
  try {
    await getCachedOrAnalyzeDeck({ deck: { ...deck, analysisSnapshot: null }, cards: resolved.cards });
  } catch {
    // Analysis can retry when the user opens the deck / home.
  }

  return {
    deck,
    cards: resolved.cards,
    unresolved: resolved.unresolved,
    ignoredLines: resolved.ignoredLines,
  };
}

function modeRank(mode: MatchMode): number {
  return mode === "exact" ? 3 : mode === "set" ? 2 : 1;
}

async function persistChosenPrintings(chosen: Map<string, { card: Card; mode: MatchMode }>): Promise<void> {
  if (chosen.size === 0) return;
  const existing = await getRepository().getCards([...chosen.keys()]);
  const existingIds = new Set(existing.map((card) => card.oracleId));
  const toSave: Card[] = [];
  for (const [oracleId, pick] of chosen) {
    // Name-only resolves must not replace a printing already stored (collection or a previous list).
    if (pick.mode === "name" && existingIds.has(oracleId)) continue;
    toSave.push(pick.card);
  }
  await getRepository().saveCards(toSave);
}
