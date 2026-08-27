import { CARD_ROLE_LABELS, type Card, type CardRole } from "@/domain/types";

/**
 * Archidekt-friendly plain text (paste into Archidekt → Import).
 *
 * Shape matches what our importer already accepts:
 * `1x Name (set) [Category]` with a `// Commander` section.
 */

export interface ArchidektExportEntry {
  card: Card;
  quantity: number;
  roles?: CardRole[];
  isCommander?: boolean;
}

/** Short category tags Archidekt commonly uses. */
const ARCHIDEKT_CATEGORY: Partial<Record<CardRole, string>> = {
  LAND: "Land",
  RAMP: "Ramp",
  FIXING: "Fixing",
  CARD_DRAW: "Draw",
  TUTOR: "Tutor",
  SPOT_REMOVAL: "Removal",
  BOARD_WIPE: "Board Wipe",
  COUNTERSPELL: "Counterspell",
  PROTECTION: "Protection",
  RECURSION: "Recursion",
  GRAVEYARD: "Graveyard",
  SACRIFICE_OUTLET: "Sacrifice",
  TOKEN_MAKER: "Tokens",
  COST_REDUCTION: "Cost Reduction",
  VALUE_ENGINE: "Value",
  STAX: "Stax",
  LIFEGAIN: "Lifegain",
  WIN_CONDITION: "Wincon",
};

export function formatArchidektDecklist(
  entries: ArchidektExportEntry[],
  commanderOracleIds: string[] = [],
): string {
  const commanderIds = new Set(
    commanderOracleIds.length > 0
      ? commanderOracleIds
      : entries.filter((e) => e.isCommander).map((e) => e.card.oracleId),
  );

  const commanders = entries
    .filter((e) => commanderIds.has(e.card.oracleId))
    .sort((a, b) => a.card.name.localeCompare(b.card.name, undefined, { sensitivity: "base" }));

  const main = entries
    .filter((e) => !commanderIds.has(e.card.oracleId))
    .sort((a, b) => a.card.name.localeCompare(b.card.name, undefined, { sensitivity: "base" }));

  const lines: string[] = [];

  if (commanders.length > 0) {
    lines.push("// Commander");
    for (const entry of commanders) {
      lines.push(formatLine(entry, true));
    }
    lines.push("");
  }

  lines.push("// Deck");
  for (const entry of main) {
    lines.push(formatLine(entry, false));
  }

  return `${lines.join("\n")}\n`;
}

function formatLine(entry: ArchidektExportEntry, isCommander: boolean): string {
  const qty = Math.max(1, entry.quantity);
  const set = entry.card.setCode?.trim();
  const setPart = set ? ` (${set.toLowerCase()})` : "";
  const category = isCommander ? "Commander" : categoryFor(entry.roles);
  const categoryPart = category ? ` [${category}]` : "";
  return `${qty}x ${entry.card.name}${setPart}${categoryPart}`;
}

function categoryFor(roles: CardRole[] | undefined): string | null {
  if (!roles || roles.length === 0) return null;
  const primary = roles[0]!;
  return ARCHIDEKT_CATEGORY[primary] ?? CARD_ROLE_LABELS[primary] ?? null;
}
