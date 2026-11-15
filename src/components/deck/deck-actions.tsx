"use client";

import Link from "next/link";
import { Check, ClipboardCopy, MoreHorizontal } from "lucide-react";
import { Button, buttonClassName, Menu } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Deck header actions: the frequent ones stay visible, the rest live in "⋯".
 */
export function DeckActions({
  deckId,
  ready,
  disabled,
  onToggleReady,
  onCopyArchidekt,
  onRename,
  onCompare,
  onExport,
  onReanalyze,
  onDelete,
}: {
  deckId: string;
  ready: boolean;
  disabled: boolean;
  onToggleReady: () => void;
  onCopyArchidekt: () => void;
  onRename: () => void;
  onCompare: () => void;
  onExport: () => void;
  onReanalyze: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggleReady}
        aria-pressed={ready}
        className={cn(
          buttonClassName(ready ? "primary" : "secondary"),
          ready &&
            "border-emerald-600 bg-emerald-600 hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500",
        )}
      >
        {ready ? <Check className="h-4 w-4" aria-hidden /> : null}
        {ready ? "Ready to play" : "Mark as ready"}
      </button>
      <Link href={`/decks/new?replace=${deckId}`} className={buttonClassName("secondary")}>
        Replace list
      </Link>
      <Button variant="secondary" onClick={onCopyArchidekt} disabled={disabled}>
        <ClipboardCopy className="h-4 w-4" aria-hidden />
        Copy for Archidekt
      </Button>
      <Menu
        items={[
          { label: "Rename", onSelect: onRename, disabled },
          { label: "Compare with…", onSelect: onCompare },
          { label: "Export JSON", onSelect: onExport, disabled },
          { label: "Re-analyze", onSelect: onReanalyze, disabled },
          { label: "Delete deck", onSelect: onDelete, disabled, danger: true },
        ]}
        trigger={(props) => (
          <button
            type="button"
            className={buttonClassName("secondary", "px-3")}
            aria-label="More deck actions"
            {...props}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
        )}
      />
    </>
  );
}
