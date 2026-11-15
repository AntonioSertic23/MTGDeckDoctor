import type { DeckAnalysis, DeckAnalysisSnapshot, HealthHistoryPoint } from "@/domain/types";

export const MAX_HISTORY_POINTS = 50;

/** `v6|cmd|cards` → `cmd|cards`, so an analyzer version bump is not a list change. */
export function listKeyFromContentKey(contentKey: string): string {
  return contentKey.replace(/^v\d+\|/, "");
}

export function historyPoint(
  analysis: DeckAnalysis,
  contentKey: string,
  at: string,
): HealthHistoryPoint {
  return {
    at,
    overall: analysis.health.overall,
    averageManaValue: analysis.statistics.averageManaValue,
    totalCards: analysis.statistics.totalCards,
    listKey: listKeyFromContentKey(contentKey),
  };
}

/**
 * History for a new snapshot. A changed list adds a point; the same list
 * (re-analyze, analyzer upgrade) replaces the latest point instead.
 * Snapshots saved before history existed seed it with their own point.
 */
export function nextHealthHistory(
  previous: DeckAnalysisSnapshot | null | undefined,
  point: HealthHistoryPoint,
): HealthHistoryPoint[] {
  const base: HealthHistoryPoint[] = previous
    ? (previous.history ??
      [historyPoint(previous.analysis, previous.contentKey, previous.computedAt)])
    : [];

  const last = base.at(-1);
  const next = last && last.listKey === point.listKey ? [...base.slice(0, -1), point] : [...base, point];
  return next.slice(-MAX_HISTORY_POINTS);
}
