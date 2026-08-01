"use client";

import { useEffect, useState } from "react";
import type { DeckAnalysis, DeckWithCards } from "@/domain/types";
import { deckContentKey, getCachedOrAnalyzeDeck } from "@/lib/decks/analyze-local";

/** Loads cached (or freshly computed) analysis keyed by deck id. */
export function useDeckAnalyses(decks: DeckWithCards[]) {
  const [scores, setScores] = useState<Record<string, DeckAnalysis>>({});

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const next: Record<string, DeckAnalysis> = {};
      for (const deck of decks) {
        const snap = deck.deck.analysisSnapshot;
        if (snap && snap.contentKey === deckContentKey(deck)) {
          next[deck.deck.id] = snap.analysis;
        }
      }
      if (!cancelled) setScores({ ...next });

      for (const deck of decks) {
        if (next[deck.deck.id]) continue;
        try {
          const { analysis } = await getCachedOrAnalyzeDeck(deck);
          next[deck.deck.id] = analysis;
          if (!cancelled) setScores({ ...next });
        } catch {
          // Incomplete card cache — skip until the user re-opens the deck.
        }
      }
    }

    if (decks.length > 0) void run();
    else setScores({});

    return () => {
      cancelled = true;
    };
  }, [decks]);

  return scores;
}
