"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Card, Deck, DeckWithCards, InventoryItem } from "@/domain/types";
import { resolveCardsByOracleIds } from "@/lib/cards/client";
import { getRepository } from "@/lib/storage";

interface LibraryCache {
  decks: DeckWithCards[];
  cards: Map<string, Card>;
  inventory: InventoryItem[];
}

interface ShelfCache {
  decks: Deck[];
  cards: Map<string, Card>;
}

let libraryCache: LibraryCache | null = null;
let shelfCache: ShelfCache | null = null;
let inventoryCache: { inventory: InventoryItem[]; cards: Map<string, Card> } | null = null;

function rememberLibrary(next: LibraryCache) {
  libraryCache = next;
}

function rememberShelf(next: ShelfCache) {
  shelfCache = next;
}

/**
 * Fetches art for cards that are missing locally or have no image, saves them,
 * and returns an updated map — or null when nothing changed. Failures (offline,
 * Scryfall down) are swallowed: callers keep what they already have.
 */
async function hydrateMissingArt(
  oracleIds: string[],
  cardMap: Map<string, Card>,
): Promise<Map<string, Card> | null> {
  const missing = oracleIds.filter((id) => !cardMap.get(id)?.imageUri);
  if (missing.length === 0) return null;
  try {
    const hydrated = await resolveCardsByOracleIds(missing);
    if (hydrated.length === 0) return null;
    await getRepository().saveCards(hydrated);
    const next = new Map(cardMap);
    for (const card of hydrated) next.set(card.oracleId, card);
    return next;
  } catch {
    return null;
  }
}

/** Drop in-memory card art so the next page load reads printings just saved. */
export function invalidateStoredCardCaches(): void {
  libraryCache = null;
  shelfCache = null;
  inventoryCache = null;
}

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const list = await getRepository().listDecks();
      setDecks(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load decks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { decks, loading, error, refresh };
}

/** Deck rows plus commander art. Does not download every card in every list. */
export function useDeckShelf() {
  const [decks, setDecks] = useState<Deck[]>(() => shelfCache?.decks ?? []);
  const [cards, setCards] = useState<Map<string, Card>>(() => shelfCache?.cards ?? new Map());
  const [loading, setLoading] = useState(!shelfCache);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const repo = getRepository();
      const list = await repo.listDecks();
      const commanderIds = [...new Set(list.flatMap((deck) => deck.commanderOracleIds))];
      const commanderCards = await repo.getCards(commanderIds);
      const cardMap = new Map(commanderCards.map((card) => [card.oracleId, card]));
      rememberShelf({ decks: list, cards: cardMap });
      setDecks(list);
      setCards(cardMap);
      setLoading(false);

      const withArt = await hydrateMissingArt(commanderIds, cardMap);
      if (withArt) {
        rememberShelf({ decks: list, cards: withArt });
        setCards(withArt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load decks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { decks, cards, loading, error, refresh };
}

export function useDecksWithCards(enabled = true) {
  const [decks, setDecks] = useState<DeckWithCards[]>(() => libraryCache?.decks ?? []);
  const [cards, setCards] = useState<Map<string, Card>>(() => libraryCache?.cards ?? new Map());
  const [inventory, setInventory] = useState<InventoryItem[]>(() => libraryCache?.inventory ?? []);
  const [loading, setLoading] = useState(enabled && !libraryCache);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setError(null);
      const repo = getRepository();
      const [list, inv] = await Promise.all([repo.listDecksWithCards(), repo.listInventory()]);

      const neededIds = new Set<string>();
      for (const { cards: deckCards } of list) {
        for (const deckCard of deckCards) neededIds.add(deckCard.oracleId);
      }
      for (const item of inv) neededIds.add(item.oracleId);

      const allCards = await repo.getCards([...neededIds]);
      const cardMap = new Map(allCards.map((c) => [c.oracleId, c]));
      const next = { decks: list, cards: cardMap, inventory: inv };
      rememberLibrary(next);
      setDecks(list);
      setCards(cardMap);
      setInventory(inv);
      setLoading(false);

      const withArt = await hydrateMissingArt([...neededIds], cardMap);
      if (withArt) {
        rememberLibrary({ decks: list, cards: withArt, inventory: inv });
        setCards(withArt);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
            ? (err as { message: string }).message
            : "Could not load data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!libraryCache) setLoading(true);
    void refresh();
  }, [enabled, refresh]);

  return { decks, cards, inventory, loading, error, refresh };
}

export function useDeck(id: string) {
  const [deck, setDeck] = useState<DeckWithCards | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeId = useRef(id);
  activeId.current = id;

  const refresh = useCallback(async () => {
    const requestId = id;
    if (!requestId) {
      setDeck(null);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const result = await getRepository().getDeck(requestId);
      if (activeId.current !== requestId) return;
      setDeck(result);
    } catch (err) {
      if (activeId.current !== requestId) return;
      setError(err instanceof Error ? err.message : "Could not load deck.");
    } finally {
      if (activeId.current === requestId) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setDeck(null);
    setLoading(true);
    void refresh();
  }, [refresh]);

  return { deck, loading, error, refresh, setDeck };
}

/** Inventory + card cache for the Collection page (no deck lists). */
export function useInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>(() => inventoryCache?.inventory ?? []);
  const [cards, setCards] = useState<Map<string, Card>>(() => inventoryCache?.cards ?? new Map());
  const [loading, setLoading] = useState(!inventoryCache);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const repo = getRepository();
      const inv = await repo.listInventory();
      const neededIds = inv.map((item) => item.oracleId);
      const allCards = await repo.getCards(neededIds);
      const cardMap = new Map(allCards.map((c) => [c.oracleId, c]));
      inventoryCache = { inventory: inv, cards: cardMap };
      setInventory(inv);
      setCards(cardMap);
      setLoading(false);

      const withArt = await hydrateMissingArt(neededIds, cardMap);
      if (withArt) {
        inventoryCache = { inventory: inv, cards: withArt };
        setCards(withArt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load collection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setQuantity = useCallback(
    async (oracleId: string, quantity: number) => {
      setInventory((prev) => {
        const next =
          quantity <= 0
            ? prev.filter((item) => item.oracleId !== oracleId)
            : prev.some((item) => item.oracleId === oracleId)
              ? prev.map((item) => (item.oracleId === oracleId ? { oracleId, quantity } : item))
              : [...prev, { oracleId, quantity }];
        if (inventoryCache) inventoryCache = { ...inventoryCache, inventory: next };
        return next;
      });
      try {
        await getRepository().setInventoryQuantity(oracleId, quantity);
      } catch (err) {
        await refresh();
        throw err;
      }
    },
    [refresh],
  );

  return { inventory, cards, loading, error, refresh, setQuantity };
}
