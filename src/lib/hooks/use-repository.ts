"use client";

import { useCallback, useEffect, useState } from "react";
import type { Card, Deck, DeckWithCards, InventoryItem } from "@/domain/types";
import { resolveCardsByOracleIds } from "@/lib/cards/client";
import { getRepository } from "@/lib/storage";

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

export function useDecksWithCards() {
  const [decks, setDecks] = useState<DeckWithCards[]>([]);
  const [cards, setCards] = useState<Map<string, Card>>(new Map());
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const repo = getRepository();
      const [list, allCards, inv] = await Promise.all([
        repo.listDecksWithCards(),
        repo.getAllCards(),
        repo.listInventory(),
      ]);

      const cardMap = new Map(allCards.map((c) => [c.oracleId, c]));
      const neededIds = new Set<string>();
      for (const { cards: deckCards } of list) {
        for (const deckCard of deckCards) neededIds.add(deckCard.oracleId);
      }

      const missingOrNoArt = [...neededIds].filter((id) => {
        const card = cardMap.get(id);
        return !card || !card.imageUri;
      });

      if (missingOrNoArt.length > 0) {
        try {
          const hydrated = await resolveCardsByOracleIds(missingOrNoArt);
          if (hydrated.length > 0) {
            await repo.saveCards(hydrated);
            for (const card of hydrated) cardMap.set(card.oracleId, card);
          }
        } catch {
          // Offline / Scryfall down — keep whatever local cache we have.
        }
      }

      setDecks(list);
      setCards(cardMap);
      setInventory(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { decks, cards, inventory, loading, error, refresh };
}

export function useDeck(id: string) {
  const [deck, setDeck] = useState<DeckWithCards | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const result = await getRepository().getDeck(id);
      setDeck(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load deck.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { deck, loading, error, refresh, setDeck };
}
