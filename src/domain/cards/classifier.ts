import type { Card, CardRole } from "@/domain/types";

/**
 * Rule-based card classification (PRD §26).
 *
 * Signals used: type line, oracle text, keywords, mana value, power/toughness.
 * The classifier is intentionally boring and inspectable — every role a card
 * receives can be traced to one matched rule.
 */

interface RoleRule {
  role: CardRole;
  /** Returns true when the card should receive this role. */
  test: (ctx: CardContext) => boolean;
}

export interface CardContext {
  card: Card;
  /** Lowercased oracle text with reminder text stripped. */
  text: string;
  typeLine: string;
  isLand: boolean;
  isCreature: boolean;
  isInstant: boolean;
  isSorcery: boolean;
  isPermanent: boolean;
  hasFlash: boolean;
  power: number | null;
}

const REMINDER_TEXT = /\([^)]*\)/g;

export function buildContext(card: Card): CardContext {
  const text = (card.oracleText ?? "")
    .replace(REMINDER_TEXT, " ")
    .toLowerCase()
    .replace(/\s+/g, " ");
  const typeLine = (card.typeLine ?? "").toLowerCase();
  const isLand = typeLine.includes("land");
  const isInstant = typeLine.includes("instant");
  const isSorcery = typeLine.includes("sorcery");
  const power = parsePower(card.power);

  return {
    card,
    text,
    typeLine,
    isLand,
    isCreature: typeLine.includes("creature"),
    isInstant,
    isSorcery,
    isPermanent: !isInstant && !isSorcery,
    hasFlash: card.keywords.includes("Flash") || /\bflash\b/.test(text),
    power,
  };
}

function parsePower(power: string | null): number | null {
  if (!power) return null;
  const n = Number.parseInt(power, 10);
  return Number.isNaN(n) ? null : n;
}

const RAMP_PATTERNS: RegExp[] = [
  /search your library for (a |an |up to \w+ )?(basic )?(land|forest|island|swamp|mountain|plains)/,
  /put (a|an|that|those|it|them|up to \w+) .*land.* onto the battlefield/,
  /add \{[wubrgc0-9x]\}/,
  /add (one|two|three|x) mana/,
  /create (a|an|two|three|\w+) treasure token/,
  /play an additional land/,
  /you may play an additional land/,
  /untap target land/,
];

const FIXING_PATTERNS: RegExp[] = [
  /mana of any color/,
  /mana of any one color/,
  /search your library for (a |up to \w+ )?basic land/,
  /add one mana of any/,
];

const DRAW_PATTERNS: RegExp[] = [
  /\bdraws? (a|one|two|three|four|five|six|seven|x|that many) cards?\b/,
  /\bdraw cards? equal to\b/,
  /whenever .* draw a card/,
  /exile the top .* (you|of your library).* (you may )?(play|cast)/,
  /look at the top .* put .* into your hand/,
  /return .* card from your graveyard to your hand/,
];

const OPPONENT_ONLY_DRAW = /^(?!.*\byou\b).*each (opponent|other player) draws/;

const TUTOR_PATTERNS: RegExp[] = [
  /search your library for (a|an|up to \w+) (?!basic)[^.]*card/,
];

