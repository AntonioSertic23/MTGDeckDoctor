import "server-only";

import type { Card, Color } from "@/domain/types";
import { cleanCardName } from "@/lib/cards/clean-name";
import type { CardLookup, CardProvider } from "@/lib/cards/provider";

/**
 * Scryfall implementation of `CardProvider`.
 *
 * Runs server-side only. It normalizes Scryfall's payload down to the fields
 * the app stores (PRD §20) and keeps a process-level cache so repeated page
 * loads do not hit the API (PRD §23).
 *
 * `prices.eur` comes from Cardmarket via Scryfall.
 */
const API = "https://api.scryfall.com";
const COLLECTION_BATCH_SIZE = 75;
const REQUEST_SPACING_MS = 100;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const CACHE_MAX_ENTRIES = 5000;

interface CacheEntry {
  card: Card;
  storedAt: number;
}

const byOracleId = new Map<string, CacheEntry>();
const byName = new Map<string, string>();
const byPrinting = new Map<string, string>();

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = lastRequestAt + REQUEST_SPACING_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

function printingKey(setCode: string, collectorNumber: string): string {
  return `${setCode.toLowerCase()}|${collectorNumber.toLowerCase()}`;
}

function cacheCard(card: Card): void {
  if (byOracleId.size >= CACHE_MAX_ENTRIES) {
    const oldest = byOracleId.keys().next().value;
    if (oldest) byOracleId.delete(oldest);
  }
  byOracleId.set(card.oracleId, { card, storedAt: Date.now() });
  byName.set(normalizeName(card.name), card.oracleId);
  for (const variant of nameVariants(card.name)) {
    byName.set(variant, card.oracleId);
  }
}

function cachePrinting(setCode: string, collectorNumber: string, card: Card): void {
  byPrinting.set(printingKey(setCode, collectorNumber), card.oracleId);
  cacheCard(card);
}

function readCache(oracleId: string): Card | null {
  const entry = byOracleId.get(oracleId);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    byOracleId.delete(entry.card.oracleId);
    return null;
  }
  return entry.card;
}

function readCacheByName(name: string): Card | null {
  const oracleId = byName.get(normalizeName(name));
  return oracleId ? readCache(oracleId) : null;
}

function readCacheByPrinting(setCode: string, collectorNumber: string): Card | null {
  const oracleId = byPrinting.get(printingKey(setCode, collectorNumber));
  return oracleId ? readCache(oracleId) : null;
}

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function nameVariants(name: string): string[] {
  const variants = new Set<string>();
  for (const candidate of [name, cleanCardName(name)]) {
    if (!candidate.trim()) continue;
    const normalized = normalizeName(candidate);
    variants.add(normalized);
    const front = normalized.split("//")[0]?.trim();
    if (front) variants.add(front);
  }
  return [...variants];
}

function collectionName(name: string): string {
  const cleaned = cleanCardName(name);
  const primary = (cleaned || name).split("//")[0]?.trim() ?? "";
  return primary;
}

function lookupNameCandidates(name: string): string[] {
  const raw = name.split("//")[0]?.trim() ?? "";
  const cleaned = collectionName(name);
  return [...new Set([cleaned, raw].filter((n) => n.length > 0))];
}

function lookupKey(lookup: CardLookup): string {
  return [
    normalizeName(lookup.name),
    lookup.setCode?.toLowerCase() ?? "",
    lookup.collectorNumber?.toLowerCase() ?? "",
  ].join("|");
}

async function fetchNamed(name: string): Promise<Card | null> {
  if (name.length === 0) return null;
  try {
    const raw = await request<ScryfallCard>(
      `/cards/named?fuzzy=${encodeURIComponent(name)}`,
    );
    return mapScryfallCard(raw);
  } catch (error) {
    if (error instanceof ScryfallError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  await throttle();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": "MTGDeckDoctor/0.1 (https://github.com/mtg-deck-doctor)",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ScryfallError(
      `Scryfall request failed (${response.status})`,
      response.status,
      body.slice(0, 500),
    );
  }

  return (await response.json()) as T;
}

export class ScryfallError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ScryfallError";
  }
}

