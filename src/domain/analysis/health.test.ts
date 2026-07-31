import { describe, expect, it } from "vitest";
import { calculateHealth } from "@/domain/analysis/health";
import type { DeckStatistics, SynergySummary } from "@/domain/types";
import { CARD_ROLE_LABELS, type CardRole } from "@/domain/types";

function emptyRoles(): Record<CardRole, number> {
  return Object.fromEntries(Object.keys(CARD_ROLE_LABELS).map((role) => [role, 0])) as Record<
    CardRole,
    number
  >;
}

function stats(overrides: Partial<DeckStatistics> = {}): DeckStatistics {
  return {
    totalCards: 100,
    landCount: 36,
    nonlandCount: 64,
    creatureCount: 25,
    instantCount: 10,
    sorceryCount: 10,
    artifactCount: 15,
    enchantmentCount: 10,
    planeswalkerCount: 0,
    battleCount: 0,
    averageManaValue: 3.1,
    medianManaValue: 3,
    manaCurve: {},
    colorPips: { W: 0, U: 10, B: 10, R: 0, G: 10 },
    colorIdentity: ["U", "B", "G"],
    rampCount: 10,
    drawCount: 10,
    spotRemovalCount: 8,
    boardWipeCount: 3,
    counterspellCount: 4,
    instantSpeedInteractionCount: 8,
    tutorCount: 3,
    recursionCount: 4,
    graveyardInteractionCount: 6,
    protectionCount: 4,
    winConditionCount: 3,
    roleCounts: emptyRoles(),
    themeCounts: {},
    ...overrides,
  };
}

const synergy: SynergySummary = {
  themes: [],
  cardScores: {},
  averageScore: 60,
};

describe("calculateHealth", () => {
  it("scores a balanced deck near the top of the heuristic scale", () => {
    const health = calculateHealth(stats(), synergy);
    expect(health.overall).toBeGreaterThanOrEqual(70);
    expect(health.categories).toHaveLength(8);
  });

  it("penalizes low ramp and low interaction", () => {
    const healthy = calculateHealth(stats(), synergy).overall;
    const weak = calculateHealth(
      stats({
        rampCount: 2,
        instantSpeedInteractionCount: 1,
        counterspellCount: 0,
        averageManaValue: 3.9,
      }),
      synergy,
    ).overall;

    expect(weak).toBeLessThan(healthy);
  });
});
