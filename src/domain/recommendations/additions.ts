import type {
  AdditionCandidate,
  CardRole,
  Color,
  DeckStatistics,
  ResolvedDeck,
  SynergySummary,
  ThemeId,
} from "@/domain/types";
import { CARD_ROLE_LABELS } from "@/domain/types";
import { STAPLES, parseColorIdentity, type StapleEntry } from "@/domain/recommendations/staples";
import { themeLabel } from "@/domain/cards/themes";
import {
  DEFAULT_THRESHOLDS,
  type HealthThresholds,
  recommendedRamp,
} from "@/domain/analysis/health-config";
import {
  collectionRolesAndThemes,
  findOwnedCard,
  formatDeckNames,
  isCollectionAddCandidate,
  type CollectionContext,
} from "@/domain/recommendations/collection-aware";

/**
 * Recommends cards based on what the deck lacks (PRD §11).
 *
 * Pipeline: detect missing roles → filter candidates by colour identity and
 * what the deck already runs → score by role gap and theme fit → explain.
 *
 * Theme-tagged staples that do not match the deck's strategy are downranked
 * so aristocrats finishers do not show up in unrelated shells.
 */
export function suggestAdditions(
  deck: ResolvedDeck,
  stats: DeckStatistics,
  synergy: SynergySummary,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
  limit = 12,
  collection?: CollectionContext | null,
): AdditionCandidate[] {
  const identity = new Set(stats.colorIdentity);
  const inDeck = new Set(deck.entries.map((e) => normalizeName(e.card.name)));
  const gaps = findRoleGaps(stats, thresholds);
  const deckThemes = new Map(synergy.themes.map((t) => [t.id, t.count]));

  const staples = STAPLES.filter((staple) => isLegalInIdentity(staple, identity))
    .filter((staple) => !inDeck.has(normalizeName(staple.name)))
    .map((staple) => score(staple, gaps, deckThemes))
    .filter((candidate) => candidate.score > 0)
    .map((candidate) => applyOwnership(candidate, collection));

  const fromCollection = collection
    ? ownedGapFillers(deck, identity, gaps, deckThemes, collection)
    : [];

  return dropRedundant(mergeByName(fromCollection, staples)).slice(0, limit);
}

/**
 * Role-focused suggestions for a specific problem / health gap (e.g. only
 * spot removal). Ignores the global per-role cap used on the Adds tab.
 */
export function suggestAdditionsForRoles(
  deck: ResolvedDeck,
  stats: DeckStatistics,
  synergy: SynergySummary,
  roles: CardRole[],
  limit = 4,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
  collection?: CollectionContext | null,
): AdditionCandidate[] {
  if (roles.length === 0 || limit <= 0) return [];

  const identity = new Set(stats.colorIdentity);
  const inDeck = new Set(deck.entries.map((e) => normalizeName(e.card.name)));
  const gaps = findRoleGaps(stats, thresholds);
  const roleSet = new Set(roles);
  const deckThemes = new Map(synergy.themes.map((t) => [t.id, t.count]));

  // Ensure requested roles still score even when the gap is small but a problem fired.
  for (const role of roles) {
    if (!gaps.has(role)) gaps.set(role, 1);
  }

  const staples = STAPLES.filter((staple) => staple.roles.some((role) => roleSet.has(role)))
    .filter((staple) => isLegalInIdentity(staple, identity))
    .filter((staple) => !inDeck.has(normalizeName(staple.name)))
    .map((staple) => score(staple, gaps, deckThemes, { lenientTheme: true }))
    .filter((candidate) => candidate.score > 0)
    .map((candidate) => applyOwnership(candidate, collection));

  const fromCollection = collection
    ? ownedGapFillers(deck, identity, gaps, deckThemes, collection, {
        lenientTheme: true,
        roleFilter: roleSet,
      })
    : [];

  return mergeByName(fromCollection, staples).sort(compareAdditions).slice(0, limit);
}

interface RoleGap {
  role: CardRole;
  missing: number;
}

interface ScoreOptions {
  /** Soften theme mismatch when the caller explicitly asked for a role. */
  lenientTheme?: boolean;
}

/** Roles that are useful in almost any deck without needing a matching theme. */
const UNIVERSAL_ROLES = new Set<CardRole>([
  "RAMP",
  "FIXING",
  "SPOT_REMOVAL",
  "BOARD_WIPE",
  "CARD_DRAW",
  "PROTECTION",
  "COUNTERSPELL",
  "TUTOR",
]);