interface ScryfallFace {
  name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors?: string[];
  image_uris?: { normal?: string; large?: string; small?: string };
}

interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  color_identity?: string[];
  keywords?: string[];
  produced_mana?: string[];
  power?: string;
  toughness?: string;
  set?: string;
  collector_number?: string;
  rarity?: string;
  prices?: { usd?: string | null; eur?: string | null };
  legalities?: Record<string, string>;
  image_uris?: { normal?: string; large?: string; small?: string };
  card_faces?: ScryfallFace[];
}

export function mapScryfallCard(raw: ScryfallCard): Card {
  const faces = raw.card_faces ?? [];
  const front = faces[0];

  const oracleText =
    raw.oracle_text ??
    faces
      .map((f) => f.oracle_text ?? "")
      .filter(Boolean)
      .join("\n//\n");

  const typeLine = raw.type_line ?? faces.map((f) => f.type_line ?? "").join(" // ");
  const imageUri =
    raw.image_uris?.normal ??
    raw.image_uris?.large ??
    front?.image_uris?.normal ??
    front?.image_uris?.large ??
    front?.image_uris?.small ??
    raw.image_uris?.small ??
    null;

  return {
    oracleId: raw.oracle_id ?? raw.id,
    scryfallId: raw.id,
    name: raw.name,
    manaCost: raw.mana_cost ?? front?.mana_cost ?? null,
    manaValue: raw.cmc ?? 0,
    typeLine,
    oracleText,
    colors: toColors(raw.colors ?? front?.colors),
    colorIdentity: toColors(raw.color_identity),
    keywords: raw.keywords ?? [],
    producedMana: raw.produced_mana ?? [],
    power: raw.power ?? front?.power ?? null,
    toughness: raw.toughness ?? front?.toughness ?? null,
    imageUri,
    setCode: raw.set ?? "",
    rarity: raw.rarity ?? "",
    prices: { usd: raw.prices?.usd ?? null, eur: raw.prices?.eur ?? null },
    legalities: raw.legalities ?? {},
    updatedAt: new Date().toISOString(),
  };
}

function toColors(values: string[] | undefined): Color[] {
  const allowed: Color[] = ["W", "U", "B", "R", "G"];
  return (values ?? []).filter((v): v is Color => allowed.includes(v as Color));
}

async function fetchCollection(
  identifiers: Record<string, string>[],
): Promise<{ data: ScryfallCard[]; not_found: Record<string, string>[] }> {
  return request("/cards/collection", {
    method: "POST",
    body: JSON.stringify({ identifiers }),
  });
}

function toIdentifier(lookup: CardLookup): Record<string, string> {
  if (lookup.setCode && lookup.collectorNumber) {
    return {
      set: lookup.setCode.toLowerCase(),
      collector_number: lookup.collectorNumber,
    };
  }
  if (lookup.setCode) {
    return { name: collectionName(lookup.name), set: lookup.setCode.toLowerCase() };
  }
  return { name: collectionName(lookup.name) };
}

function cardMatchesLookup(card: Card, raw: ScryfallCard, lookup: CardLookup): boolean {
  if (lookup.setCode && lookup.collectorNumber) {
    return (
      raw.set?.toLowerCase() === lookup.setCode.toLowerCase() &&
      raw.collector_number?.toLowerCase() === lookup.collectorNumber.toLowerCase()
    );
  }
  if (lookup.setCode && raw.set?.toLowerCase() !== lookup.setCode.toLowerCase()) {
    return false;
  }
  return nameVariants(lookup.name).some((v) => nameVariants(card.name).includes(v));
}

