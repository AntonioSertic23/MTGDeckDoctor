"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckWithCards } from "@/domain/types";
import {
  deckContentKey,
  getCachedOrAnalyzeDeck,
  type LocalAnalysis,
} from "@/lib/decks/analyze-local";

/**
 * Diagnosis for one deck. Shows the saved snapshot immediately (scores,
 * problems) and fills in resolved cards once they load from storage.
 */
export function useDeckAnalysis(deck: DeckWithCards | null) {
  const [loaded, setLoaded] = useState<LocalAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Snapshot scores are available instantly; resolved cards arrive with `loaded`.
  const preview = useMemo(() => (deck ? previewFromSnapshot(deck) : null), [deck]);

  // Keep the last full result for this deck while a refresh recomputes it, so
  // the card grid does not flash back to the preview.
  const analysis =
    deck && loaded?.resolved.deck.id === deck.deck.id ? loaded : deck ? preview : null;

  useEffect(() => {
    let cancelled = false;
    if (!deck) return;

    getCachedOrAnalyzeDeck(deck)
      .then((result) => {
        if (cancelled) return;
        setLoaded(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Analysis failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [deck]);

  /** Re-runs the full pipeline even if the list is unchanged. */
  const reanalyze = useCallback(async () => {
    if (!deck) return;
    setError(null);
    const result = await getCachedOrAnalyzeDeck(deck, { force: true });
    setLoaded(result);
  }, [deck]);

  /** True while only the cached snapshot is shown and card rows are still loading. */
  const cardsPending = Boolean(
    analysis && deck && analysis.resolved.entries.length === 0 && deck.cards.length > 0,
  );

  return { analysis, error, setError, reanalyze, cardsPending };
}

function previewFromSnapshot(deck: DeckWithCards): LocalAnalysis | null {
  const snap = deck.deck.analysisSnapshot;
  if (!snap || snap.contentKey !== deckContentKey(deck)) return null;
  return {
    resolved: {
      deck: deck.deck,
      entries: [],
      commanders: [],
      unresolved: [],
    },
    analysis: snap.analysis,
    additions: snap.additions ?? [],
    healthSuggestions: snap.healthSuggestions ?? {},
  };
}
