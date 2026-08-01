import type { DeckImporter, ImportedDeck, ImportedDeckCard } from "@/domain/types";
import { cleanCardName } from "@/lib/cards/clean-name";

/**
 * Plain-text decklist importer (PRD §22).
 *
 * Handles the shapes that Archidekt, Moxfield and manual lists actually
 * export: optional quantity, optional `x` suffix, set/collector annotations,
 * category tags, foil markers, and section headers marking the commander.
 */
const SECTION_HEADER =
  /^(\/\/\s*)?(commanders?|companion|deck|mainboard|maybeboard|sideboard|tokens?|lands?|creatures?|instants?|sorceries|artifacts?|enchantments?|planeswalkers?|other)\b[:\s]*$/i;
const COMMANDER_SECTION = /^(\/\/\s*)?commanders?\b/i;
const NON_DECK_SECTION = /^(\/\/\s*)?(maybeboard|sideboard|tokens?)\b/i;
const CARD_LINE = /^(?:(\d+)\s*[xX]?\s+)?(.+)$/;
const CATEGORY_TAG = /\s*\[[^\]]*\]\s*$/i;
/** Archidekt finish markers: *F* foil, *E* etched, *S* signed. */
const FOIL_MARKER = /\*(?:F|f|foil)\*/i;
const FINISH_MARKER = /\*(?:F|E|S|f|e|s|foil|etched|signed)\*/gi;
const COMMANDER_MARKER = /\*?\bcmdr\b\*?|\*commander\*/i;
const COMMANDER_CATEGORY = /\[[^\]]*Commander[^\]]*\]/i;
/** `(set) collector` near the end — keep these for printing-accurate Scryfall lookups. */
const PRINTING = /\(([a-z0-9]+)\)\s+([A-Za-z0-9][A-Za-z0-9★†-]*)\s*$/i;
const LOOSE_SET = /\(([a-z0-9]+)\)\s*$/i;

export function parseDecklist(input: string): ImportedDeck {
  const lines = input.split(/\r?\n/);
  const cards = new Map<string, ImportedDeckCard>();
  const ignoredLines: string[] = [];

  let inCommanderSection = false;
  let skipSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    if (SECTION_HEADER.test(line)) {
      inCommanderSection = COMMANDER_SECTION.test(line);
      skipSection = NON_DECK_SECTION.test(line);
      continue;
    }

    if (skipSection) continue;
    if (line.startsWith("//") || line.startsWith("#")) continue;

    const parsed = parseLine(line);
    if (!parsed) {
      ignoredLines.push(rawLine);
      continue;
    }

    const isCommander = inCommanderSection || parsed.markedAsCommander;
    const key = [
      parsed.name.toLowerCase(),
      parsed.setCode ?? "",
      parsed.collectorNumber ?? "",
      parsed.foil ? "foil" : "",
    ].join("|");
    const existing = cards.get(key);

    if (existing) {
      existing.quantity += parsed.quantity;
      existing.isCommander = existing.isCommander || isCommander;
    } else {
      cards.set(key, {
        name: parsed.name,
        quantity: parsed.quantity,
        isCommander,
        setCode: parsed.setCode,
        collectorNumber: parsed.collectorNumber,
        foil: parsed.foil || undefined,
      });
    }
  }

  return { cards: [...cards.values()], ignoredLines };
}

interface ParsedLine {
  name: string;
  quantity: number;
  markedAsCommander: boolean;
  setCode?: string;
  collectorNumber?: string;
  foil: boolean;
}

function parseLine(line: string): ParsedLine | null {
  const markedAsCommander = COMMANDER_MARKER.test(line) || COMMANDER_CATEGORY.test(line);
  const foil = FOIL_MARKER.test(line);

  const match = CARD_LINE.exec(line);
  if (!match) return null;

  const quantity = match[1] ? Number.parseInt(match[1], 10) : 1;
  let rest = match[2]
    .replace(COMMANDER_MARKER, " ")
    .replace(FINISH_MARKER, " ")
    .replace(CATEGORY_TAG, "")
    .replace(/\s+/g, " ")
    .trim();

  let setCode: string | undefined;
  let collectorNumber: string | undefined;

  const printing = PRINTING.exec(rest);
  if (printing) {
    setCode = printing[1].toLowerCase();
    collectorNumber = printing[2];
    rest = rest.slice(0, printing.index).trim();
  } else {
    // Tolerant peel when collector has unexpected chars (★, trailing junk, etc.).
    // Only strip when the match is at the end of the line so names like
    // "B.F.M. (Big Furry Monster)" stay intact.
    const loosePrinting = /\(([a-z0-9]+)\)\s+(\S+)/i.exec(rest);
    if (loosePrinting && loosePrinting.index !== undefined) {
      const after = rest.slice(loosePrinting.index + loosePrinting[0].length).trim();
      if (after.length === 0 || /^(?:\*[A-Za-z]+\*\s*)+$/.test(after)) {
        setCode = loosePrinting[1].toLowerCase();
        const cleanedCollector = loosePrinting[2].replace(/[^A-Za-z0-9★†-]/g, "");
        if (cleanedCollector) collectorNumber = cleanedCollector;
        rest = rest.slice(0, loosePrinting.index).trim();
      }
    }
    if (!setCode) {
      const looseSet = LOOSE_SET.exec(rest);
      if (looseSet) {
        setCode = looseSet[1].toLowerCase();
        rest = rest.slice(0, looseSet.index).trim();
      }
    }
  }

  // Leftover brace/angle annotations, if any.
  rest = rest.replace(/\s*(\{[^}]*\}|<[^>]*>)\s*/g, " ").replace(/\s+/g, " ").trim();
  // Always leave a clean name — even if set/collector extraction failed, Scryfall
  // can still resolve by name alone.
  const name = cleanCardName(rest.replace(/\s*\/\/\s*/g, " // "));

  if (name.length === 0) return null;
  if (!/[a-z]/i.test(name)) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  return { name, quantity, markedAsCommander, setCode, collectorNumber, foil };
}

export const textDeckImporter: DeckImporter = {
  id: "text",
  canHandle: () => true,
  import: async (input) => parseDecklist(input),
};

const IMPORTERS: DeckImporter[] = [textDeckImporter];

/**
 * Adapter registry so Archidekt/Moxfield URL importers can be dropped in
 * without touching call sites (PRD §22).
 */
export async function importDeck(input: string): Promise<ImportedDeck> {
  const importer = IMPORTERS.find((i) => i.canHandle(input)) ?? textDeckImporter;
  return importer.import(input);
}
