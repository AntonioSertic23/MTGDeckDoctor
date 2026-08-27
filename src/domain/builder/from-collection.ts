import { classifyCard } from "@/domain/cards/classifier";
import { detectThemes } from "@/domain/cards/themes";
import {
  BUILD_QUOTA_LABELS,
  fillStepsFor,
  maxNonbasicLandSlots,
  quotasForCommander,
  type BuildQuotaId,
  type BuildQuotas,
} from "@/domain/builder/quotas";
import type { Card, CardRole, Color, ThemeId } from "@/domain/types";

export interface OwnedCopy {
  card: Card;
  quantity: number;
}

export interface BuildCard {
  card: Card;
  quantity: number;
  roles: CardRole[];
  themes: ThemeId[];
}

export interface QuotaStatus {
  id: BuildQuotaId;
  label: string;
  want: number;
  have: number;
}

export interface CollectionBuildResult {
  commander: Card;
  cards: BuildCard[];
  totalCards: number;
  quotas: QuotaStatus[];
  gaps: QuotaStatus[];
}

interface PoolItem {
  card: Card;
  owned: number;
  roles: CardRole[];
  themes: ThemeId[];
  isLand: boolean;
  isBasic: boolean;
}

const COLORS: Color[] = ["W", "U", "B", "R", "G"];

const BASIC_NAME: Record<Color, string> = {
  W: "plains",
  U: "island",
  B: "swamp",
  R: "mountain",
  G: "forest",
};

const PREFERRED_LANDS = new Set([
  "command tower",
  "exotic orchard",
  "path of ancestry",
  "city of brass",
  "mana confluence",
  "reflecting pool",
  "forbidden orchard",
  "reliquary tower",
  "bojuka bog",
  "strip mine",
  "ancient tomb",
  "field of the dead",
  "cabaretti courtyard",
  "evolving wilds",
  "terramorphic expanse",
  "fabled passage",
  "prismatic vista",
]);

/**
 * Assemble a Commander deck from owned cards for the chosen commander.
 * Quotas follow the commander; basics may enter as multiple copies.
 */
export function buildDeckFromCollection(
  commander: Card,
  owned: OwnedCopy[],
): CollectionBuildResult {
  const quotas = quotasForCommander(commander);
  const identity = new Set(commander.colorIdentity);
  const commanderMeta = meta(commander);
  const commanderThemes = new Set(commanderMeta.themes);
  const commanderIsStax = commanderMeta.roles.includes("STAX");

  const pool: PoolItem[] = [];
  for (const { card, quantity } of owned) {
    if (quantity <= 0) continue;
    if (card.oracleId === commander.oracleId) continue;
    if (!isLegal(card, identity)) continue;
    const roles = classifyCard(card);
    const themes = detectThemes(card);
    const type = card.typeLine.toLowerCase();
    pool.push({
      card,
      owned: quantity,
      roles,
      themes,
      isLand: type.includes("land"),
      isBasic: isBasicLand(card),
    });
  }

  const commanderId = commander.oracleId;
  const picked = new Map<string, BuildCard>();
  add(picked, commander, 1, commanderMeta.roles, commanderMeta.themes);

  fillLands(picked, pool, identity, commanderId, quotas.lands);
  for (const step of fillStepsFor(quotas)) {
    fillRole(
      picked,
      pool,
      step.role,
      step.want,
      commanderThemes,
      commanderIsStax,
      true,
      commanderId,
      quotas.deckSize,
    );
  }
  fillInteraction(picked, pool, commanderThemes, commanderIsStax, commanderId, quotas);
  fillSynergy(picked, pool, commanderThemes, commanderIsStax, quotas.deckSize);
  padToSize(picked, pool, identity, quotas.deckSize);

  const cards = [...picked.values()].sort((a, b) => {
    if (a.card.oracleId === commander.oracleId) return -1;
    if (b.card.oracleId === commander.oracleId) return 1;
    return a.card.name.localeCompare(b.card.name, undefined, { sensitivity: "base" });
  });

  const status = measureQuotas(cards, commander.oracleId, quotas);
  return {
    commander,
    cards,
    totalCards: countCards(picked),
    quotas: status,
    gaps: status.filter((q) => q.have < q.want),
  };
}

