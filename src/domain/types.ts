/**
 * Core domain types.
 *
 * Everything in `src/domain` is framework-free and side-effect-free so the
 * analysis engine stays deterministic and unit-testable (PRD §7, §33).
 */

/**
 * A card can fill several roles at once, so roles are always a set rather than
 * a single enum (PRD §26).
 */
export type CardRole =
  | "LAND"
  | "RAMP"
  | "FIXING"
  | "CARD_DRAW"
  | "TUTOR"
  | "SPOT_REMOVAL"
  | "BOARD_WIPE"
  | "COUNTERSPELL"
  | "PROTECTION"
  | "RECURSION"
  | "GRAVEYARD"
  | "SACRIFICE_OUTLET"
  | "TOKEN_MAKER"
  | "COST_REDUCTION"
  | "VALUE_ENGINE"
  | "STAX"
  | "LIFEGAIN"
  | "WIN_CONDITION";

export const CARD_ROLE_LABELS: Record<CardRole, string> = {
  LAND: "Land",
  RAMP: "Ramp",
  FIXING: "Fixing",
  CARD_DRAW: "Card draw",
  TUTOR: "Tutor",
  SPOT_REMOVAL: "Spot removal",
  BOARD_WIPE: "Board wipe",
  COUNTERSPELL: "Counterspell",
  PROTECTION: "Protection",
  RECURSION: "Recursion",
  GRAVEYARD: "Graveyard",
  SACRIFICE_OUTLET: "Sacrifice outlet",
  TOKEN_MAKER: "Token maker",
  COST_REDUCTION: "Cost reduction",
  VALUE_ENGINE: "Value engine",
  STAX: "Stax",
  LIFEGAIN: "Lifegain",
  WIN_CONDITION: "Win condition",
};

export type ThemeId =
  | "GRAVEYARD"
  | "SACRIFICE"
  | "TOKENS"
  | "PLUS_ONE_COUNTERS"
  | "ARTIFACTS"
  | "ENCHANTMENTS"
  | "LIFEGAIN"
  | "LANDFALL"
  | "SPELLSLINGER"
  | "BLINK"
  | "MILL"
  | "DISCARD"
  | "TREASURE"
  | "EQUIPMENT"
  | "AURAS"
  | "DRAIN"
  | "BIG_CREATURES"
  | "GO_WIDE";

export type Color = "W" | "U" | "B" | "R" | "G";

export interface CardPrices {
  usd: string | null;
  eur: string | null;
}

/**
 * Locally cached card data. Only the fields the app actually needs (PRD §20).
 *
 * `oracleId` is the logical identity used for deck analysis and shared-card
 * detection; `scryfallId` identifies one specific printing (PRD §24).
 */
export interface Card {
  oracleId: string;
  scryfallId: string;
  name: string;
  manaCost: string | null;
  manaValue: number;
  typeLine: string;
  oracleText: string;
  colors: Color[];
  colorIdentity: Color[];
  keywords: string[];
  producedMana: string[];
  power: string | null;
  toughness: string | null;
  imageUri: string | null;
  setCode: string;
  rarity: string;
  prices: CardPrices;
  legalities: Record<string, string>;
  updatedAt: string;
}

export type DeckFormat = "commander" | "other";

export interface Deck {
  id: string;
  name: string;
  format: DeckFormat;
  /** Oracle ids of the commander(s). Empty for non-commander decks. */
  commanderOracleIds: string[];
  description?: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Persisted diagnosis for this list. Recomputed when card/commander content
   * changes; skipped on rename and on revisiting Home / deck pages.
   */
  analysisSnapshot?: DeckAnalysisSnapshot | null;
}

/** Fingerprinted analysis payload stored with the deck. */
export interface DeckAnalysisSnapshot {
  /** Hash of commanders + card quantities — invalidates cache when list changes. */
  contentKey: string;
  analysis: DeckAnalysis;
  additions: AdditionCandidate[];
  computedAt: string;
}

export interface DeckCard {
  oracleId: string;
  quantity: number;
}

export interface DeckWithCards {
  deck: Deck;
  cards: DeckCard[];
}

/** A deck whose cards have been joined with resolved card data. */
export interface ResolvedDeck {
  deck: Deck;
  entries: ResolvedDeckEntry[];
  commanders: Card[];
  /** Names from the decklist that could not be matched to a card. */
  unresolved: string[];
}

