import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY_POINTS,
  listKeyFromContentKey,
  nextHealthHistory,
} from "@/domain/analysis/history";
import type { DeckAnalysis, DeckAnalysisSnapshot, HealthHistoryPoint } from "@/domain/types";

function point(listKey: string, overall: number, at = "2026-01-01T00:00:00Z"): HealthHistoryPoint {
  return { at, overall, averageManaValue: 3, totalCards: 100, listKey };
}

function snapshot(partial: Partial<DeckAnalysisSnapshot> & { overall?: number }): DeckAnalysisSnapshot {
  return {
    contentKey: "v6|cmd|a:1",
    analysis: {
      health: { overall: partial.overall ?? 60, categories: [] },
      statistics: { averageManaValue: 3.2, totalCards: 100 },
    } as unknown as DeckAnalysis,
    additions: [],
    computedAt: "2025-12-01T00:00:00Z",
    ...partial,
  };
}

describe("listKeyFromContentKey", () => {
  it("strips the analyzer version", () => {
    expect(listKeyFromContentKey("v7|cmd|a:1,b:1")).toBe("cmd|a:1,b:1");
  });
});

describe("nextHealthHistory", () => {
  it("starts a history for a brand-new deck", () => {
    expect(nextHealthHistory(null, point("cmd|a:1", 70))).toEqual([point("cmd|a:1", 70)]);
  });

  it("seeds from a legacy snapshot without history", () => {
    const next = nextHealthHistory(snapshot({ overall: 55 }), point("cmd|b:1", 70));
    expect(next.map((p) => p.overall)).toEqual([55, 70]);
    expect(next[0]?.at).toBe("2025-12-01T00:00:00Z");
  });

  it("adds a point when the list changes", () => {
    const prev = snapshot({ history: [point("cmd|a:1", 60)] });
    expect(nextHealthHistory(prev, point("cmd|b:1", 72)).map((p) => p.overall)).toEqual([60, 72]);
  });

  it("replaces the latest point when the list is unchanged", () => {
    const prev = snapshot({ history: [point("cmd|a:1", 50), point("cmd|b:1", 60)] });
    const next = nextHealthHistory(prev, point("cmd|b:1", 64));
    expect(next.map((p) => p.overall)).toEqual([50, 64]);
  });

  it("caps the number of points", () => {
    const history = Array.from({ length: MAX_HISTORY_POINTS }, (_, i) => point(`k${i}`, i));
    const next = nextHealthHistory(snapshot({ history }), point("new", 99));
    expect(next).toHaveLength(MAX_HISTORY_POINTS);
    expect(next.at(-1)?.overall).toBe(99);
    expect(next[0]?.listKey).toBe("k1");
  });
});