export function isCommanderCandidate(card: Card): boolean {
  const type = card.typeLine.toLowerCase();
  return type.includes("legendary") && (type.includes("creature") || type.includes("planeswalker"));
}

function fillLands(
  picked: Map<string, BuildCard>,
  pool: PoolItem[],
  identity: Set<Color>,
  commanderId: string,
  landTarget: number,
): void {
  const need = () => landTarget - countLands(picked, commanderId);
  const nonbasicCap = maxNonbasicLandSlots(identity.size, landTarget);

  const nonbasics = pool
    .filter((item) => item.isLand && !item.isBasic)
    .sort((a, b) => landScore(b, identity) - landScore(a, identity));

  let nonbasicTaken = 0;
  for (const item of nonbasics) {
    if (need() <= 0 || nonbasicTaken >= nonbasicCap) break;
    if (tryAdd(picked, item, 1) > 0) nonbasicTaken += 1;
  }

  let remaining = need();
  if (remaining <= 0) return;

  const colors = COLORS.filter((c) => identity.has(c));
  if (colors.length === 0) {
    const wastes = pool.find((item) => item.isBasic && /wastes/i.test(item.card.name));
    if (wastes) remaining -= tryAdd(picked, wastes, remaining);
  } else {
    const base = Math.floor(remaining / colors.length);
    let extra = remaining % colors.length;
    for (const color of colors) {
      const want = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
      const basic = findBasic(pool, color);
      if (basic && want > 0) remaining -= tryAdd(picked, basic, want);
    }
  }

  // Any leftover land slots: prefer more basics, then remaining nonbasics.
  remaining = need();
  if (remaining > 0) {
    for (const color of colors) {
      if (need() <= 0) break;
      const basic = findBasic(pool, color);
      if (basic) tryAdd(picked, basic, need());
    }
  }

  remaining = need();
  if (remaining <= 0) return;
  const leftover = pool
    .filter((item) => item.isLand)
    .sort((a, b) => {
      if (a.isBasic !== b.isBasic) return a.isBasic ? -1 : 1;
      return landScore(b, identity) - landScore(a, identity);
    });
  for (const item of leftover) {
    if (need() <= 0) break;
    tryAdd(picked, item, item.isBasic ? need() : 1);
  }
}

function fillRole(
  picked: Map<string, BuildCard>,
  pool: PoolItem[],
  role: CardRole,
  want: number,
  commanderThemes: Set<ThemeId>,
  commanderIsStax: boolean,
  preferLow: boolean,
  commanderId: string,
  deckSize: number,
): void {
  while (countRole(picked, role, commanderId) < want && countCards(picked) < deckSize) {
    const next = best(
      pool,
      picked,
      (item) => !item.isLand && item.roles.includes(role),
      (item) => scoreCard(item, commanderThemes, commanderIsStax, preferLow),
    );
    if (!next) break;
    tryAdd(picked, next, 1);
  }
}

function fillInteraction(
  picked: Map<string, BuildCard>,
  pool: PoolItem[],
  commanderThemes: Set<ThemeId>,
  commanderIsStax: boolean,
  commanderId: string,
  quotas: BuildQuotas,
): void {
  while (
    countInteraction(picked, commanderId) < quotas.interaction &&
    countCards(picked) < quotas.deckSize
  ) {
    const next = best(
      pool,
      picked,
      (item) =>
        !item.isLand &&
        (item.roles.includes("COUNTERSPELL") || item.roles.includes("PROTECTION")),
      (item) => scoreCard(item, commanderThemes, commanderIsStax, true),
    );
    if (!next) break;
    tryAdd(picked, next, 1);
  }
}

function fillSynergy(
  picked: Map<string, BuildCard>,
  pool: PoolItem[],
  commanderThemes: Set<ThemeId>,
  commanderIsStax: boolean,
  deckSize: number,
): void {
  while (countCards(picked) < deckSize) {
    const next = best(
      pool,
      picked,
      (item) => !item.isLand,
      (item) =>
        scoreCard(item, commanderThemes, commanderIsStax, false) +
        themeScore(item.themes, commanderThemes),
    );
    if (!next) break;
    tryAdd(picked, next, 1);
  }
}

