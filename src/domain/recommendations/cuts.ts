import type {
  CutCandidate,
  DeckStatistics,
  Problem,
  ResolvedDeck,
  ResolvedDeckEntry,
  SynergySummary,
} from "@/domain/types";
import { CARD_ROLE_LABELS } from "@/domain/types";
import { clamp } from "@/domain/analysis/health-config";

/**
 * Ranks cut candidates (PRD §10).
 *
 * The score is a sum of named components so the UI can always answer "why is
 * this card here?" — the product never just says "cut these cards".
 */
interface ScoreComponent {
  points: number;
  reason: string;
}

export function suggestCuts(
  deck: ResolvedDeck,
  stats: DeckStatistics,
  synergy: SynergySummary,
  problems: Problem[],
  limit = 12,
): CutCandidate[] {
  const nonland = deck.entries.filter((e) => !e.roles.includes("LAND") && !e.isCommander);
  const roleTotals = countSoleRoles(nonland);
  const scarceRoles = findScarceRoles(stats, problems);

  const candidates = nonland.map((entry) => {
    const components = [
      lowSynergy(entry, synergy),
      roleRedundancy(entry, roleTotals),
      curvePenalty(entry, stats),
      lowDeckRelevance(entry),
      coreRoleImportance(entry, scarceRoles),
      commanderSynergy(entry, deck),
    ].filter((c): c is ScoreComponent => c !== null);

    const raw = components.reduce((sum, c) => sum + c.points, 0);

    return {
      oracleId: entry.card.oracleId,
      name: entry.card.name,
      cutScore: Math.round(clamp(raw, 0, 100)),
      reasons: components
        .filter((c) => c.points > 0)
        .sort((a, b) => b.points - a.points)
        .map((c) => c.reason),
      imageUri: entry.card.imageUri,
      prices: entry.card.prices,
    };
  });

  return candidates
    .filter((c) => c.cutScore > 0 && c.reasons.length > 0)
    .sort((a, b) => b.cutScore - a.cutScore)
    .slice(0, limit);
}

function lowSynergy(entry: ResolvedDeckEntry, synergy: SynergySummary): ScoreComponent | null {
  const score = synergy.cardScores[entry.card.oracleId] ?? 50;
  if (score >= 45) return null;
  return {
    points: Math.round((45 - score) * 0.8),
    reason:
      score < 25
        ? "Does not connect to any of the deck's themes"
        : "Only loosely connected to the deck's themes",
  };
}

function roleRedundancy(
  entry: ResolvedDeckEntry,
  roleTotals: Map<string, number>,
): ScoreComponent | null {
  const meaningful = entry.roles.filter((r) => r !== "LAND" && r !== "GRAVEYARD");
  if (meaningful.length !== 1) return null;

  const role = meaningful[0];
  const count = roleTotals.get(role) ?? 0;
  if (count < 6) return null;

  return {
    points: Math.min(25, (count - 5) * 4),
    reason: `${count} other cards already fill the same role (${CARD_ROLE_LABELS[role].toLowerCase()})`,
  };
}

function curvePenalty(entry: ResolvedDeckEntry, stats: DeckStatistics): ScoreComponent | null {
  const mv = entry.card.manaValue;
  if (mv <= stats.averageManaValue + 1.5) return null;
  return {
    points: Math.min(20, Math.round((mv - stats.averageManaValue) * 6)),
    reason: `Costs ${mv} mana, well above the deck's average of ${stats.averageManaValue}`,
  };
}

function lowDeckRelevance(entry: ResolvedDeckEntry): ScoreComponent | null {
  const meaningful = entry.roles.filter((r) => r !== "LAND" && r !== "GRAVEYARD");
  if (meaningful.length > 0) return null;
  return {
    points: 22,
    reason: "No clear role detected — it neither ramps, draws, interacts nor closes games",
  };
}

/** Negative points: cards covering a role the deck is short on should stay. */
function coreRoleImportance(
  entry: ResolvedDeckEntry,
  scarceRoles: Set<string>,
): ScoreComponent | null {
  const covered = entry.roles.filter((r) => scarceRoles.has(r));
  if (covered.length === 0) return null;
  return {
    points: -18 * covered.length,
    reason: `Covers a role the deck is short on (${covered
      .map((r) => CARD_ROLE_LABELS[r].toLowerCase())
      .join(", ")})`,
  };
}

function commanderSynergy(entry: ResolvedDeckEntry, deck: ResolvedDeck): ScoreComponent | null {
  const commanderThemes = new Set(deck.entries.filter((e) => e.isCommander).flatMap((e) => e.themes));
  if (commanderThemes.size === 0) return null;
  const shared = entry.themes.filter((t) => commanderThemes.has(t));
  if (shared.length > 0) return { points: -12, reason: "Works directly with the commander" };
  return { points: 12, reason: "Low commander synergy" };
}

function countSoleRoles(entries: ResolvedDeckEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    for (const role of entry.roles) {
      if (role === "LAND" || role === "GRAVEYARD") continue;
      totals.set(role, (totals.get(role) ?? 0) + entry.quantity);
    }
  }
  return totals;
}

/** Roles the problem detector flagged as missing — cards filling them are protected. */
function findScarceRoles(stats: DeckStatistics, problems: Problem[]): Set<string> {
  const scarce = new Set<string>();
  const byType = new Set(problems.map((p) => p.type));

  if (byType.has("LOW_RAMP")) scarce.add("RAMP");
  if (byType.has("LOW_CARD_ADVANTAGE")) scarce.add("CARD_DRAW");
  if (byType.has("LOW_REMOVAL")) scarce.add("SPOT_REMOVAL");
  if (byType.has("LOW_BOARD_WIPES")) scarce.add("BOARD_WIPE");
  if (byType.has("UNCLEAR_WIN_CONDITION")) scarce.add("WIN_CONDITION");
  if (byType.has("LOW_INTERACTION")) {
    scarce.add("COUNTERSPELL");
    scarce.add("PROTECTION");
  }
  if (stats.landCount < 34) scarce.add("FIXING");

  return scarce;
}
