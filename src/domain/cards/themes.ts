import type { Card, ThemeId } from "@/domain/types";
import { buildContext } from "@/domain/cards/classifier";

/**
 * Deck themes are the vocabulary the synergy engine speaks (PRD §27).
 *
 * A theme is detected on a card either because the card *cares* about the
 * mechanic or because it *provides* it. Two cards sharing a theme is the
 * cheapest explainable synergy signal available without a curated database.
 *
 * Patterns are intentionally narrow: type-line membership alone (every
 * artifact, every ETB trigger) creates false "core themes" that poison
 * cuts and adds.
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
    patterns: [/graveyard/, /\bmill\b/, /from your graveyard/, /return .* from .* graveyard/],
  },
  {
    id: "SACRIFICE",
    label: "Sacrifice",
    // Require a creature/permanent sacrifice or a death trigger — not Food costs.
    patterns: [
      /sacrifice (a|an|another|any number of) (creature|permanent|artifact|enchantment|tokens?)/,
      /sacrifice (this permanent|~)/,
      /whenever (a|another) creature (you control )?dies/,
      /whenever .* creature dies/,
    ],
  },
  {
    id: "FOOD",
    label: "Food",
    patterns: [/\bfood\b/, /create .* food/, /sacrifice (a|an) food/],
    typePatterns: [/\bfood\b/],
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
    // Care about artifacts as a strategy — not "is an artifact".
    patterns: [
      /artifacts? you control/,
      /artifact creatures? you control/,
      /metalcraft/,
      /affinity for artifacts/,
      /whenever (you cast|an artifact)/,
      /search .* artifact/,
    ],
  },
  {
    id: "ENCHANTMENTS",
    label: "Enchantments",
    patterns: [
      /enchantments? you control/,
      /constellation/,
      /whenever .* enchantment enters/,
      /search .* enchantment/,
    ],
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
    // Broad "when ~ enters" matches almost every creature — keep exile/flicker only.
    patterns: [
      /exile .* return (it|them|that card) to the battlefield/,
      /flicker/,
      /blink/,
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
    patterns: [/trample/, /power \d+ or greater/, /creatures with power/],
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