/** Roles that are usually strategy pieces — theme fit matters a lot. */
const THEMATIC_ROLES = new Set<CardRole>([
  "WIN_CONDITION",
  "SACRIFICE_OUTLET",
  "VALUE_ENGINE",
  "RECURSION",
]);

function findRoleGaps(stats: DeckStatistics, t: HealthThresholds): Map<CardRole, number> {
  const targets: [CardRole, number, number][] = [
    ["RAMP", stats.rampCount, recommendedRamp(stats.averageManaValue, t)],
    ["CARD_DRAW", stats.drawCount, t.recommendedDraw],
    ["SPOT_REMOVAL", stats.spotRemovalCount, t.recommendedSpotRemoval],
    ["BOARD_WIPE", stats.boardWipeCount, t.recommendedBoardWipes],
    ["WIN_CONDITION", stats.winConditionCount, t.recommendedWinConditions],
    ["COUNTERSPELL", stats.instantSpeedInteractionCount, t.recommendedInstantSpeedInteraction],
    ["PROTECTION", stats.protectionCount, 4],
    ["TUTOR", stats.tutorCount, 3],
  ];

  const gaps = new Map<CardRole, number>();
  for (const [role, actual, target] of targets) {
    const missing = target - actual;
    if (missing > 0) gaps.set(role, missing);
  }
  return gaps;
}

function isLegalInIdentity(staple: StapleEntry, identity: Set<Color>): boolean {
  return parseColorIdentity(staple.colorIdentity).every((c) => identity.has(c));
}

function score(
  staple: StapleEntry,
  gaps: Map<CardRole, number>,
  deckThemes: Map<ThemeId, number>,
  options: ScoreOptions = {},
): AdditionCandidate {
  const reasons: string[] = [];
  let total = 0;
  let gapHits = 0;

  for (const role of staple.roles) {
    const missing = gaps.get(role);
    if (missing === undefined) continue;
    gapHits += 1;
    // Tiny gaps (1 short) score less so borderline decks are not flooded.
    const points = missing === 1 ? 6 : Math.min(42, missing * 9);
    total += points;
    reasons.push(`Fills a gap in ${CARD_ROLE_LABELS[role].toLowerCase()} (${missing} short)`);
  }

  const stapleThemes = staple.themes ?? [];
  const matchedThemes = stapleThemes.filter((t) => (deckThemes.get(t) ?? 0) > 0);

  for (const theme of matchedThemes) {
    const support = deckThemes.get(theme) ?? 0;
    const points = 12 + Math.min(18, support);
    total += points;
    reasons.push(`Supports the deck's ${themeLabel(theme).toLowerCase()} theme`);
  }

  // Theme-tagged cards that miss the deck's strategy — especially finishers /
  // engines — should not crowd out generic gap fillers.
  if (
    stapleThemes.length > 0 &&
    matchedThemes.length === 0 &&
    deckThemes.size > 0 &&
    !options.lenientTheme
  ) {
    const isThematicPiece = staple.roles.some((r) => THEMATIC_ROLES.has(r));
    const onlyUniversalGaps =
      gapHits > 0 && staple.roles.every((r) => !gaps.has(r) || UNIVERSAL_ROLES.has(r));

    if (isThematicPiece) {
      total -= 32;
    } else if (!onlyUniversalGaps) {
      total -= 14;
    } else {
      total -= 6;
    }
  }

  // Theme-only adds (no role gap) still need a real match.
  if (gapHits === 0 && matchedThemes.length === 0) {
    total = 0;
  }

  if (staple.manaValue <= 2 && total > 0) {
    total += 6;
    reasons.push("Low mana value, easy to fit into the curve");
  }

  if (total > 0) reasons.push(staple.note);

  return {
    name: staple.name,
    roles: staple.roles,
    themes: stapleThemes,
    approxManaValue: staple.manaValue,
    score: Math.round(Math.max(0, total)),
    reasons,
  };
}

