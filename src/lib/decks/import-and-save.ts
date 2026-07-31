import { importDeck } from "@/domain/import/text-importer";
import type { Card, Deck, DeckCard } from "@/domain/types";
import { resolveCardLookups } from "@/lib/cards/client";
import { idbRepository } from "@/lib/storage/idb-repository";
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
  await idbRepository.saveCards(cards);

  const byPrinting = new Map<string, Card>();
  const byName = new Map<string, Card>();
  for (const card of cards) {
    byName.set(normalize(card.name), card);
    const front = normalize(card.name.split("//")[0] ?? card.name);
    if (!byName.has(front)) byName.set(front, card);
    if (card.setCode) {
      // Prefer the most recently resolved printing for this set when collector is unknown.
      byPrinting.set(`${normalize(card.name)}|${card.setCode.toLowerCase()}`, card);
    }
  }

  // Re-key printing matches using returned cards — Scryfall includes set + we requested collector.
  // Match imported entries in order against resolved cards with same name+set when possible.
  const unused = [...cards];

  const deckCards = new Map<string, DeckCard>();
  const unresolved: string[] = [...notFound];
  const commanderOracleIds: string[] = [];

  for (const entry of imported.cards) {
    const card = takeCard(entry.name, entry.setCode, unused) ?? matchCard(entry.name, entry.setCode, byName, byPrinting);
    if (!card) {
      if (!unresolved.includes(entry.name)) unresolved.push(entry.name);
      continue;
    }

    const existing = deckCards.get(card.oracleId);
    if (existing) existing.quantity += entry.quantity;
    else deckCards.set(card.oracleId, { oracleId: card.oracleId, quantity: entry.quantity });

    if (entry.isCommander && !commanderOracleIds.includes(card.oracleId)) {
      commanderOracleIds.push(card.oracleId);
    }
  }

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
    resolvedCards: cards,
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
    createdAt: now,
    updatedAt: now,
  };

  await idbRepository.createDeck(deck, resolved.cards);

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
  const existing = await idbRepository.getDeck(deckId);
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

  await idbRepository.updateDeck(deck);
  await idbRepository.setDeckCards(deckId, resolved.cards);

  return {
    deck,
    cards: resolved.cards,
    unresolved: resolved.unresolved,
    ignoredLines: resolved.ignoredLines,
  };
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function takeCard(name: string, setCode: string | undefined, pool: Card[]): Card | undefined {
  const variants = nameVariants(name);
  const index = pool.findIndex((card) => {
    const nameOk = nameVariants(card.name).some((v) => variants.includes(v));
    if (!nameOk) return false;
    if (setCode && card.setCode.toLowerCase() !== setCode.toLowerCase()) return false;
    return true;
  });
  if (index < 0) return undefined;
  return pool.splice(index, 1)[0];
}

function matchCard(
  name: string,
  setCode: string | undefined,
  byName: Map<string, Card>,
  byPrinting: Map<string, Card>,
): Card | undefined {
  if (setCode) {
    const keyed = byPrinting.get(`${normalize(name)}|${setCode.toLowerCase()}`);
    if (keyed) return keyed;
    const front = byPrinting.get(`${normalize(name.split("//")[0] ?? name)}|${setCode.toLowerCase()}`);
    if (front) return front;
  }
  return byName.get(normalize(name)) ?? byName.get(normalize(name.split("//")[0] ?? name));
}

function nameVariants(name: string): string[] {
  const normalized = normalize(name);
  const front = normalized.split("//")[0].trim();
  return front === normalized ? [normalized] : [normalized, front];
}
