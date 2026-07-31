import type { Card, ThemeId } from "@/domain/types";
import { buildContext } from "@/domain/cards/classifier";

/**
 * Deck themes are the vocabulary the synergy engine speaks (PRD §27).
 *
 * A theme is detected on a card either because the card *cares* about the
 * mechanic or because it *provides* it. Two cards sharing a theme is the
 * cheapest explainable synergy signal available without a curated database.
 */
export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  patterns: RegExp[];
  /** Type-line fragments that also count as providing the theme. */
  typePatterns?: RegExp[];
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "GRAVEYARD",
    label: "Graveyard",
    patterns: [/graveyard/, /\bmill\b/, /from your graveyard/, /dies/],
  },
  {
    id: "SACRIFICE",
    label: "Sacrifice",
    patterns: [/sacrifice/, /whenever .* dies/, /\bdies,/],
  },
  {
    id: "TOKENS",
    label: "Tokens",
    patterns: [/create .*token/, /token you control/, /tokens? enters?/],
  },
  {
    id: "PLUS_ONE_COUNTERS",
    label: "+1/+1 counters",
    patterns: [/\+1\/\+1 counter/, /put .* counters? on/],
  },
  {
    id: "ARTIFACTS",
    label: "Artifacts",
    patterns: [/artifact/, /metalcraft/, /affinity for artifacts/],
    typePatterns: [/artifact/],
  },
  {
    id: "ENCHANTMENTS",
    label: "Enchantments",
    patterns: [/enchantment/, /constellation/],
    typePatterns: [/enchantment/],
  },
  {
    id: "LIFEGAIN",
    label: "Lifegain",
    patterns: [/gain \d+ life/, /gain life/, /whenever you gain life/, /lifelink/],
  },
  {
    id: "LANDFALL",
    label: "Lands matter",
    patterns: [/landfall/, /whenever a land enters/, /additional land/, /lands? you control/],
  },
  {
    id: "SPELLSLINGER",
    label: "Instants & sorceries",
    patterns: [
      /whenever you cast (an instant|a sorcery|your first)/,
      /instant or sorcery/,
      /magecraft/,
      /prowess/,
      /storm/,
    ],
  },
  {
    id: "BLINK",
    label: "Blink & ETB value",
    patterns: [
      /exile .* return (it|them|that card) to the battlefield/,
      /when .* enters/,
      /flicker/,
    ],
  },
  { id: "MILL", label: "Mill", patterns: [/mills? \w+ cards?/, /put .* into (your|their) graveyard/] },
  { id: "DISCARD", label: "Discard", patterns: [/discards? (a|an|\w+) cards?/, /madness/] },
  { id: "TREASURE", label: "Treasure", patterns: [/treasure/] },
  {
    id: "EQUIPMENT",
    label: "Equipment",
    patterns: [/equip/, /equipped creature/],
    typePatterns: [/equipment/],
  },
  {
    id: "AURAS",
    label: "Auras",
    patterns: [/enchanted creature/, /\baura\b/],
    typePatterns: [/aura/],
  },
  {
    id: "DRAIN",
    label: "Drain & life loss",
    patterns: [/each opponent loses \d+ life/, /loses? \d+ life .* you gain/, /extort/],
  },
  {
    id: "BIG_CREATURES",
    label: "Big creatures",
    patterns: [/trample/, /power \d+ or greater/, /\bramp\b/],
  },
  {
    id: "GO_WIDE",
    label: "Go wide",
    patterns: [/creatures you control get/, /for each creature you control/, /convoke/],
  },
];

const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export function themeLabel(id: ThemeId): string {
  return THEME_BY_ID.get(id)?.label ?? id;
}

export function detectThemes(card: Card): ThemeId[] {
  const ctx = buildContext(card);
  const found: ThemeId[] = [];

  for (const theme of THEMES) {
    const inText = theme.patterns.some((p) => p.test(ctx.text));
    const inType = theme.typePatterns?.some((p) => p.test(ctx.typeLine)) ?? false;
    if (inText || inType) found.push(theme.id);
  }

  // Big creatures is a statement about the body, not just the text box.
  if (ctx.isCreature && ctx.power !== null && ctx.power >= 5 && !found.includes("BIG_CREATURES")) {
    found.push("BIG_CREATURES");
  }

  return found;
}