function ownedGapFillers(
  deck: ResolvedDeck,
  identity: Set<Color>,
  gaps: Map<CardRole, number>,
  deckThemes: Map<ThemeId, number>,
  collection: CollectionContext,
  options: ScoreOptions & { roleFilter?: Set<CardRole> } = {},
): AdditionCandidate[] {
  const inDeck = collection.currentDeckOracleIds;
  const seen = new Set<string>();
  const results: AdditionCandidate[] = [];

  for (const card of collection.ownedCards) {
    if (inDeck.has(card.oracleId) || seen.has(card.oracleId)) continue;
    if (!card.colorIdentity.every((c) => identity.has(c))) continue;

    const { roles, themes } = collectionRolesAndThemes(card);
    if (options.roleFilter && !roles.some((role) => options.roleFilter!.has(role))) continue;
    if (!isCollectionAddCandidate(card, roles)) continue;

    const staple: StapleEntry = {
      name: card.name,
      colorIdentity: card.colorIdentity.join(""),
      roles,
      manaValue: card.manaValue,
      themes,
      note: "From your collection",
    };
    const candidate = score(staple, gaps, deckThemes, options);
    if (candidate.score <= 0) continue;

    seen.add(card.oracleId);
    results.push(
      applyOwnership(
        {
          ...candidate,
          oracleId: card.oracleId,
          imageUri: card.imageUri,
          prices: card.prices,
          fromCollection: true,
        },
        collection,
      ),
    );
  }

  return results;
}

function applyOwnership(
  candidate: AdditionCandidate,
  collection?: CollectionContext | null,
): AdditionCandidate {
  if (!collection || collection.ownedCards.length === 0) return candidate;

  const card =
    (candidate.oracleId
      ? collection.ownedCards.find((c) => c.oracleId === candidate.oracleId)
      : undefined) ?? findOwnedCard(candidate.name, collection);
  if (!card) return candidate;

  const qty = collection.ownedQty.get(card.oracleId) ?? 0;
  if (qty <= 0) return candidate;

  const elsewhere = collection.otherDecks.get(card.oracleId);
  const otherNames = elsewhere?.names ?? [];
  const reasons = [...candidate.reasons];
  let extra = 24;
  if (otherNames.length > 0) {
    extra = 12;
    reasons.unshift(`You own this — also listed in ${formatDeckNames(otherNames)}`);
  } else {
    reasons.unshift(`You own ${qty} ${qty === 1 ? "copy" : "copies"}`);
  }

  return {
    ...candidate,
    oracleId: candidate.oracleId ?? card.oracleId,
    imageUri: candidate.imageUri ?? card.imageUri,
    prices: candidate.prices ?? card.prices,
    ownedCopies: qty,
    otherDeckNames: otherNames,
    score: candidate.score + extra,
    reasons,
  };
}

function mergeByName(
  owned: AdditionCandidate[],
  staples: AdditionCandidate[],
): AdditionCandidate[] {
  const byName = new Map<string, AdditionCandidate>();
  for (const candidate of [...staples, ...owned]) {
    const key = normalizeName(candidate.name);
    const existing = byName.get(key);
    if (!existing || compareAdditions(candidate, existing) < 0) {
      byName.set(key, {
        ...candidate,
        fromCollection: candidate.fromCollection || existing?.fromCollection,
      });
    }
  }
  return [...byName.values()];
}

function compareAdditions(a: AdditionCandidate, b: AdditionCandidate): number {
  const ao = (a.ownedCopies ?? 0) > 0 ? 1 : 0;
  const bo = (b.ownedCopies ?? 0) > 0 ? 1 : 0;
  if (ao !== bo) return bo - ao;
  return b.score - a.score;
}

/**
 * Keeps the list varied: at most two suggestions whose primary role is the
 * same, so a deck missing ramp does not get twelve mana rocks.
 * Owned cards get a slightly higher cap so the collection can actually fill gaps.
 */
function dropRedundant(candidates: AdditionCandidate[]): AdditionCandidate[] {
  const perRole = new Map<CardRole, number>();
  const kept: AdditionCandidate[] = [];

  for (const candidate of [...candidates].sort(compareAdditions)) {
    const primary = candidate.roles[0];
    const used = perRole.get(primary) ?? 0;
    const cap = (candidate.ownedCopies ?? 0) > 0 ? 3 : 2;
    if (used >= cap) continue;
    perRole.set(primary, used + 1);
    kept.push(candidate);
  }

  return kept;
}

function normalizeName(name: string): string {
  return name.toLowerCase().split("//")[0].trim();
}

export type { RoleGap };