function padToSize(
  picked: Map<string, BuildCard>,
  pool: PoolItem[],
  identity: Set<Color>,
  deckSize: number,
): void {
  while (countCards(picked) < deckSize) {
    // Prefer basics when padding so we stack copies instead of unique utility lands.
    const basic = best(
      pool,
      picked,
      (item) => item.isBasic,
      (item) => landScore(item, identity) + 50,
    );
    if (basic) {
      tryAdd(picked, basic, deckSize - countCards(picked));
      continue;
    }
    const land = best(
      pool,
      picked,
      (item) => item.isLand,
      (item) => landScore(item, identity),
    );
    if (!land) break;
    tryAdd(picked, land, 1);
  }
}

function best(
  pool: PoolItem[],
  picked: Map<string, BuildCard>,
  eligible: (item: PoolItem) => boolean,
  score: (item: PoolItem) => number,
): PoolItem | null {
  let winner: PoolItem | null = null;
  let top = -Infinity;
  for (const item of pool) {
    if (!eligible(item)) continue;
    if (remainingCopies(picked, item) <= 0) continue;
    const value = score(item);
    if (value > top) {
      top = value;
      winner = item;
    }
  }
  return winner;
}

function tryAdd(picked: Map<string, BuildCard>, item: PoolItem, want: number): number {
  const available = remainingCopies(picked, item);
  const take = Math.min(want, available);
  if (take <= 0) return 0;
  add(picked, item.card, take, item.roles, item.themes);
  return take;
}

function add(
  picked: Map<string, BuildCard>,
  card: Card,
  quantity: number,
  roles: CardRole[],
  themes: ThemeId[],
): void {
  const existing = picked.get(card.oracleId);
  if (existing) existing.quantity += quantity;
  else picked.set(card.oracleId, { card, quantity, roles, themes });
}

function remainingCopies(picked: Map<string, BuildCard>, item: PoolItem): number {
  const used = picked.get(item.card.oracleId)?.quantity ?? 0;
  if (item.isBasic) return Math.max(0, item.owned - used);
  if (used > 0) return 0;
  return item.owned > 0 ? 1 : 0;
}

function countCards(picked: Map<string, BuildCard>): number {
  let total = 0;
  for (const entry of picked.values()) total += entry.quantity;
  return total;
}

function countLands(picked: Map<string, BuildCard>, commanderId: string): number {
  let total = 0;
  for (const entry of picked.values()) {
    if (entry.card.oracleId === commanderId) continue;
    if (entry.roles.includes("LAND") || entry.card.typeLine.toLowerCase().includes("land")) {
      total += entry.quantity;
    }
  }
  return total;
}

function countRole(picked: Map<string, BuildCard>, role: CardRole, commanderId: string): number {
  let total = 0;
  for (const entry of picked.values()) {
    if (entry.card.oracleId === commanderId) continue;
    if (entry.roles.includes(role)) total += entry.quantity;
  }
  return total;
}

function countInteraction(picked: Map<string, BuildCard>, commanderId: string): number {
  let total = 0;
  for (const entry of picked.values()) {
    if (entry.card.oracleId === commanderId) continue;
    if (entry.roles.includes("LAND")) continue;
    if (entry.roles.includes("COUNTERSPELL") || entry.roles.includes("PROTECTION")) {
      total += entry.quantity;
    }
  }
  return total;
}

