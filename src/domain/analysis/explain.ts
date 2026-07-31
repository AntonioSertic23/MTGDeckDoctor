import type {
  DeckExplanation,
  DeckProfile,
  DeckStatistics,
  Problem,
  ResolvedDeck,
  SynergySummary,
} from "@/domain/types";

/**
 * Explain My Deck (PRD §12).
 *
 * A structured profile is derived first, then rendered into prose from
 * templates. An LLM can later replace only the rendering step — never the
 * diagnosis.
 */
export function explainDeck(
  deck: ResolvedDeck,
  stats: DeckStatistics,
  synergy: SynergySummary,
  problems: Problem[],
): DeckExplanation {
  const profile = buildProfile(deck, stats, synergy, problems);
  return { profile, narrative: renderNarrative(deck, stats, profile) };
}

function buildProfile(
  deck: ResolvedDeck,
  stats: DeckStatistics,
  synergy: SynergySummary,
  problems: Problem[],
): DeckProfile {
  const keyMechanics = synergy.themes.slice(0, 4).map((t) => t.label);
  const speed = describeSpeed(stats);
  const shape = describeShape(stats);

  const primaryArchetype = keyMechanics.length > 0 ? `${keyMechanics[0]} ${shape}` : shape;
  const secondaryArchetype = keyMechanics.length > 1 ? `${keyMechanics[1]} ${speed}` : null;

  return {
    primaryArchetype,
    secondaryArchetype,
    keyMechanics,
    mainGameplan: describeGameplan(stats, synergy),
    winConditions: deck.entries
      .filter((e) => e.roles.includes("WIN_CONDITION"))
      .sort((a, b) => b.card.manaValue - a.card.manaValue)
      .slice(0, 5)
      .map((e) => e.card.name),
    weaknesses: problems
      .filter((p) => p.severity !== "notice")
      .slice(0, 3)
      .map((p) => p.title),
  };
}

function describeShape(stats: DeckStatistics): string {
  const creatureShare = stats.creatureCount / Math.max(1, stats.nonlandCount);
  const spellShare = (stats.instantCount + stats.sorceryCount) / Math.max(1, stats.nonlandCount);

  if (creatureShare > 0.45) return "Creature Midrange";
  if (spellShare > 0.45) return "Spells Control";
  if (stats.enchantmentCount / Math.max(1, stats.nonlandCount) > 0.25) return "Enchantment Value";
  if (stats.artifactCount / Math.max(1, stats.nonlandCount) > 0.3) return "Artifact Value";
  return "Midrange Value";
}

function describeSpeed(stats: DeckStatistics): string {
  if (stats.averageManaValue < 2.6) return "Aggro";
  if (stats.averageManaValue > 3.8) return "Ramp";
  return "Value";
}

function describeGameplan(stats: DeckStatistics, synergy: SynergySummary): string {
  const theme = synergy.themes[0]?.label.toLowerCase();

  if (!theme) {
    return "Play efficient cards, answer threats and win with the strongest permanents that stick.";
  }

  const gameplans: Record<string, string> = {
    graveyard: "Fill the graveyard early, then generate advantage by replaying permanents from it.",
    sacrifice: "Turn expendable permanents into repeated value and incremental damage.",
    tokens: "Build a wide board of tokens and convert it into a single lethal attack.",
    "+1/+1 counters": "Accumulate counters on key creatures until they outclass the table.",
    artifacts: "Assemble artifacts for cheap acceleration and payoffs that scale with the board.",
    enchantments: "Build a resilient enchantment engine that produces value every turn.",
    lifegain: "Use lifegain as a resource and convert it into card advantage or damage.",
    "lands matter": "Hit extra land drops and turn them into value the rest of the table cannot match.",
    "instants & sorceries": "Chain cheap spells for value and finish with a large payoff spell.",
    "blink & etb value": "Reuse enter-the-battlefield triggers repeatedly for compounding value.",
    mill: "Attack libraries while collecting value from what ends up in graveyards.",
    treasure: "Generate treasure to jump ahead on mana and cast several spells per turn.",
    equipment: "Suit up a threat and push damage through with protection attached.",
    "drain & life loss": "Drain the table incrementally rather than attacking through blockers.",
    "big creatures": "Ramp into oversized threats and win through raw board presence.",
    "go wide": "Flood the board and win with a mass pump or anthem effect.",
  };

  return (
    gameplans[theme] ??
    `Generate value around ${theme} and convert that advantage into a win.`
  );
}

function renderNarrative(deck: ResolvedDeck, stats: DeckStatistics, profile: DeckProfile): string {
  const commanderNames = deck.commanders.map((c) => c.name);
  const parts: string[] = [];

  parts.push(
    commanderNames.length === 2
      ? `This deck is primarily a ${profile.primaryArchetype.toLowerCase()} deck led by ${commanderNames[0]} and ${commanderNames[1]}.`
      : commanderNames.length === 1
        ? `This deck is primarily a ${profile.primaryArchetype.toLowerCase()} deck led by ${commanderNames[0]}.`
        : `This deck is primarily a ${profile.primaryArchetype.toLowerCase()} deck.`,
  );

  parts.push(profile.mainGameplan);

  if (profile.keyMechanics.length > 1) {
    parts.push(
      `It leans on ${profile.keyMechanics.slice(0, 3).join(", ").toLowerCase()} to tie the cards together.`,
    );
  }

  parts.push(
    stats.averageManaValue > 3.6
      ? `With an average mana value of ${stats.averageManaValue} and ${stats.rampCount} ramp pieces, its strongest turns arrive in the mid to late game.`
      : `With an average mana value of ${stats.averageManaValue}, it can start applying pressure early.`,
  );

  if (profile.winConditions.length > 0) {
    parts.push(`Games usually end through ${listToProse(profile.winConditions.slice(0, 3))}.`);
  }

  if (profile.weaknesses.length > 0) {
    parts.push(
      `The most likely soft spots are ${listToProse(
        profile.weaknesses.map((w) => w.toLowerCase()),
      )}.`,
    );
  }

  return parts.join(" ");
}

function listToProse(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
