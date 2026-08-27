import { classifyCard } from "@/domain/cards/classifier";
import { detectThemes } from "@/domain/cards/themes";
import {
  DEFAULT_THRESHOLDS,
  recommendedLands,
  recommendedRamp,
  clamp,
} from "@/domain/analysis/health-config";
import type { Card, CardRole } from "@/domain/types";

export type BuildQuotaId =
  | "LAND"
  | "RAMP"
  | "CARD_DRAW"
  | "SPOT_REMOVAL"
  | "BOARD_WIPE"
  | "INTERACTION"
  | "WIN_CONDITION";

export const BUILD_QUOTA_LABELS: Record<BuildQuotaId, string> = {
  LAND: "Lands",
  RAMP: "Ramp",
  CARD_DRAW: "Card draw",
  SPOT_REMOVAL: "Spot removal",
  BOARD_WIPE: "Board wipes",
  INTERACTION: "Interaction",
  WIN_CONDITION: "Win conditions",
};

export interface BuildQuotas {
  deckSize: number;
  lands: number;
  ramp: number;
  cardDraw: number;
  spotRemoval: number;
  boardWipes: number;
  interaction: number;
  winConditions: number;
}

/** @deprecated Prefer quotasForCommander — kept for tests expecting a deck size constant. */
export const BUILD_TARGETS = {
  deckSize: 100,
} as const;

/**
 * Role targets tuned to the commander (CMC, colours, themes) instead of a
 * one-size-fits-all package.
 */
export function quotasForCommander(commander: Card): BuildQuotas {
  const t = DEFAULT_THRESHOLDS;
  const mv = commander.manaValue;
  const identity = new Set(commander.colorIdentity);
  const themes = new Set(detectThemes(commander));
  const roles = new Set(classifyCard(commander));
  const text = (commander.oracleText ?? "").toLowerCase();

  let lands = recommendedLands(mv, t);
  let ramp = recommendedRamp(mv, t);
  let cardDraw = t.recommendedDraw;
  let spotRemoval = t.recommendedSpotRemoval;
  let boardWipes = t.recommendedBoardWipes;
  let interaction = t.recommendedInstantSpeedInteraction;
  let winConditions = t.recommendedWinConditions;

  if (identity.has("G")) {
    ramp = clamp(ramp + 2, t.minRamp, t.maxRamp);
  }
  if (identity.has("U")) {
    cardDraw += 2;
    interaction += 2;
  }
  if (identity.has("W")) {
    spotRemoval += 1;
    interaction += 1;
  }
  if (identity.has("B")) {
    cardDraw += 1;
    spotRemoval += 1;
  }
  if (identity.has("R") && !identity.has("G") && mv <= 3) {
    lands = clamp(lands - 2, t.minLands, t.maxLands);
    ramp = clamp(ramp - 1, t.minRamp, t.maxRamp);
  }

  // Expensive commanders need more fuel; cheap ones lean on curve.
  if (mv >= 5) {
    lands = clamp(lands + 1, t.minLands, t.maxLands);
    ramp = clamp(ramp + 1, t.minRamp, t.maxRamp);
  } else if (mv <= 2) {
    lands = clamp(lands - 1, t.minLands, t.maxLands);
  }

  if (themes.has("SPELLSLINGER")) {
    cardDraw += 2;
    interaction += 1;
    lands = clamp(lands - 1, t.minLands, t.maxLands);
  }
  if (themes.has("TOKENS") || themes.has("GO_WIDE")) {
    boardWipes += 1;
  }
  if (themes.has("GRAVEYARD")) {
    cardDraw += 1;
  }
  if (themes.has("ARTIFACTS")) {
    ramp = clamp(ramp + 1, t.minRamp, t.maxRamp);
  }

  // Commander that already ramps or draws reduces how much the 99 must carry.
  if (roles.has("RAMP") || /add \{[wubrgc0-9]/.test(text)) {
    ramp = clamp(ramp - 1, t.minRamp, t.maxRamp);
  }
  if (roles.has("CARD_DRAW")) {
    cardDraw = Math.max(8, cardDraw - 1);
  }

  return {
    deckSize: t.deckSize,
    lands,
    ramp,
    cardDraw,
    spotRemoval,
    boardWipes,
    interaction,
    winConditions,
  };
}

export function fillStepsFor(quotas: BuildQuotas): { id: BuildQuotaId; role: CardRole; want: number }[] {
  return [
    { id: "RAMP", role: "RAMP", want: quotas.ramp },
    { id: "CARD_DRAW", role: "CARD_DRAW", want: quotas.cardDraw },
    { id: "SPOT_REMOVAL", role: "SPOT_REMOVAL", want: quotas.spotRemoval },
    { id: "BOARD_WIPE", role: "BOARD_WIPE", want: quotas.boardWipes },
    { id: "WIN_CONDITION", role: "WIN_CONDITION", want: quotas.winConditions },
  ];
}

/**
 * How many unique nonbasics to allow before filling the rest with basics.
 * Leaves room so mono/2-colour decks still run multiple Forests/Islands/etc.
 */
export function maxNonbasicLandSlots(identitySize: number, landTarget: number): number {
  const colors = Math.max(1, identitySize);
  // ~35% nonbasic in mono → ~60% in 5-colour, clamped so basics still exist.
  const ratio = clamp(0.3 + colors * 0.08, 0.3, 0.65);
  return Math.max(6, Math.min(landTarget - colors * 4, Math.round(landTarget * ratio)));
}
