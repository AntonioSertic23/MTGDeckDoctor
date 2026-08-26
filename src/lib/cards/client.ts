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

const BY_ORACLE_BATCH = 400;

export async function resolveCardsByOracleIds(oracleIds: string[]): Promise<Card[]> {
  if (oracleIds.length === 0) return [];
  const unique = [...new Set(oracleIds.filter((id) => id.trim().length > 0))];
  const cards: Card[] = [];

  for (let i = 0; i < unique.length; i += BY_ORACLE_BATCH) {
    const batch = unique.slice(i, i + BY_ORACLE_BATCH);
    const response = await fetch("/api/cards/by-oracle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oracleIds: batch }),
    });
    const data = (await response.json()) as { cards?: Card[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Could not load card art.");
    }
    cards.push(...(data.cards ?? []));
  }

  return cards;
}
