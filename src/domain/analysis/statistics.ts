import type {
  CardRole,
  Color,
  DeckStatistics,
  ResolvedDeck,
  ResolvedDeckEntry,
} from "@/domain/types";
import { isInstantSpeed, isInteraction } from "@/domain/cards/classifier";

const ALL_ROLES: CardRole[] = [
  "LAND",
  "RAMP",
  "FIXING",
  "CARD_DRAW",
  "TUTOR",
  "SPOT_REMOVAL",
  "BOARD_WIPE",
  "COUNTERSPELL",
  "PROTECTION",
  "RECURSION",
  "GRAVEYARD",
  "SACRIFICE_OUTLET",
  "TOKEN_MAKER",
  "COST_REDUCTION",
  "VALUE_ENGINE",
  "STAX",
  "LIFEGAIN",
  "WIN_CONDITION",
];

const COLORS: Color[] = ["W", "U", "B", "R", "G"];

/**
 * Pure structured facts about a deck (PRD §7). No judgements are made here —
 * every opinion downstream must be traceable to one of these numbers.
 */
export function calculateStatistics(deck: ResolvedDeck): DeckStatistics {
  const entries = deck.entries;
  const roleCounts = Object.fromEntries(ALL_ROLES.map((r) => [r, 0])) as Record<CardRole, number>;
  const themeCounts: Record<string, number> = {};
  const colorPips = Object.fromEntries(COLORS.map((c) => [c, 0])) as Record<Color, number>;
  const manaCurve: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7+": 0 };

  let totalCards = 0;
  let landCount = 0;
  let creatureCount = 0;
  let instantCount = 0;
  let sorceryCount = 0;
  let artifactCount = 0;
  let enchantmentCount = 0;
  let planeswalkerCount = 0;
  let battleCount = 0;
  let instantSpeedInteractionCount = 0;

  const nonlandManaValues: number[] = [];

  for (const entry of entries) {
    const { card, quantity, roles, themes } = entry;
    const typeLine = card.typeLine.toLowerCase();
    totalCards += quantity;

    for (const role of roles) roleCounts[role] += quantity;
    for (const theme of themes) themeCounts[theme] = (themeCounts[theme] ?? 0) + quantity;

    const isLand = typeLine.includes("land");
    if (isLand) landCount += quantity;
    if (typeLine.includes("creature")) creatureCount += quantity;
    if (typeLine.includes("instant")) instantCount += quantity;
    if (typeLine.includes("sorcery")) sorceryCount += quantity;
    if (typeLine.includes("artifact")) artifactCount += quantity;
    if (typeLine.includes("enchantment")) enchantmentCount += quantity;
    if (typeLine.includes("planeswalker")) planeswalkerCount += quantity;
    if (typeLine.includes("battle")) battleCount += quantity;

    if (!isLand) {
      for (let i = 0; i < quantity; i++) nonlandManaValues.push(card.manaValue);
      manaCurve[curveBucket(card.manaValue)] += quantity;
      if (isInteraction(roles) && isInstantSpeed(card)) {
        instantSpeedInteractionCount += quantity;
      }
    }

    for (const pip of countPips(card.manaCost)) {
      colorPips[pip] += quantity;
    }
  }

  return {
    totalCards,
    landCount,
    nonlandCount: totalCards - landCount,
    creatureCount,
    instantCount,
    sorceryCount,
    artifactCount,
    enchantmentCount,
    planeswalkerCount,
    battleCount,
    averageManaValue: round2(average(nonlandManaValues)),
    medianManaValue: round2(median(nonlandManaValues)),
    manaCurve,
    colorPips,
    colorIdentity: deriveColorIdentity(entries),
    rampCount: roleCounts.RAMP,
    drawCount: roleCounts.CARD_DRAW,
    spotRemovalCount: roleCounts.SPOT_REMOVAL,
    boardWipeCount: roleCounts.BOARD_WIPE,
    counterspellCount: roleCounts.COUNTERSPELL,
    instantSpeedInteractionCount,
    tutorCount: roleCounts.TUTOR,
    recursionCount: roleCounts.RECURSION,
    graveyardInteractionCount: roleCounts.GRAVEYARD,
    protectionCount: roleCounts.PROTECTION,
    winConditionCount: roleCounts.WIN_CONDITION,
    roleCounts,
    themeCounts,
  };
}

function curveBucket(manaValue: number): string {
  const mv = Math.floor(manaValue);
  return mv >= 7 ? "7+" : String(mv);
}

function countPips(manaCost: string | null): Color[] {
  if (!manaCost) return [];
  const pips: Color[] = [];
  for (const match of manaCost.matchAll(/\{([^}]+)\}/g)) {
    for (const ch of match[1].split("/")) {
      if (COLORS.includes(ch as Color)) pips.push(ch as Color);
    }
  }
  return pips;
}

function deriveColorIdentity(entries: ResolvedDeckEntry[]): Color[] {
  const set = new Set<Color>();
  const commanders = entries.filter((e) => e.isCommander);
  const source = commanders.length > 0 ? commanders : entries;
  for (const entry of source) {
    for (const color of entry.card.colorIdentity) set.add(color);
  }
  return COLORS.filter((c) => set.has(c));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
