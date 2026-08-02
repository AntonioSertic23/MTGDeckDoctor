import type { DeckStatistics, Problem, ResolvedDeck, SynergySummary } from "@/domain/types";
import {
  DEFAULT_THRESHOLDS,
  type HealthThresholds,
  recommendedLands,
  recommendedRamp,
} from "@/domain/analysis/health-config";
import { CARD_ROLE_LABELS } from "@/domain/types";

/**
 * Deterministic problem detection (PRD §9).
 *
 * Every rule produces evidence, and every description is phrased as something
 * the player can act on rather than a bare statistic.
 */
interface ProblemRule {
  detect(ctx: RuleContext): Problem | null;
}

interface RuleContext {
  deck: ResolvedDeck;
  stats: DeckStatistics;
  synergy: SynergySummary;
  thresholds: HealthThresholds;
}

const SEVERITY_ORDER = { critical: 0, warning: 1, notice: 2 } as const;

export function detectProblems(
  deck: ResolvedDeck,
  stats: DeckStatistics,
  synergy: SynergySummary,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): Problem[] {
  const ctx: RuleContext = { deck, stats, synergy, thresholds };
  return RULES.map((rule) => rule.detect(ctx))
    .filter((p): p is Problem => p !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

const RULES: ProblemRule[] = [
  {
    detect: ({ stats, thresholds }): Problem | null => {
      const required = thresholds.deckSize;
      if (stats.totalCards === required) return null;

      if (stats.totalCards > required) {
        const excess = stats.totalCards - required;
        const problem: Problem = {
          type: "TOO_MANY_CARDS",
          severity: "critical",
          title: `Deck has ${stats.totalCards} cards (must be ${required})`,
          description: `Commander decks must be exactly ${required} cards including the commander. This list is ${excess} over — cut that many to make the deck legal.`,
          evidence: {
            totalCards: stats.totalCards,
            required,
            excess,
          },
          affectedCards: [],
          suggestedFix: `Cut ${excess} card${excess === 1 ? "" : "s"} so the deck reaches ${required}.`,
        };
        return problem;
      }

      const missing = required - stats.totalCards;
      const problem: Problem = {
        type: "TOO_FEW_CARDS",
        severity: "critical",
        title: `Deck has ${stats.totalCards} cards (must be ${required})`,
        description: `Commander decks must be exactly ${required} cards including the commander. This list is ${missing} short — add that many to make the deck legal.`,
        evidence: {
          totalCards: stats.totalCards,
          required,
          missing,
        },
        affectedCards: [],
        suggestedFix: `Add ${missing} card${missing === 1 ? "" : "s"} so the deck reaches ${required}.`,
      };
      return problem;
    },
  },
  {
    detect: ({ stats, thresholds }) => {
      const target = recommendedRamp(stats.averageManaValue, thresholds);
      if (stats.rampCount >= target * 0.7) return null;
      const severe = stats.rampCount < target * 0.45;
      return {
        type: "LOW_RAMP",
        severity: severe ? "critical" : "warning",
        title: "Deck may be too slow",
        description: `Your average mana value is ${stats.averageManaValue} while the deck only has ${stats.rampCount} ramp pieces. Consider adding mana rocks or land ramp so the expensive cards come down on time.`,
        evidence: {
          rampCount: stats.rampCount,
          recommendedRamp: target,
          averageManaValue: stats.averageManaValue,
        },
        affectedCards: [],
      };
    },
  },
  {
    detect: ({ stats, thresholds }) => {
      const target = thresholds.recommendedInstantSpeedInteraction;
      if (stats.instantSpeedInteractionCount >= target) return null;
      return {
        type: "LOW_INTERACTION",
        severity: stats.instantSpeedInteractionCount < target / 2 ? "critical" : "warning",
        title: "Low instant-speed interaction",
        description: `Only ${stats.instantSpeedInteractionCount} cards can act during an opponent's turn. The deck may struggle to stop combos or answer threats before they resolve.`,
        evidence: {
          instantSpeedInteraction: stats.instantSpeedInteractionCount,
          recommendedMinimum: target,
        },
        affectedCards: [],
      };
    },
  },
  {
    detect: ({ stats, thresholds }) => {
      if (stats.boardWipeCount >= thresholds.recommendedBoardWipes) return null;
      return {
        type: "LOW_BOARD_WIPES",
        severity: stats.boardWipeCount === 0 ? "critical" : "warning",
        title: `Only ${stats.boardWipeCount} board wipes`,
        description: `Only ${stats.boardWipeCount} board wipe${stats.boardWipeCount === 1 ? "" : "s"} (recommended ${thresholds.recommendedBoardWipes}). The deck has little recovery once an opponent establishes a wide board.`,
        evidence: {
          boardWipeCount: stats.boardWipeCount,
          recommendedMinimum: thresholds.recommendedBoardWipes,
        },
        affectedCards: [],
      };
    },
  },
  {
    detect: ({ stats, thresholds }) => {
      if (stats.spotRemovalCount >= thresholds.recommendedSpotRemoval * 0.6) return null;
      return {
        type: "LOW_REMOVAL",
        severity: "warning",
        title: "Limited targeted removal",
        description: `The deck has ${stats.spotRemovalCount} spot removal spells (recommended ${thresholds.recommendedSpotRemoval}). Commander games usually present more must-answer permanents than that.`,
        evidence: {
          spotRemovalCount: stats.spotRemovalCount,
          recommendedMinimum: thresholds.recommendedSpotRemoval,
        },
        affectedCards: [],
      };
    },
  },
  {
    detect: ({ stats, thresholds }) => {
      if (stats.drawCount >= thresholds.recommendedDraw * 0.7) return null;
      return {
        type: "LOW_CARD_ADVANTAGE",
        severity: stats.drawCount < thresholds.recommendedDraw * 0.4 ? "critical" : "warning",
        title: "Deck may run out of cards",
        description: `Only ${stats.drawCount} card-advantage pieces (recommended ${thresholds.recommendedDraw}). Without more draw the deck is likely to run out of resources in longer games.`,
        evidence: { drawCount: stats.drawCount, recommendedMinimum: thresholds.recommendedDraw },
        affectedCards: [],
      };
    },
  },
  {
    detect: ({ stats, thresholds }) => {
      const target = recommendedLands(stats.averageManaValue, thresholds);
      const diff = stats.landCount - target;
      if (Math.abs(diff) < 3) return null;
      const tooFew = diff < 0;
      return {
        type: tooFew ? "TOO_FEW_LANDS" : "TOO_MANY_LANDS",
        severity: Math.abs(diff) >= 5 ? "warning" : "notice",
        title: tooFew ? "Land count looks low" : "Land count looks high",
        description: tooFew
          ? `Your deck has ${stats.landCount} lands and an average mana value of ${stats.averageManaValue}. Consider testing one or two additional mana sources, or lowering the curve.`
          : `Your deck has ${stats.landCount} lands at an average mana value of ${stats.averageManaValue}. You may be able to cut a land for another spell.`,
        evidence: {
          landCount: stats.landCount,
          recommendedLands: target,
          averageManaValue: stats.averageManaValue,
        },
        affectedCards: [],
      };
    },
  },
  {
    detect: ({ stats, thresholds }) => {
      if (stats.averageManaValue <= thresholds.idealManaValue + 0.6) return null;
      return {
        type: "HIGH_MANA_VALUE",
        severity: stats.averageManaValue > thresholds.idealManaValue + 1.1 ? "warning" : "notice",
        title: "Very high average mana value",
        description: `The average mana value is ${stats.averageManaValue}. Unless the ramp package is unusually strong, the deck will spend the early turns doing very little.`,
        evidence: {
          averageManaValue: stats.averageManaValue,
          rampCount: stats.rampCount,
          expensiveSpells: (stats.manaCurve["6"] ?? 0) + (stats.manaCurve["7+"] ?? 0),
        },
        affectedCards: [],
      };
    },
  },
  {
    detect: ({ stats, thresholds }) => {
      if (stats.winConditionCount >= thresholds.recommendedWinConditions) return null;
      return {
        type: "UNCLEAR_WIN_CONDITION",
        severity: stats.winConditionCount === 0 ? "critical" : "notice",
        title: "Few identifiable win conditions",
        description: `Only ${stats.winConditionCount} cards look like they can actually close a game. The deck may generate value without ever converting it into a win.`,
        evidence: {
          winConditionCount: stats.winConditionCount,
          recommendedMinimum: thresholds.recommendedWinConditions,
        },
        affectedCards: [],
      };
    },
  },
  {
    detect: ({ deck, stats }) => {
      const graveyardShare = stats.graveyardInteractionCount / Math.max(1, stats.nonlandCount);
      if (graveyardShare < 0.3) return null;
      const affected = deck.entries
        .filter((e) => e.themes.includes("GRAVEYARD"))
        .slice(0, 6)
        .map((e) => e.card.name);
      return {
        type: "GRAVEYARD_DEPENDENCE",
        severity: "notice",
        title: "Deck is vulnerable when the graveyard is shut down",
        description: `${stats.graveyardInteractionCount} of ${stats.nonlandCount} nonland cards care about the graveyard. A single piece of graveyard hate can turn off a large part of the deck.`,
        evidence: {
          graveyardCards: stats.graveyardInteractionCount,
          nonlandCards: stats.nonlandCount,
          share: Math.round(graveyardShare * 100),
        },
        affectedCards: affected,
        suggestedFix: "Consider one or two ways to answer graveyard hate, or a backup plan that works from hand.",
      };
    },
  },
  {
    detect: ({ deck }) => {
      const redundant = findRoleOverlap(deck);
      if (!redundant) return null;
      return {
        type: "ROLE_REDUNDANCY",
        severity: "notice",
        title: `${redundant.cards.length} cards perform very similar roles`,
        description: `${redundant.cards.length} cards are all doing the same job (${redundant.label}) with little else attached. Some of them are natural flex slots.`,
        evidence: { role: redundant.label, count: redundant.cards.length },
        affectedCards: redundant.cards,
      };
    },
  },
  {
    detect: ({ deck, synergy }) => {
      const offTheme = deck.entries
        .filter((e) => !e.roles.includes("LAND"))
        .filter((e) => (synergy.cardScores[e.card.oracleId] ?? 0) < 25);
      if (offTheme.length < 5 || synergy.themes.length === 0) return null;
      return {
        type: "LOW_SYNERGY_CARDS",
        severity: "notice",
        title: `${offTheme.length} cards sit outside the deck's themes`,
        description: `These cards do not connect to ${synergy.themes
          .slice(0, 2)
          .map((t) => t.label.toLowerCase())
          .join(" or ")}. They may still be fine staples, but they are the first place to look for flex slots.`,
        evidence: { count: offTheme.length },
        affectedCards: offTheme.map((e) => e.card.name),
      };
    },
  },
  {
    detect: ({ deck }) => {
      if (deck.unresolved.length === 0) return null;
      return {
        type: "UNRESOLVED_CARDS",
        severity: "warning",
        title: `${deck.unresolved.length} cards could not be identified`,
        description:
          "These names did not match any card, so they are excluded from the analysis. Check for typos or unusual printings.",
        evidence: { count: deck.unresolved.length },
        affectedCards: deck.unresolved,
      };
    },
  },
];

/**
 * Finds the largest group of cards whose only meaningful role is the same one,
 * which is the signal behind the "these cards overlap" diagnostic.
 */
function findRoleOverlap(deck: ResolvedDeck): { label: string; cards: string[] } | null {
  const buckets = new Map<string, string[]>();

  for (const entry of deck.entries) {
    const meaningful = entry.roles.filter((r) => r !== "LAND" && r !== "GRAVEYARD");
    if (meaningful.length !== 1) continue;
    const role = meaningful[0];
    const bucket = buckets.get(role) ?? [];
    bucket.push(entry.card.name);
    buckets.set(role, bucket);
  }

  let largest: { label: string; cards: string[] } | null = null;
  for (const [role, cards] of buckets) {
    if (cards.length < 6) continue;
    if (!largest || cards.length > largest.cards.length) {
      largest = { label: CARD_ROLE_LABELS[role as keyof typeof CARD_ROLE_LABELS], cards };
    }
  }
  return largest;
}
