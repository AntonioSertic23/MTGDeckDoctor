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
): AdditionCandidate[] {
  const identity = new Set(stats.colorIdentity);
  const owned = new Set(deck.entries.map((e) => normalizeName(e.card.name)));
  const gaps = findRoleGaps(stats, thresholds);
  const deckThemes = new Map(synergy.themes.map((t) => [t.id, t.count]));

  const candidates = STAPLES.filter((staple) => isLegalInIdentity(staple, identity))
    .filter((staple) => !owned.has(normalizeName(staple.name)))
    .map((staple) => score(staple, gaps, deckThemes))
    .filter((candidate) => candidate.score > 0);

  return dropRedundant(candidates).slice(0, limit);
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
): AdditionCandidate[] {
  if (roles.length === 0 || limit <= 0) return [];

  const identity = new Set(stats.colorIdentity);
  const owned = new Set(deck.entries.map((e) => normalizeName(e.card.name)));
  const gaps = findRoleGaps(stats, thresholds);
  const roleSet = new Set(roles);
  const deckThemes = new Map(synergy.themes.map((t) => [t.id, t.count]));

  // Ensure requested roles still score even when the gap is small but a problem fired.
  for (const role of roles) {
    if (!gaps.has(role)) gaps.set(role, 1);
  }

  return STAPLES.filter((staple) => staple.roles.some((role) => roleSet.has(role)))
    .filter((staple) => isLegalInIdentity(staple, identity))
    .filter((staple) => !owned.has(normalizeName(staple.name)))
    .map((staple) => score(staple, gaps, deckThemes, { lenientTheme: true }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
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

/**
 * Keeps the list varied: at most two suggestions whose primary role is the
 * same, so a deck missing ramp does not get twelve mana rocks.
 */
function dropRedundant(candidates: AdditionCandidate[]): AdditionCandidate[] {
  const perRole = new Map<CardRole, number>();
  const kept: AdditionCandidate[] = [];

  for (const candidate of [...candidates].sort((a, b) => b.score - a.score)) {
    const primary = candidate.roles[0];
    const used = perRole.get(primary) ?? 0;
    if (used >= 2) continue;
    perRole.set(primary, used + 1);
    kept.push(candidate);
  }

  return kept;
}

function normalizeName(name: string): string {
  return name.toLowerCase().split("//")[0].trim();
}

export type { RoleGap };
