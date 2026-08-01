import type { Card } from "@/domain/types";
import type { CardLookup } from "@/lib/cards/provider";

interface ResolveResponse {
  cards: Card[];
  notFound: string[];
  error?: string;
}

interface SearchResponse {
  cards: Card[];
  error?: string;
}

/** Browser-side helper. Never talks to Scryfall directly (PRD §23). */
export async function resolveCardLookups(lookups: CardLookup[]): Promise<ResolveResponse> {
  const response = await fetch("/api/cards/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lookups }),
  });

  const data = (await response.json()) as ResolveResponse;
  if (!response.ok) {
    throw new Error(data.error ?? "Could not resolve cards.");
  }
  return data;
}

export async function resolveCardNames(names: string[]): Promise<ResolveResponse> {
  return resolveCardLookups(names.map((name) => ({ name })));
}

export async function searchCards(query: string): Promise<Card[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`/api/cards/search?${params}`);
  const data = (await response.json()) as SearchResponse;
  if (!response.ok) {
    throw new Error(data.error ?? "Search failed.");
  }
  return data.cards;
}

export async function resolveCardsByOracleIds(oracleIds: string[]): Promise<Card[]> {
  if (oracleIds.length === 0) return [];
  const response = await fetch("/api/cards/by-oracle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oracleIds }),
  });
  const data = (await response.json()) as { cards?: Card[]; error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Could not load card art.");
  }
  return data.cards ?? [];
}
