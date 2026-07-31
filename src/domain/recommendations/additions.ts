import type {
  AdditionCandidate,
  CardRole,
  Color,
  DeckStatistics,
  ResolvedDeck,
  SynergySummary,
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

interface RoleGap {
  role: CardRole;
  missing: number;
}

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
  deckThemes: Map<string, number>,
): AdditionCandidate {
  const reasons: string[] = [];
  let total = 0;

  for (const role of staple.roles) {
    const missing = gaps.get(role);
    if (missing === undefined) continue;
    const points = Math.min(40, missing * 8);
    total += points;
    reasons.push(`Fills a gap in ${CARD_ROLE_LABELS[role].toLowerCase()} (${missing} short)`);
  }

  const matchedThemes = (staple.themes ?? []).filter((t) => (deckThemes.get(t) ?? 0) > 0);
  for (const theme of matchedThemes) {
    total += 12;
    reasons.push(`Supports the deck's ${themeLabel(theme).toLowerCase()} theme`);
  }

  if (staple.manaValue <= 2 && total > 0) {
    total += 6;
    reasons.push("Low mana value, easy to fit into the curve");
  }

  reasons.push(staple.note);

  return {
    name: staple.name,
    roles: staple.roles,
    themes: staple.themes ?? [],
    approxManaValue: staple.manaValue,
    score: Math.round(total),
    reasons,
  };
}

/**
 * Keeps the list varied: at most three suggestions whose primary role is the
 * same, so a deck missing ramp does not get twelve mana rocks.
 */
function dropRedundant(candidates: AdditionCandidate[]): AdditionCandidate[] {
  const perRole = new Map<CardRole, number>();
  const kept: AdditionCandidate[] = [];

  for (const candidate of [...candidates].sort((a, b) => b.score - a.score)) {
    const primary = candidate.roles[0];
    const used = perRole.get(primary) ?? 0;
    if (used >= 3) continue;
    perRole.set(primary, used + 1);
    kept.push(candidate);
  }

  return kept;
}

function normalizeName(name: string): string {
  return name.toLowerCase().split("//")[0].trim();
}

export type { RoleGap };
