"use client";

import type {
  Card,
  CardAllocation,
  Color,
  Deck,
  DeckAnalysisSnapshot,
  DeckCard,
  DeckFormat,
  DeckWithCards,
  InventoryItem,
} from "@/domain/types";
import type { DeckRepository } from "@/lib/storage/repository";
import { ensureSupabaseUserId, getSupabaseBrowserClient } from "@/lib/supabase/client";

interface CardRow {
  oracle_id: string;
  scryfall_id: string;
  name: string;
  mana_cost: string | null;
  mana_value: number;
  type_line: string;
  oracle_text: string;
  colors: string[];
  color_identity: string[];
  keywords: string[];
  produced_mana: string[];
  power: string | null;
  toughness: string | null;
  image_uri: string | null;
  set_code: string;
  rarity: string;
  price_usd: string | null;
  price_eur: string | null;
  legalities: Record<string, string>;
  updated_at: string;
}

interface DeckRow {
  id: string;
  user_id: string;
  name: string;
  format: string;
  commander_oracle_ids: string[];
  description: string | null;
  ready?: boolean | null;
  times_brought?: number | null;
  times_played?: number | null;
  created_at: string;
  updated_at: string;
  analysis_snapshot?: DeckAnalysisSnapshot | null;
}

interface DeckCardRow {
  deck_id: string;
  oracle_id: string;
  quantity: number;
}

function toCard(row: CardRow): Card {
  return {
    oracleId: row.oracle_id,
    scryfallId: row.scryfall_id,
    name: row.name,
    manaCost: row.mana_cost,
    manaValue: row.mana_value,
    typeLine: row.type_line,
    oracleText: row.oracle_text,
    colors: (row.colors ?? []) as Color[],
    colorIdentity: (row.color_identity ?? []) as Color[],
    keywords: row.keywords ?? [],
    producedMana: row.produced_mana ?? [],
    power: row.power,
    toughness: row.toughness,
    imageUri: row.image_uri,
    setCode: row.set_code,
    rarity: row.rarity,
    prices: { usd: row.price_usd, eur: row.price_eur },
    legalities: row.legalities ?? {},
    updatedAt: row.updated_at,
  };
}

function fromCard(card: Card): CardRow {
  return {
    oracle_id: card.oracleId,
    scryfall_id: card.scryfallId,
    name: card.name,
    mana_cost: card.manaCost,
    mana_value: card.manaValue,
    type_line: card.typeLine,
    oracle_text: card.oracleText,
    colors: card.colors,
    color_identity: card.colorIdentity,
    keywords: card.keywords,
    produced_mana: card.producedMana,
    power: card.power,
    toughness: card.toughness,
    image_uri: card.imageUri,
    set_code: card.setCode,
    rarity: card.rarity,
    price_usd: card.prices.usd,
    price_eur: card.prices.eur,
    legalities: card.legalities,
    updated_at: card.updatedAt || new Date().toISOString(),
  };
}

function toDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    name: row.name,
    format: (row.format as DeckFormat) || "commander",
    commanderOracleIds: row.commander_oracle_ids ?? [],
    description: row.description ?? undefined,
    ready: Boolean(row.ready),
    timesBrought: Math.max(0, Number(row.times_brought) || 0),
    timesPlayed: Math.max(0, Number(row.times_played) || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    analysisSnapshot: row.analysis_snapshot ?? null,
  };
}

async function requireUserId(): Promise<string> {
  return ensureSupabaseUserId();
}