export const scryfallProvider: CardProvider = {
  async findByLookups(lookups) {
    const unique: CardLookup[] = [];
    const seen = new Set<string>();
    for (const lookup of lookups) {
      const key = lookupKey(lookup);
      if (!lookup.name.trim() || seen.has(key)) continue;
      seen.add(key);
      unique.push(lookup);
    }

    const cards: Card[] = [];
    const assigned = new Set<string>();
    const misses: CardLookup[] = [];

    for (const lookup of unique) {
      const cached =
        lookup.setCode && lookup.collectorNumber
          ? readCacheByPrinting(lookup.setCode, lookup.collectorNumber)
          : readCacheByName(lookup.name);
      if (cached) {
        cards.push(cached);
        assigned.add(lookupKey(lookup));
      } else {
        misses.push(lookup);
      }
    }

    for (const batch of chunk(misses, COLLECTION_BATCH_SIZE)) {
      const result = await fetchCollection(batch.map(toIdentifier));

      for (const raw of result.data) {
        const card = mapScryfallCard(raw);
        if (raw.set && raw.collector_number) {
          cachePrinting(raw.set, raw.collector_number, card);
        } else {
          cacheCard(card);
        }
        cards.push(card);

        for (const lookup of batch) {
          if (assigned.has(lookupKey(lookup))) continue;
          if (cardMatchesLookup(card, raw, lookup)) {
            assigned.add(lookupKey(lookup));
          }
        }
      }
    }

    let notFound = unique.filter((lookup) => !assigned.has(lookupKey(lookup))).map((l) => l.name);

    if (notFound.length > 0) {
      const stillMissing: string[] = [];
      const pending = unique.filter((lookup) => !assigned.has(lookupKey(lookup)));

      for (const batch of chunk(pending, COLLECTION_BATCH_SIZE)) {
        const result = await fetchCollection(
          batch.map((lookup) => ({ name: collectionName(lookup.name) })),
        );
        for (const raw of result.data) {
          const card = mapScryfallCard(raw);
          cacheCard(card);
          cards.push(card);
          for (const lookup of batch) {
            if (assigned.has(lookupKey(lookup))) continue;
            if (nameVariants(lookup.name).some((v) => nameVariants(card.name).includes(v))) {
              assigned.add(lookupKey(lookup));
            }
          }
        }
      }

      for (const lookup of unique.filter((l) => !assigned.has(lookupKey(l)))) {
        let resolved: Card | null = null;
        for (const candidate of lookupNameCandidates(lookup.name)) {
          resolved = await fetchNamed(candidate);
          if (resolved) break;
        }
        if (resolved) {
          cacheCard(resolved);
          cards.push(resolved);
          assigned.add(lookupKey(lookup));
        } else {
          stillMissing.push(lookup.name);
        }
      }
      notFound = stillMissing;
    }

    const byId = new Map<string, Card>();
    for (const card of cards) byId.set(card.scryfallId, card);

    return { cards: [...byId.values()], notFound };
  },

  async findByNames(names) {
    return this.findByLookups(names.map((name) => ({ name })));
  },

  async getByOracleIds(oracleIds) {
    const unique = dedupe(oracleIds);
    const cards: Card[] = [];
    const misses: string[] = [];

    for (const id of unique) {
      const cached = readCache(id);
      if (cached) cards.push(cached);
      else misses.push(id);
    }

    for (const batch of chunk(misses, COLLECTION_BATCH_SIZE)) {
      const result = await fetchCollection(batch.map((id) => ({ oracle_id: id })));
      for (const raw of result.data) {
        const card = mapScryfallCard(raw);
        cacheCard(card);
        cards.push(card);
      }
    }

    return cards;
  },

  async search(query, limit = 20) {
    if (query.trim().length === 0) return [];
    const params = new URLSearchParams({ q: query, unique: "cards", order: "edhrec" });

    try {
      const result = await request<{ data: ScryfallCard[] }>(`/cards/search?${params}`);
      const cards = result.data.slice(0, limit).map(mapScryfallCard);
      for (const card of cards) cacheCard(card);
      return cards;
    } catch (error) {
      if (error instanceof ScryfallError && error.status === 404) return [];
      throw error;
    }
  },
};

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter((v) => v.length > 0))];
}

function chunk<T>(values: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < values.length; i += size) batches.push(values.slice(i, i + size));
  return batches;
}