export interface ResolvedDeckEntry {
  card: Card;
  quantity: number;
  roles: CardRole[];
  themes: ThemeId[];
  isCommander: boolean;
}

export interface InventoryItem {
  oracleId: string;
  quantity: number;
}

/**
 * Which deck a *physical* copy currently sits in. Deliberately separate from
 * decklist membership (PRD §17, §18).
 */
export interface CardAllocation {
  oracleId: string;
  deckId: string;
  quantity: number;
}

export interface ImportedDeckCard {
  name: string;
  quantity: number;
  isCommander: boolean;
  /** Archidekt/Moxfield set code, e.g. `ltc`. */
  setCode?: string;
  /** Collector number as printed in the export, e.g. `284` or `UDS-54`. */
  collectorNumber?: string;
  foil?: boolean;
}

export interface ImportedDeck {
  name?: string;
  cards: ImportedDeckCard[];
  /** Lines the parser could not interpret, surfaced to the user. */
  ignoredLines: string[];
}

/** Adapter interface so Archidekt/Moxfield importers can be added later (PRD §22). */
export interface DeckImporter {
  id: string;
  canHandle(input: string): boolean;
  import(input: string): Promise<ImportedDeck>;
}

export type Severity = "critical" | "warning" | "notice";

export interface Problem {
  type: string;
  severity: Severity;
  title: string;
  description: string;
  evidence: Record<string, number | string>;
  affectedCards: string[];
  suggestedFix?: string;
}

export type HealthCategoryId =
  | "manaBase"
  | "ramp"
  | "cardAdvantage"
  | "interaction"
  | "removal"
  | "winConditions"
  | "curve"
  | "synergy";

export interface HealthCategory {
  id: HealthCategoryId;
  label: string;
  /** 0–100. */
  score: number;
  /** Human-readable facts the score was derived from (PRD §41). */
  evidence: string[];
}

export interface DeckHealth {
  overall: number;
  categories: HealthCategory[];
}

export interface DeckStatistics {
  totalCards: number;
  landCount: number;
  nonlandCount: number;
  creatureCount: number;
  instantCount: number;
  sorceryCount: number;
  artifactCount: number;
  enchantmentCount: number;
  planeswalkerCount: number;
  battleCount: number;
  averageManaValue: number;
  medianManaValue: number;
  manaCurve: Record<string, number>;
  colorPips: Record<Color, number>;
  colorIdentity: Color[];
  rampCount: number;
  drawCount: number;
  spotRemovalCount: number;
  boardWipeCount: number;
  counterspellCount: number;
  instantSpeedInteractionCount: number;
  tutorCount: number;
  recursionCount: number;
  graveyardInteractionCount: number;
  protectionCount: number;
  winConditionCount: number;
  roleCounts: Record<CardRole, number>;
  themeCounts: Record<string, number>;
}

export interface CutCandidate {
  oracleId: string;
  name: string;
  /** 0–100; higher means a stronger candidate to cut. */
  cutScore: number;
  reasons: string[];
  imageUri?: string | null;
}

export interface AdditionCandidate {
  name: string;
  roles: CardRole[];
  themes: ThemeId[];
  approxManaValue: number;
  score: number;
  reasons: string[];
  imageUri?: string | null;
}

export interface DeckProfile {
  primaryArchetype: string;
  secondaryArchetype: string | null;
  keyMechanics: string[];
  mainGameplan: string;
  winConditions: string[];
  weaknesses: string[];
}

export interface DeckExplanation {
  profile: DeckProfile;
  narrative: string;
}

export interface DeckAnalysis {
  deckId: string;
  generatedAt: string;
  statistics: DeckStatistics;
  health: DeckHealth;
  problems: Problem[];
  cuts: CutCandidate[];
  explanation: DeckExplanation;
  synergy: SynergySummary;
  unresolved: string[];
}

export interface SynergySummary {
  /** Themes the deck is actually built around, strongest first. */
  themes: { id: ThemeId; label: string; count: number }[];
  /** Per-card synergy score, 0–100. */
  cardScores: Record<string, number>;
  averageScore: number;
}

export interface SharedCardUsage {
  oracleId: string;
  name: string;
  deckIds: string[];
  deckNames: string[];
  copiesRequired: number;
  copiesOwned: number;
  shortage: number;
  conflict: boolean;
}