export const supabaseRepository: DeckRepository = {
  async listDecks() {
    const supabase = getSupabaseBrowserClient();
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from("decks")
      .select("*")
      .eq("user_id", userId)
      .order("name");
    if (error) throw error;
    return (data as DeckRow[]).map(toDeck);
  },

  async getDeck(id) {
    const supabase = getSupabaseBrowserClient();
    const userId = await requireUserId();
    const { data: deck, error } = await supabase
      .from("decks")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!deck) return null;

    const { data: cards, error: cardsError } = await supabase
      .from("deck_cards")
      .select("oracle_id, quantity")
      .eq("deck_id", id);
    if (cardsError) throw cardsError;

    return {
      deck: toDeck(deck as DeckRow),
      cards: (cards as Pick<DeckCardRow, "oracle_id" | "quantity">[]).map((row) => ({
        oracleId: row.oracle_id,
        quantity: row.quantity,
      })),
    };
  },

  async listDecksWithCards() {
    const supabase = getSupabaseBrowserClient();
    const userId = await requireUserId();
    const { data: decks, error } = await supabase
      .from("decks")
      .select("*")
      .eq("user_id", userId)
      .order("name");
    if (error) throw error;

    const deckRows = decks as DeckRow[];
    if (deckRows.length === 0) return [];

    const ids = deckRows.map((d) => d.id);
    const { data: cardRows, error: cardsError } = await supabase
      .from("deck_cards")
      .select("deck_id, oracle_id, quantity")
      .in("deck_id", ids);
    if (cardsError) throw cardsError;

    const byDeck = new Map<string, DeckCard[]>();
    for (const row of (cardRows as DeckCardRow[]) ?? []) {
      const list = byDeck.get(row.deck_id) ?? [];
      list.push({ oracleId: row.oracle_id, quantity: row.quantity });
      byDeck.set(row.deck_id, list);
    }

    return deckRows.map((deck) => ({
      deck: toDeck(deck),
      cards: byDeck.get(deck.id) ?? [],
    }));
  },

  async createDeck(deck, cards) {
    const supabase = getSupabaseBrowserClient();
    const userId = await requireUserId();
    const { error } = await supabase.from("decks").insert({
      id: deck.id,
      user_id: userId,
      name: deck.name,
      format: deck.format,
      commander_oracle_ids: deck.commanderOracleIds,
      description: deck.description ?? null,
      ready: deck.ready ?? false,
      times_brought: deck.timesBrought ?? 0,
      times_played: deck.timesPlayed ?? 0,
      created_at: deck.createdAt,
      updated_at: deck.updatedAt,
    });
    if (error) throw error;

    if (cards.length > 0) {
      const { error: cardsError } = await supabase.from("deck_cards").insert(
        cards.map((card) => ({
          deck_id: deck.id,
          oracle_id: card.oracleId,
          quantity: card.quantity,
        })),
      );
      if (cardsError) throw cardsError;
    }
  },

  async updateDeck(deck) {
    const supabase = getSupabaseBrowserClient();
    const userId = await requireUserId();
    const { error } = await supabase
      .from("decks")
      .update({
        name: deck.name,
        format: deck.format,
        commander_oracle_ids: deck.commanderOracleIds,
        description: deck.description ?? null,
        ready: deck.ready ?? false,
        times_brought: deck.timesBrought ?? 0,
        times_played: deck.timesPlayed ?? 0,
        updated_at: new Date().toISOString(),
        // Keep existing snapshot unless callers cleared it (e.g. commander change).
        analysis_snapshot: deck.analysisSnapshot ?? null,
      })
      .eq("id", deck.id)
      .eq("user_id", userId);
    if (error) throw error;
  },

  async setDeckCards(deckId, cards) {
    const supabase = getSupabaseBrowserClient();
    await requireUserId();

    const { error: deleteError } = await supabase.from("deck_cards").delete().eq("deck_id", deckId);
    if (deleteError) throw deleteError;

    if (cards.length > 0) {
      const { error } = await supabase.from("deck_cards").insert(
        cards.map((card) => ({
          deck_id: deckId,
          oracle_id: card.oracleId,
          quantity: card.quantity,
        })),
      );
      if (error) throw error;
    }

    const { error: clearError } = await supabase
      .from("decks")
      .update({
        analysis_snapshot: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deckId);
    if (clearError) throw clearError;
  },

  async saveAnalysisSnapshot(deckId, snapshot) {
    const supabase = getSupabaseBrowserClient();
    const userId = await requireUserId();
    const { error } = await supabase
      .from("decks")
      .update({ analysis_snapshot: snapshot })
      .eq("id", deckId)
      .eq("user_id", userId);
    if (error) throw error;
  },

  async deleteDeck(id) {
    const supabase = getSupabaseBrowserClient();
    const userId = await requireUserId();
    const { error } = await supabase.from("decks").delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
  },

  async getCards(oracleIds) {
    if (oracleIds.length === 0) return [];
    const supabase = getSupabaseBrowserClient();
    await requireUserId();
    const { data, error } = await supabase.from("cards").select("*").in("oracle_id", oracleIds);
    if (error) throw error;
    return ((data as CardRow[]) ?? []).map(toCard);
  },

  async getAllCards() {
    const decks = await this.listDecksWithCards();
    const inventory = await this.listInventory();
    const ids = new Set<string>();
    for (const { cards } of decks) {
      for (const card of cards) ids.add(card.oracleId);
    }
    for (const item of inventory) ids.add(item.oracleId);
    return this.getCards([...ids]);
  },

  async saveCards(cards) {
    if (cards.length === 0) return;
    const supabase = getSupabaseBrowserClient();
    await requireUserId();
    const { error } = await supabase.from("cards").upsert(cards.map(fromCard), {
      onConflict: "oracle_id",
    });
    if (error) throw error;
  },

  async listInventory() {
    const supabase = getSupabaseBrowserClient();
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from("inventory_items")
      .select("oracle_id, quantity")
      .eq("user_id", userId);
    if (error) throw error;
    return ((data as { oracle_id: string; quantity: number }[]) ?? []).map((row) => ({
      oracleId: row.oracle_id,
      quantity: row.quantity,
    }));
  },

  async setInventoryQuantity(oracleId, quantity) {
    const supabase = getSupabaseBrowserClient();
    const userId = await requireUserId();
    if (quantity <= 0) {
      const { error } = await supabase
        .from("inventory_items")
        .delete()
        .eq("user_id", userId)
        .eq("oracle_id", oracleId);
      if (error) throw error;
      return;
    }
    const { error } = await supabase.from("inventory_items").upsert({
      user_id: userId,
      oracle_id: oracleId,
      quantity,
    });
    if (error) throw error;
  },

  async listAllocations() {
    const supabase = getSupabaseBrowserClient();
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from("card_allocations")
      .select("oracle_id, deck_id, quantity")
      .eq("user_id", userId);
    if (error) throw error;
    return ((data as { oracle_id: string; deck_id: string; quantity: number }[]) ?? []).map(
      (row) => ({
        oracleId: row.oracle_id,
        deckId: row.deck_id,
        quantity: row.quantity,
      }),
    );
  },

  async setAllocation(allocation) {
    const supabase = getSupabaseBrowserClient();
    const userId = await requireUserId();
    if (allocation.quantity <= 0) {
      await this.clearAllocation(allocation.oracleId, allocation.deckId);
      return;
    }
    const { error } = await supabase.from("card_allocations").upsert({
      user_id: userId,
      deck_id: allocation.deckId,
      oracle_id: allocation.oracleId,
      quantity: allocation.quantity,
    });
    if (error) throw error;
  },

  async clearAllocation(oracleId, deckId) {
    const supabase = getSupabaseBrowserClient();
    const userId = await requireUserId();
    const { error } = await supabase
      .from("card_allocations")
      .delete()
      .eq("user_id", userId)
      .eq("deck_id", deckId)
      .eq("oracle_id", oracleId);
    if (error) throw error;
  },
};
