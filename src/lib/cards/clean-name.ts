/**
 * Strip Archidekt / Moxfield leftovers (set codes, finish markers, foil stars)
 * so a messy line still yields a Scryfall-resolvable card name.
 */
export function cleanCardName(name: string): string {
  return name
    .replace(/\*(?:F|E|S|f|e|s|foil|etched|signed)\*/gi, " ")
    .replace(/\s*\([a-z0-9]+\)\s+\S+(?:\s+\S+)*\s*$/i, "")
    .replace(/\s*\([a-z0-9]+\)\s*$/i, "")
    .replace(/[★†]+/g, "")
    .replace(/\s*(\{[^}]*\}|<[^>]*>)\s*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\/\s*/g, " // ")
    .trim();
}
