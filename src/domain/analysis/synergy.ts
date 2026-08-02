import type { ResolvedDeck, SynergySummary, ThemeId } from "@/domain/types";
import { themeLabel } from "@/domain/cards/themes";
import { clamp } from "@/domain/analysis/health-config";

/**
 * Explainable card-to-deck synergy (PRD §27).
 *
 * A card scores well when it shares themes with the commander and with the
 * rest of the deck. Every point can be traced back to a named theme, which is
 * what makes the Suggested Cuts explanations honest.
 */
export function calculateSynergy(deck: ResolvedDeck): SynergySummary {
  const nonland = deck.entries.filter((e) => !e.roles.includes("LAND"));

  const deckThemeCounts = new Map<ThemeId, number>();
  for (const entry of nonland) {
    for (const theme of entry.themes) {
      deckThemeCounts.set(theme, (deckThemeCounts.get(theme) ?? 0) + entry.quantity);
    }
  }

  const commanderThemes = new Set<ThemeId>(
    deck.entries.filter((e) => e.isCommander).flatMap((e) => e.themes),
  );

  // Only themes with real support count as the deck's identity; a single card
  // mentioning "treasure" is noise, not a strategy. Commander alone is not
  // enough — need a few supporting pieces so cuts/adds are not hijacked.
  const supportThreshold = Math.max(5, Math.round(nonland.length * 0.1));
  const themes = [...deckThemeCounts.entries()]
    .filter(
      ([id, count]) =>
        count >= supportThreshold || (commanderThemes.has(id) && count >= 3),
    )
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, label: themeLabel(id), count }));

  const coreThemes = new Set(themes.slice(0, 5).map((t) => t.id));
  const cardScores: Record<string, number> = {};

  for (const entry of deck.entries) {
    cardScores[entry.card.oracleId] = scoreCard(
      entry.themes,
      coreThemes,
      commanderThemes,
      deckThemeCounts,
      nonland.length,
    );
  }

  const scored = nonland.map((e) => cardScores[e.card.oracleId] ?? 0);
  const averageScore = scored.length > 0 ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;

  return { themes, cardScores, averageScore };
}

function scoreCard(
  cardThemes: ThemeId[],
  coreThemes: Set<ThemeId>,
  commanderThemes: Set<ThemeId>,
  deckThemeCounts: Map<ThemeId, number>,
  nonlandTotal: number,
): number {
  if (cardThemes.length === 0) return 20;

  let score = 20;
  for (const theme of cardThemes) {
    const support = deckThemeCounts.get(theme) ?? 0;
    const density = nonlandTotal > 0 ? support / nonlandTotal : 0;

    if (commanderThemes.has(theme)) score += 25;
    if (coreThemes.has(theme)) score += 15;
    score += density * 40;
  }

  return Math.round(clamp(score, 0, 100));
}

/**
 * Cards in the deck that share at least one theme with the given card, used by
 * the card detail view and by addition explanations.
 */
export function findSynergyPartners(
  deck: ResolvedDeck,
  oracleId: string,
  limit = 8,
): { name: string; sharedThemes: string[] }[] {
  const target = deck.entries.find((e) => e.card.oracleId === oracleId);
  if (!target) return [];

  return deck.entries
    .filter((e) => e.card.oracleId !== oracleId && !e.roles.includes("LAND"))
    .map((entry) => ({
      name: entry.card.name,
      sharedThemes: entry.themes.filter((t) => target.themes.includes(t)).map(themeLabel),
    }))
    .filter((p) => p.sharedThemes.length > 0)
    .sort((a, b) => b.sharedThemes.length - a.sharedThemes.length)
    .slice(0, limit);
}