const SPOT_REMOVAL_PATTERNS: RegExp[] = [
  /destroy target/,
  /exile target (creature|permanent|artifact|enchantment|planeswalker|nonland|spell|player's)/,
  /target creature gets -\d+\/-\d+/,
  /target creature gets [+-]\d+\/-\d+/,
  /deals? \d+ damage to target (creature|planeswalker|permanent|any target|battle)/,
  /deals? damage equal to .* to target/,
  /target (player|opponent) sacrifices? (a|an|\w+) (creature|permanent|artifact)/,
  /return target (creature|permanent|nonland permanent|artifact|enchantment) .*to (its owner's|their owner's|the owner's) hand/,
  /put target (creature|permanent) .* on (top|the bottom) of/,
  /fights? target creature/,
  /target creature an opponent controls/,
];

const BOARD_WIPE_PATTERNS: RegExp[] = [
  /destroy all/,
  /exile all/,
  /destroy each/,
  /exile each/,
  /all creatures get -\d+\/-\d+/,
  /each player sacrifices/,
  /return all (creatures|permanents|nonland permanents)/,
  /all creatures? .* deals? damage/,
  /deals? \d+ damage to each creature/,
];

const COUNTERSPELL_PATTERNS: RegExp[] = [
  /counter target (spell|ability|activated|triggered)/,
  /counter that spell/,
];

const PROTECTION_PATTERNS: RegExp[] = [
  /gains? hexproof/,
  /gains? indestructible/,
  /gains? protection from/,
  /gains? shroud/,
  /phases? out/,
  /can't be countered/,
  /regenerate target/,
  /prevent all damage/,
  /gains? ward/,
];

const RECURSION_PATTERNS: RegExp[] = [
  /return target .* card from your graveyard/,
  /return .* from your graveyard to (your hand|the battlefield)/,
  /return (it|that card) from your graveyard/,
  /you may (cast|play) .* from your graveyard/,
  /cast .* from your graveyard/,
];

// A sacrifice outlet needs "sacrifice" to appear as part of an activation
// cost, i.e. before the colon of an activated ability.
const SACRIFICE_OUTLET_PATTERNS: RegExp[] = [
  /sacrifice (a|an|another)[^.:]{0,30}:/,
  /,? sacrifice (a|an|another) (creature|permanent|artifact|token|enchantment):/,
];

const TOKEN_PATTERNS: RegExp[] = [/create (a|an|one|two|three|four|five|x|that many|\w+) .*token/];

const COST_REDUCTION_PATTERNS: RegExp[] = [
  /costs? \{\d+\} less to cast/,
  /costs? \{[wubrg]\} less to cast/,
  /spells you cast cost/,
];

const STAX_PATTERNS: RegExp[] = [
  /costs? \{\d+\} more to cast/,
  /don't untap/,
  /can't (attack|block|cast|be cast|search|draw)/,
  /players can't/,
  /each opponent can't/,
  /skip (your|their) .*step/,
];

const LIFEGAIN_PATTERNS: RegExp[] = [/gains? \d+ life/, /gain life/, /gains? life equal/];

const WIN_CONDITION_PATTERNS: RegExp[] = [
  /wins? the game/,
  /loses? the game/,
  /can't lose the game/,
  /each opponent loses \d+ life/,
  /deals? \d+ damage to each opponent/,
  /damage to each opponent/,
];

const VALUE_ENGINE_PATTERNS: RegExp[] = [
  /at the beginning of (your|each) (upkeep|end step|precombat main phase)/,
  /whenever .*(you|a creature you control).*, (draw|create|return|add|put)/,
  /whenever .* enters, /,
  /whenever .* dies, /,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

const RULES: RoleRule[] = [
  { role: "LAND", test: (c) => c.isLand },
  {
    role: "RAMP",
    test: (c) => {
      if (c.isLand) return false;
      if (!matchesAny(c.text, RAMP_PATTERNS)) return false;
      // A mana ability on a creature that only taps for its own colour still
      // ramps; a card that merely mentions mana in a cost does not.
      return true;
    },
  },
  { role: "FIXING", test: (c) => !c.isLand && matchesAny(c.text, FIXING_PATTERNS) },
  {
    role: "CARD_DRAW",
    test: (c) =>
      !c.isLand && matchesAny(c.text, DRAW_PATTERNS) && !OPPONENT_ONLY_DRAW.test(c.text),
  },
  { role: "TUTOR", test: (c) => matchesAny(c.text, TUTOR_PATTERNS) },
  { role: "SPOT_REMOVAL", test: (c) => matchesAny(c.text, SPOT_REMOVAL_PATTERNS) },
  { role: "BOARD_WIPE", test: (c) => matchesAny(c.text, BOARD_WIPE_PATTERNS) },
  { role: "COUNTERSPELL", test: (c) => matchesAny(c.text, COUNTERSPELL_PATTERNS) },
  { role: "PROTECTION", test: (c) => matchesAny(c.text, PROTECTION_PATTERNS) },
  { role: "RECURSION", test: (c) => matchesAny(c.text, RECURSION_PATTERNS) },
  { role: "GRAVEYARD", test: (c) => c.text.includes("graveyard") },
  { role: "SACRIFICE_OUTLET", test: (c) => matchesAny(c.text, SACRIFICE_OUTLET_PATTERNS) },
  { role: "TOKEN_MAKER", test: (c) => matchesAny(c.text, TOKEN_PATTERNS) },
  { role: "COST_REDUCTION", test: (c) => matchesAny(c.text, COST_REDUCTION_PATTERNS) },
  { role: "STAX", test: (c) => matchesAny(c.text, STAX_PATTERNS) },
  { role: "LIFEGAIN", test: (c) => matchesAny(c.text, LIFEGAIN_PATTERNS) },
  {
    role: "VALUE_ENGINE",
    test: (c) => c.isPermanent && !c.isLand && matchesAny(c.text, VALUE_ENGINE_PATTERNS),
  },
  {
    role: "WIN_CONDITION",
    test: (c) => {
      if (matchesAny(c.text, WIN_CONDITION_PATTERNS)) return true;
      // Large creatures are the default clock in most Commander decks.
      return c.isCreature && c.power !== null && c.power >= 6;
    },
  },
];

export function classifyCard(card: Card): CardRole[] {
  const ctx = buildContext(card);
  return RULES.filter((rule) => rule.test(ctx)).map((rule) => rule.role);
}

/**
 * True when the card can be used on an opponent's turn — the signal behind the
 * "instant-speed interaction" diagnostic (PRD §7).
 */
export function isInstantSpeed(card: Card): boolean {
  const ctx = buildContext(card);
  if (ctx.isInstant || ctx.hasFlash) return true;
  if (!ctx.isPermanent || ctx.isLand) return false;
  // Loyalty abilities read "+1:" / "−2:" and are sorcery-speed only.
  if (ctx.typeLine.includes("planeswalker")) return false;
  return ACTIVATED_ABILITY.test(ctx.text);
}

/** Matches a mana/tap/sacrifice activation cost followed by its colon. */
const ACTIVATED_ABILITY = /(\{[^}]+\}|sacrifice [^:.]{0,30}|discard [^:.]{0,30})\s*:/;

const INTERACTION_ROLES: CardRole[] = [
  "SPOT_REMOVAL",
  "BOARD_WIPE",
  "COUNTERSPELL",
  "PROTECTION",
];

export function isInteraction(roles: CardRole[]): boolean {
  return roles.some((r) => INTERACTION_ROLES.includes(r));
}
