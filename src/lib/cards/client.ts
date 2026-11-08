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

export async function fetchCardsBySet(setCode: string): Promise<Card[]> {
  const params = new URLSearchParams({ set: setCode.trim().toLowerCase() });
  const response = await fetch(`/api/cards/by-set?${params}`);
  const data = (await response.json()) as SearchResponse;
  if (!response.ok) {
    throw new Error(data.error ?? "Could not load that set.");
  }
  return data.cards;
}

export async function fetchSetNames(): Promise<Map<string, string>> {
  const response = await fetch("/api/cards/sets");
  const data = (await response.json()) as {
    sets?: { code: string; name: string }[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Could not load set names.");
  }
  return new Map((data.sets ?? []).map((set) => [set.code, set.name]));
}

/**
 * One Scryfall /cards/collection call per serverless invocation (max 75 ids,
 * 2 req/sec). Keeps each Netlify function well under the default time budget
 * even when a 429 forces a cooldown retry.
 */
const SERVER_CARD_BATCH = 75;

export async function resolveCardsByScryfallIds(scryfallIds: string[]): Promise<Card[]> {
  if (scryfallIds.length === 0) return [];
  const cards: Card[] = [];
  for (let index = 0; index < scryfallIds.length; index += SERVER_CARD_BATCH) {
    const slice = scryfallIds.slice(index, index + SERVER_CARD_BATCH);
    const response = await fetch("/api/cards/by-scryfall", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scryfallIds: slice }),
    });
    const data = (await response.json()) as { cards?: Card[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Could not resolve card printings.");
    }
    cards.push(...(data.cards ?? []));
  }
  return cards;
}

export async function resolveCardsByOracleIds(oracleIds: string[]): Promise<Card[]> {
  if (oracleIds.length === 0) return [];
  const unique = [...new Set(oracleIds.filter((id) => id.trim().length > 0))];
  const cards: Card[] = [];

  for (let i = 0; i < unique.length; i += SERVER_CARD_BATCH) {
    const batch = unique.slice(i, i + SERVER_CARD_BATCH);
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