function measureQuotas(
  cards: BuildCard[],
  commanderId: string,
  quotas: BuildQuotas,
): QuotaStatus[] {
  const rest = cards.filter((entry) => entry.card.oracleId !== commanderId);
  const have: Record<BuildQuotaId, number> = {
    LAND: rest.filter((e) => e.roles.includes("LAND")).reduce((s, e) => s + e.quantity, 0),
    RAMP: rest.filter((e) => e.roles.includes("RAMP")).reduce((s, e) => s + e.quantity, 0),
    CARD_DRAW: rest.filter((e) => e.roles.includes("CARD_DRAW")).reduce((s, e) => s + e.quantity, 0),
    SPOT_REMOVAL: rest.filter((e) => e.roles.includes("SPOT_REMOVAL")).reduce((s, e) => s + e.quantity, 0),
    BOARD_WIPE: rest.filter((e) => e.roles.includes("BOARD_WIPE")).reduce((s, e) => s + e.quantity, 0),
    INTERACTION: rest
      .filter(
        (e) =>
          !e.roles.includes("LAND") &&
          (e.roles.includes("COUNTERSPELL") || e.roles.includes("PROTECTION")),
      )
      .reduce((s, e) => s + e.quantity, 0),
    WIN_CONDITION: rest.filter((e) => e.roles.includes("WIN_CONDITION")).reduce((s, e) => s + e.quantity, 0),
  };

  const wants: Record<BuildQuotaId, number> = {
    LAND: quotas.lands,
    RAMP: quotas.ramp,
    CARD_DRAW: quotas.cardDraw,
    SPOT_REMOVAL: quotas.spotRemoval,
    BOARD_WIPE: quotas.boardWipes,
    INTERACTION: quotas.interaction,
    WIN_CONDITION: quotas.winConditions,
  };

  return (Object.keys(wants) as BuildQuotaId[]).map((id) => ({
    id,
    label: BUILD_QUOTA_LABELS[id],
    want: wants[id],
    have: have[id],
  }));
}

function scoreCard(
  item: PoolItem,
  commanderThemes: Set<ThemeId>,
  commanderIsStax: boolean,
  preferLow: boolean,
): number {
  let score = themeScore(item.themes, commanderThemes);
  if (preferLow) score += Math.max(0, 4 - item.card.manaValue) * 4;
  else score += Math.min(6, item.card.manaValue);
  if (item.roles.includes("STAX") && !commanderIsStax) score -= 18;
  if (item.roles.includes("VALUE_ENGINE")) score += 4;
  return score;
}

function themeScore(themes: ThemeId[], commanderThemes: Set<ThemeId>): number {
  let score = 0;
  for (const theme of themes) {
    if (commanderThemes.has(theme)) score += 28;
  }
  return score;
}

function landScore(item: PoolItem, identity: Set<Color>): number {
  if (item.isBasic) return 1;
  let score = 4;
  const produced = item.card.producedMana.filter((c) => c !== "C");
  const useful = produced.filter((c) => identity.has(c as Color));
  score += useful.length * 10;
  if (identity.size > 1 && useful.length >= 2) score += 14;
  if (item.card.colorIdentity.length === 0) score += 6;
  if (PREFERRED_LANDS.has(normalizeName(item.card.name))) score += 22;
  if ((item.card.oracleText ?? "").length > 50) score += 5;
  return score;
}

function findBasic(pool: PoolItem[], color: Color): PoolItem | undefined {
  const needle = BASIC_NAME[color];
  return (
    pool.find(
      (item) =>
        item.isBasic &&
        normalizeName(item.card.name).includes(needle) &&
        !/snow-covered/.test(normalizeName(item.card.name)),
    ) ?? pool.find((item) => item.isBasic && normalizeName(item.card.name).includes(needle))
  );
}

function isBasicLand(card: Card): boolean {
  const type = card.typeLine.toLowerCase();
  if (/\bbasic\b/.test(type)) return true;
  // Fallback for odd printings that omit "Basic" but are still the five basics / Wastes.
  const name = normalizeName(card.name);
  return (
    name === "plains" ||
    name === "island" ||
    name === "swamp" ||
    name === "mountain" ||
    name === "forest" ||
    name === "wastes" ||
    name.startsWith("snow-covered ")
  );
}

function isLegal(card: Card, identity: Set<Color>): boolean {
  return card.colorIdentity.every((c) => identity.has(c));
}

function meta(card: Card): { roles: CardRole[]; themes: ThemeId[] } {
  return { roles: classifyCard(card), themes: detectThemes(card) };
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}
