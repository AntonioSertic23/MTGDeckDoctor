/** One piece of a printed mana cost. */
export type ManaToken =
  | { kind: "symbol"; symbol: string }
  /** Separator between faces of a split / modal card ("//"). */
  | { kind: "face-break" };

/**
 * Parses Scryfall mana cost text such as `{2}{R}{W/U}` or
 * `{1}{G} // {3}{U}` into tokens. Text outside braces is ignored.
 */
export function parseManaCost(cost: string | null | undefined): ManaToken[] {
  if (!cost) return [];
  const tokens: ManaToken[] = [];
  const faces = cost.split("//");
  faces.forEach((face, index) => {
    if (index > 0) tokens.push({ kind: "face-break" });
    for (const match of face.matchAll(/\{([^}]+)\}/g)) {
      const symbol = match[1]?.trim().toUpperCase();
      if (symbol) tokens.push({ kind: "symbol", symbol });
    }
  });
  // Drop a trailing / leading break when a face has no cost (e.g. lands on MDFCs).
  while (tokens[0]?.kind === "face-break") tokens.shift();
  while (tokens.at(-1)?.kind === "face-break") tokens.pop();
  return tokens;
}

/** Scryfall's symbol file name: braces and slashes removed (`W/U` → `WU`). */
export function manaSymbolFile(symbol: string): string {
  return symbol.replace(/\//g, "").replace(/[^A-Z0-9½∞]/gi, "");
}

/** Human-readable label for screen readers, e.g. `W/U` → "white or blue". */
export function manaSymbolLabel(symbol: string): string {
  const parts = symbol.split("/").map((part) => SYMBOL_WORDS[part] ?? part);
  if (symbol.endsWith("/P")) {
    return `Phyrexian ${parts.slice(0, -1).join(" or ")}`;
  }
  return parts.join(" or ");
}

const SYMBOL_WORDS: Record<string, string> = {
  W: "white",
  U: "blue",
  B: "black",
  R: "red",
  G: "green",
  C: "colorless",
  S: "snow",
  X: "X",
  P: "Phyrexian",
  T: "tap",
};
