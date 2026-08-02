import type { Card, Deck, DeckCard, DeckWithCards, InventoryItem } from "@/domain/types";
import { normalizeDeck } from "@/domain/decks/normalize";
import { getRepository } from "@/lib/storage";

export const DECK_FILE_VERSION = 1 as const;

export interface DeckExportFile {
  version: typeof DECK_FILE_VERSION;
  exportedAt: string;
  app: "mtg-deck-doctor";
  decks: DeckWithCards[];
  cards: Card[];
  inventory: InventoryItem[];
}

/** Build a downloadable JSON snapshot of one or all decks. */
export async function buildExportPayload(deckIds?: string[]): Promise<DeckExportFile> {
  const all = await getRepository().listDecksWithCards();
  const decks = deckIds ? all.filter((d) => deckIds.includes(d.deck.id)) : all;
  const inventory = await getRepository().listInventory();

  const oracleIds = new Set<string>();
  for (const { cards } of decks) {
    for (const card of cards) oracleIds.add(card.oracleId);
  }
  for (const item of inventory) oracleIds.add(item.oracleId);

  const cards = await getRepository().getCards([...oracleIds]);

  return {
    version: DECK_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    app: "mtg-deck-doctor",
    decks,
    cards,
    inventory: deckIds ? inventory.filter((i) => oracleIds.has(i.oracleId)) : inventory,
  };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportDecksToFile(deckIds?: string[]): Promise<void> {
  const payload = await buildExportPayload(deckIds);
  const stamp = new Date().toISOString().slice(0, 10);
  const name =
    deckIds?.length === 1
      ? `mtg-deck-doctor-${slug(payload.decks[0]?.deck.name ?? "deck")}-${stamp}.json`
      : `mtg-deck-doctor-backup-${stamp}.json`;
  downloadJson(name, payload);
}

/** Import decks/cards from a previously exported JSON file into active storage. */
export async function importDecksFromFile(file: File): Promise<{ imported: number }> {
  const text = await file.text();
  const raw = JSON.parse(text) as DeckExportFile;

  if (!raw || raw.app !== "mtg-deck-doctor" || raw.version !== DECK_FILE_VERSION) {
    throw new Error("This file is not a MTG Deck Doctor export.");
  }
  if (!Array.isArray(raw.decks) || !Array.isArray(raw.cards)) {
    throw new Error("Export file is missing decks or cards.");
  }

  await getRepository().saveCards(raw.cards);

  let imported = 0;
  for (const entry of raw.decks) {
    const deck = sanitizeDeck(entry.deck);
    const cards = sanitizeDeckCards(entry.cards);
    const existing = await getRepository().getDeck(deck.id);
    if (existing) {
      await getRepository().updateDeck(deck);
      await getRepository().setDeckCards(deck.id, cards);
    } else {
      await getRepository().createDeck(deck, cards);
    }
    imported += 1;
  }

  if (Array.isArray(raw.inventory)) {
    for (const item of raw.inventory) {
      if (item?.oracleId && typeof item.quantity === "number") {
        await getRepository().setInventoryQuantity(item.oracleId, item.quantity);
      }
    }
  }

  return { imported };
}

function sanitizeDeck(deck: Deck): Deck {
  return normalizeDeck({
    id: String(deck.id),
    name: String(deck.name || "Imported deck"),
    format: deck.format === "other" ? "other" : "commander",
    commanderOracleIds: Array.isArray(deck.commanderOracleIds)
      ? deck.commanderOracleIds.map(String)
      : [],
    description: deck.description,
    ready: Boolean(deck.ready),
    timesBrought: Math.max(0, Number(deck.timesBrought) || 0),
    timesPlayed: Math.max(0, Number(deck.timesPlayed) || 0),
    createdAt: deck.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analysisSnapshot: null,
  });
}

function sanitizeDeckCards(cards: DeckCard[]): DeckCard[] {
  return (cards ?? [])
    .filter((c) => c?.oracleId && c.quantity > 0)
    .map((c) => ({ oracleId: String(c.oracleId), quantity: Number(c.quantity) }));
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "deck";
}
