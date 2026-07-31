"use client";

import { useCallback, useEffect, useState } from "react";
import type { Card, Deck, DeckWithCards, InventoryItem } from "@/domain/types";
import { idbRepository } from "@/lib/storage/idb-repository";

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const list = await idbRepository.listDecks();
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
      const [list, allCards, inv] = await Promise.all([
        idbRepository.listDecksWithCards(),
        idbRepository.getAllCards(),
        idbRepository.listInventory(),
      ]);
      setDecks(list);
      setCards(new Map(allCards.map((c) => [c.oracleId, c])));
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
      const result = await idbRepository.getDeck(id);
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
