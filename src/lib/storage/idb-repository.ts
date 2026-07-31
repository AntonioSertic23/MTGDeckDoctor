"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Card,
  CardAllocation,
  Deck,
  DeckCard,
  DeckWithCards,
  InventoryItem,
} from "@/domain/types";
import type { DeckRepository } from "@/lib/storage/repository";

const DB_NAME = "mtg-deck-doctor";
const DB_VERSION = 1;

interface StoredDeckCard extends DeckCard {
  id: string;
  deckId: string;
}

interface StoredAllocation extends CardAllocation {
  id: string;
}

interface DoctorDB extends DBSchema {
  decks: { key: string; value: Deck };
  deckCards: { key: string; value: StoredDeckCard; indexes: { byDeck: string } };
  cards: { key: string; value: Card };
  inventory: { key: string; value: InventoryItem };
  allocations: { key: string; value: StoredAllocation; indexes: { byDeck: string } };
}

let dbPromise: Promise<IDBPDatabase<DoctorDB>> | null = null;

function getDb(): Promise<IDBPDatabase<DoctorDB>> {
  dbPromise ??= openDB<DoctorDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("decks", { keyPath: "id" });

      const deckCards = db.createObjectStore("deckCards", { keyPath: "id" });
      deckCards.createIndex("byDeck", "deckId");

      db.createObjectStore("cards", { keyPath: "oracleId" });
      db.createObjectStore("inventory", { keyPath: "oracleId" });

      const allocations = db.createObjectStore("allocations", { keyPath: "id" });
      allocations.createIndex("byDeck", "deckId");
    },
  });
  return dbPromise;
}

const deckCardKey = (deckId: string, oracleId: string) => `${deckId}:${oracleId}`;

export const idbRepository: DeckRepository = {
  async listDecks() {
    const db = await getDb();
    const decks = await db.getAll("decks");
    return decks.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getDeck(id) {
    const db = await getDb();
    const deck = await db.get("decks", id);
    if (!deck) return null;
    const cards = await db.getAllFromIndex("deckCards", "byDeck", id);
    return { deck, cards: cards.map(toDeckCard) };
  },

  async listDecksWithCards() {
    const db = await getDb();
    const decks = await db.getAll("decks");
    const all = await db.getAll("deckCards");

    const byDeck = new Map<string, DeckCard[]>();
    for (const stored of all) {
      const list = byDeck.get(stored.deckId) ?? [];
      list.push(toDeckCard(stored));
      byDeck.set(stored.deckId, list);
    }

    return decks
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((deck) => ({ deck, cards: byDeck.get(deck.id) ?? [] }));
  },

  async createDeck(deck, cards) {
    const db = await getDb();
    const tx = db.transaction(["decks", "deckCards"], "readwrite");
    await tx.objectStore("decks").put(deck);
    const store = tx.objectStore("deckCards");
    for (const card of cards) {
      await store.put({ ...card, id: deckCardKey(deck.id, card.oracleId), deckId: deck.id });
    }
    await tx.done;
  },

  async updateDeck(deck) {
    const db = await getDb();
    await db.put("decks", { ...deck, updatedAt: new Date().toISOString() });
  },

  async setDeckCards(deckId, cards) {
    const db = await getDb();
    const tx = db.transaction("deckCards", "readwrite");
    const store = tx.objectStore("deckCards");

    for (const existing of await store.index("byDeck").getAllKeys(deckId)) {
      await store.delete(existing);
    }
    for (const card of cards) {
      await store.put({ ...card, id: deckCardKey(deckId, card.oracleId), deckId });
    }
    await tx.done;
  },

  async deleteDeck(id) {
    const db = await getDb();
    const tx = db.transaction(["decks", "deckCards", "allocations"], "readwrite");
    await tx.objectStore("decks").delete(id);

    const deckCards = tx.objectStore("deckCards");
    for (const key of await deckCards.index("byDeck").getAllKeys(id)) {
      await deckCards.delete(key);
    }

    const allocations = tx.objectStore("allocations");
    for (const key of await allocations.index("byDeck").getAllKeys(id)) {
      await allocations.delete(key);
    }
    await tx.done;
  },

  async getCards(oracleIds) {
    const db = await getDb();
    const cards = await Promise.all(oracleIds.map((id) => db.get("cards", id)));
    return cards.filter((c): c is Card => c !== undefined);
  },

  async getAllCards() {
    const db = await getDb();
    return db.getAll("cards");
  },

  async saveCards(cards) {
    if (cards.length === 0) return;
    const db = await getDb();
    const tx = db.transaction("cards", "readwrite");
    for (const card of cards) await tx.store.put(card);
    await tx.done;
  },

  async listInventory() {
    const db = await getDb();
    return db.getAll("inventory");
  },

  async setInventoryQuantity(oracleId, quantity) {
    const db = await getDb();
    if (quantity <= 0) await db.delete("inventory", oracleId);
    else await db.put("inventory", { oracleId, quantity });
  },

  async listAllocations() {
    const db = await getDb();
    return db.getAll("allocations");
  },

  async setAllocation(allocation) {
    const db = await getDb();
    const id = deckCardKey(allocation.deckId, allocation.oracleId);
    if (allocation.quantity <= 0) await db.delete("allocations", id);
    else await db.put("allocations", { ...allocation, id });
  },

  async clearAllocation(oracleId, deckId) {
    const db = await getDb();
    await db.delete("allocations", deckCardKey(deckId, oracleId));
  },
};

function toDeckCard(stored: StoredDeckCard): DeckCard {
  return { oracleId: stored.oracleId, quantity: stored.quantity };
}
