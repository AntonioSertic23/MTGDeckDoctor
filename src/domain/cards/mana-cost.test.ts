import { describe, expect, it } from "vitest";
import { manaSymbolFile, manaSymbolLabel, parseManaCost } from "@/domain/cards/mana-cost";

describe("parseManaCost", () => {
  it("parses generic, colored and hybrid symbols", () => {
    expect(parseManaCost("{2}{R}{W/U}")).toEqual([
      { kind: "symbol", symbol: "2" },
      { kind: "symbol", symbol: "R" },
      { kind: "symbol", symbol: "W/U" },
    ]);
  });

  it("marks split-card faces", () => {
    expect(parseManaCost("{1}{G} // {3}{U}")).toEqual([
      { kind: "symbol", symbol: "1" },
      { kind: "symbol", symbol: "G" },
      { kind: "face-break" },
      { kind: "symbol", symbol: "3" },
      { kind: "symbol", symbol: "U" },
    ]);
  });

  it("drops breaks around empty faces", () => {
    expect(parseManaCost("{2}{G} // ")).toEqual([
      { kind: "symbol", symbol: "2" },
      { kind: "symbol", symbol: "G" },
    ]);
  });

  it("returns nothing for missing costs", () => {
    expect(parseManaCost(null)).toEqual([]);
    expect(parseManaCost("")).toEqual([]);
  });
});

describe("manaSymbolFile", () => {
  it("removes slashes", () => {
    expect(manaSymbolFile("W/U")).toBe("WU");
    expect(manaSymbolFile("2/W")).toBe("2W");
    expect(manaSymbolFile("10")).toBe("10");
  });
});

describe("manaSymbolLabel", () => {
  it("describes hybrid and Phyrexian symbols", () => {
    expect(manaSymbolLabel("W/U")).toBe("white or blue");
    expect(manaSymbolLabel("G/P")).toBe("Phyrexian green");
    expect(manaSymbolLabel("3")).toBe("3");
  });
});
